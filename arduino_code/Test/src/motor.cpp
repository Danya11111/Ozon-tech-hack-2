#include "motor.h"
#include "config.h"

static TMC2209 stepper_driver;
static bool tmc_initialized = false;
static SemaphoreHandle_t tmc_uart_mutex = NULL;

volatile unsigned long total_steps = 0;
static int target_rpm = 0;
static int current_rpm_display = 0;

static bool is_ramping = false;
static unsigned long ramp_start_ms = 0;
static float start_speed_sps = 0;
static float end_speed_sps = 0;
static float current_speed_sps = 0;
static int32_t last_vactual = 0;
static bool velocity_sent = false; // Флаг для отправки хотя бы раз

static uint16_t current_microsteps = TMC_MICROSTEPS;
static uint8_t current_run_percent = TMC_RUN_CURRENT_PERCENT;

#define TMC_LOCK() xSemaphoreTake(tmc_uart_mutex, portMAX_DELAY)
#define TMC_UNLOCK() xSemaphoreGive(tmc_uart_mutex)

const float TMC_FCLK = 12800000.0;
const float VACTUAL_FACTOR = 8388608.0 / TMC_FCLK;

int32_t calculateVActual(float microsteps_per_second) {
    return (int32_t)(microsteps_per_second * VACTUAL_FACTOR);
}

void motorInit() {
    pinMode(EN_PIN, OUTPUT);
    digitalWrite(EN_PIN, LOW);
    tmc_uart_mutex = xSemaphoreCreateMutex();

    TMC_SERIAL.begin(TMC_BAUD_RATE, SERIAL_8N1, TMC_RX_PIN, TMC_TX_PIN);
    delay(500);
    
    TMC_LOCK();
    
    stepper_driver.setup(TMC_SERIAL, TMC_BAUD_RATE, 
                        (TMC2209::SerialAddress)TMC_SERIAL_ADDRESS, 
                        TMC_RX_PIN, TMC_TX_PIN);
    
    delay(200);
    
    // Проверка связи
    if (!stepper_driver.isCommunicating()) {
        Serial.println("ERROR: TMC2209 not communicating!");
        TMC_UNLOCK();
        tmc_initialized = false;
        return;
    }
    
    Serial.println("TMC2209 communicating OK");
    
    // Базовая настройка
    stepper_driver.setMicrostepsPerStep(TMC_MICROSTEPS);
    stepper_driver.setRunCurrent(TMC_RUN_CURRENT_PERCENT);
    stepper_driver.setHoldCurrent(TMC_HOLD_CURRENT_PERCENT);
    stepper_driver.setHoldDelay(7);
    stepper_driver.setStallGuardThreshold(TMC_STALL_GUARD_THRESH);
    
    stepper_driver.enableAutomaticCurrentScaling();
    stepper_driver.enableAutomaticGradientAdaptation();
    
    // КРИТИЧНО: Отключаем StealthChop для работы moveAtVelocity()!
    stepper_driver.disableStealthChop();
    delay(10);
    
    // Включаем CoolStep для энергосбережения
    stepper_driver.enableCoolStep();
    
    // Программное включение драйвера
    stepper_driver.enable();
    delay(100);
    
    tmc_initialized = stepper_driver.isSetupAndCommunicating();
    
    if (tmc_initialized) {
        Serial.println("TMC2209 initialized successfully");
        TMC2209::Settings settings = stepper_driver.getSettings();
        Serial.printf("Run: %d%%, Hold: %d%%, Microsteps: %d, StealthChop: %s\n", 
            settings.irun_percent, settings.ihold_percent, 
            settings.microsteps_per_step, settings.stealth_chop_enabled ? "ON" : "OFF");
    } else {
        Serial.println("ERROR: TMC2209 setup failed!");
    }
    
    TMC_UNLOCK();

    current_microsteps = TMC_MICROSTEPS;
    current_run_percent = TMC_RUN_CURRENT_PERCENT;
}

void motorLoop() {
    if (is_ramping) {
        unsigned long now = millis();
        unsigned long elapsed = now - ramp_start_ms;

        if (elapsed >= RAMP_DURATION_MS) {
            is_ramping = false;
            current_speed_sps = end_speed_sps;
        } else {
            float progress = (float)elapsed / RAMP_DURATION_MS;
            current_speed_sps = start_speed_sps + (end_speed_sps - start_speed_sps) * progress;
        }

        int32_t vactual = calculateVActual(current_speed_sps);
        
        // Отправляем если: скорость изменилась ИЛИ это первая отправка в рампе
        if (abs(vactual - last_vactual) >= 0 || !velocity_sent) {
            TMC_LOCK();
            stepper_driver.moveAtVelocity(vactual);
            TMC_UNLOCK();
            last_vactual = vactual;
            velocity_sent = true;
            
            Serial.printf("VACTUAL: %d (SPS: %.1f, RPM: %d)\n", 
                vactual, current_speed_sps, current_rpm_display);
        }

        unsigned long steps_per_rev = (unsigned long)STEPS_PER_REVOLUTION * current_microsteps;
        current_rpm_display = ((unsigned long)abs(current_speed_sps) * 60) / steps_per_rev;
    } else if (!velocity_sent && current_speed_sps == 0) {
        // Если мотор стоит и скорость не отправлялась - отправляем 0
        TMC_LOCK();
        stepper_driver.moveAtVelocity(0);
        TMC_UNLOCK();
        velocity_sent = true;
    }
    if (current_speed_sps != 0) {
            total_steps += (unsigned long)(abs(current_speed_sps) * 0.005);
    }
    
    vTaskDelay(pdMS_TO_TICKS(5));
}

void setTargetRPM(int rpm) {
    target_rpm = rpm;
    if (rpm != 0 && current_rpm_display < 5) resetSteps();

    unsigned long steps_per_rev = (unsigned long)STEPS_PER_REVOLUTION * current_microsteps;
    
    start_speed_sps = current_speed_sps;
    end_speed_sps = (rpm != 0) ? ((float)rpm * steps_per_rev) / 60.0f : 0;

    ramp_start_ms = millis();
    is_ramping = true;
    velocity_sent = false; // Сбрасываем флаг для новой отправки
    
    Serial.printf("Target RPM: %d -> SPS: %.1f\n", rpm, end_speed_sps);
}

void resetSteps() {
    total_steps = 0;
}

unsigned long getMotorSteps() { return total_steps; }
int getCurrentRPM() { return current_rpm_display; }
bool isMotorRunning() { return (abs(current_speed_sps) > 1); }

void tmcSetCurrentPercent(uint8_t run_percent, uint8_t hold_percent) {
    if (!tmc_initialized) return;
    TMC_LOCK();
    stepper_driver.setAllCurrentValues(run_percent, hold_percent, 7);
    TMC_UNLOCK();
    current_run_percent = run_percent;
}

void tmcSetMicrosteps(uint16_t ms) {
    if (!tmc_initialized) return;
    TMC_LOCK();
    stepper_driver.setMicrostepsPerStep(ms);
    TMC_UNLOCK();
    current_microsteps = ms;
    if (target_rpm != 0) setTargetRPM(target_rpm);
}

void tmcSetStallGuard(uint8_t threshold) {
    if (!tmc_initialized) return;
    TMC_LOCK();
    stepper_driver.setStallGuardThreshold(threshold);
    TMC_UNLOCK();
}

void tmcSoftwareEnable(bool enable) {
    if (!tmc_initialized) return;
    TMC_LOCK();
    if (enable) {
        stepper_driver.enable();
        // После enable нужно заново отправить скорость
        velocity_sent = false;
    } else {
        stepper_driver.moveAtVelocity(0);
        stepper_driver.disable();
        last_vactual = 0;
        current_speed_sps = 0;
        is_ramping = false;
    }
    TMC_UNLOCK();
}

void tmcSetStealthChop(bool enable) {
    if (!tmc_initialized) return;
    TMC_LOCK();
    if (enable) {
        stepper_driver.enableStealthChop();
        // В StealthChop VACTUAL не работает, останавливаем мотор
        stepper_driver.moveAtVelocity(0);
        last_vactual = 0;
        current_speed_sps = 0;
    } else {
        stepper_driver.disableStealthChop();
        velocity_sent = false;
    }
    TMC_UNLOCK();
}

void tmcSetCoolStep(bool enable) {
    if (!tmc_initialized) return;
    TMC_LOCK();
    enable ? stepper_driver.enableCoolStep() : stepper_driver.disableCoolStep();
    TMC_UNLOCK();
}

bool tmcIsInitialized() { return tmc_initialized; }

bool tmcIsCommunicating() {
    if (!tmc_initialized) return false;
    TMC_LOCK();
    bool res = stepper_driver.isCommunicating();
    TMC_UNLOCK();
    return res;
}

// Функция проверки состояния EN_PIN
bool checkDriverStatus() {
    bool en_state = (digitalRead(EN_PIN) == LOW);
    return en_state;
}

// Функция проверки программного состояния TMC
bool checkTmcSoftwareEnable() {
    TMC2209::Settings s = tmcGetSettings();
    bool tmc_state = s.software_enabled;
    return tmc_state;
}

uint16_t tmcGetMicrostepsSetting() { return current_microsteps; }
uint8_t tmcGetRunCurrentPercent() { return current_run_percent; }

TMC2209::Status tmcGetStatus() {
    TMC2209::Status s = {};
    if (!tmc_initialized) return s;
    TMC_LOCK();
    s = stepper_driver.getStatus();
    TMC_UNLOCK();
    return s;
}

TMC2209::Settings tmcGetSettings() {
    TMC2209::Settings s = {};
    if (!tmc_initialized) return s;
    TMC_LOCK();
    s = stepper_driver.getSettings();
    TMC_UNLOCK();
    return s;
}

uint16_t tmcGetStallGuardResult() {
    if (!tmc_initialized) return 0;
    TMC_LOCK();
    uint16_t res = stepper_driver.getStallGuardResult();
    TMC_UNLOCK();
    return res;
}

uint32_t tmcGetInterstepDuration() {
    if (!tmc_initialized) return 0;
    TMC_LOCK();
    uint32_t res = stepper_driver.getInterstepDuration();
    TMC_UNLOCK();
    return res;
}

uint16_t tmcGetMicrostepCounter() {
    if (!tmc_initialized) return 0;
    TMC_LOCK();
    uint16_t res = stepper_driver.getMicrostepCounter();
    TMC_UNLOCK();
    return res;
}