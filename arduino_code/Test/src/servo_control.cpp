#include "servo_control.h"
#include "mqtt_handler.h"
#include "config.h"

static Adafruit_PWMServoDriver pwm = Adafruit_PWMServoDriver();
static bool servo_initialized = false;



void servoInit() {
    Serial.println("Initializing PCA9685 servo driver...");
    
    // Инициализация I2C на пинах 21 (SDA) и 22 (SCL)
    Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
    
    pwm.begin();
    pwm.setOscillatorFrequency(27000000);
    pwm.setPWMFreq(50); // 50 Hz для сервоприводов
    
    delay(10);
    
    servo_initialized = true;
    Serial.println("PCA9685 initialized successfully");
    
    // Инициализируем все каналы как выключенные
    for (int i = 0; i < MAX_SERVOS; i++) {
        current_angles[i] = 90; // Начальное положение - середина
        servo_enabled[i] = false;
        disableServo(i);
    }
}

// Преобразование угла (0-180) в длину импульса
uint16_t angleToPulse(uint8_t angle) {
    if (angle > 180) angle = 180;
    return map(angle, 0, 180, SERVO_MIN_PULSE, SERVO_MAX_PULSE);
}

// Преобразование длины импульса в угол
uint8_t pulseToAngle(uint16_t pulse) {
    if (pulse < SERVO_MIN_PULSE) return 0;
    if (pulse > SERVO_MAX_PULSE) return 180;
    return map(pulse, SERVO_MIN_PULSE, SERVO_MAX_PULSE, 0, 180);
}

void setServoAngle(uint8_t channel, uint8_t angle) {
    if (!servo_initialized || channel >= MAX_SERVOS) return;
    
    if (angle > 180) angle = 180;
    
    current_angles[channel] = angle;
    servo_enabled[channel] = true;
    
    uint16_t pulse = angleToPulse(angle);
    setServoPulse(channel, pulse);
    
    Serial.printf("Servo %d: angle=%d, pulse=%d\n", channel, angle, pulse);
}

void setServoPulse(uint8_t channel, uint16_t pulse) {
    if (!servo_initialized || channel >= MAX_SERVOS) return;
    
    // Преобразование микросекунд в тики PCA9685
    // PCA9685 имеет 4096 тиков на период при 50Hz = 20000 мкс
    // 1 мкс = 4096 / 20000 = 0.2048 тика
    double pulselength = 4096.0 / 20000.0; // тиков на микросекунду
    uint16_t ticks = pulse * pulselength;
    
    pwm.setPWM(channel, 0, ticks);
}

void enableServo(uint8_t channel) {
    if (!servo_initialized || channel >= MAX_SERVOS) return;
    
    servo_enabled[channel] = true;
    setServoAngle(channel, current_angles[channel]);
    
    Serial.printf("Servo %d: ENABLED\n", channel);
}

void disableServo(uint8_t channel) {
    if (!servo_initialized || channel >= MAX_SERVOS) return;
    
    servo_enabled[channel] = false;
    pwm.setPWM(channel, 0, 0); // Отключаем сигнал
    
    Serial.printf("Servo %d: DISABLED\n", channel);
}

uint8_t getServoAngle(uint8_t channel) {
    if (channel >= MAX_SERVOS) return 0;
    return current_angles[channel];
}

bool isServoEnabled(uint8_t channel) {
    if (channel >= MAX_SERVOS) return false;
    return servo_enabled[channel];
}