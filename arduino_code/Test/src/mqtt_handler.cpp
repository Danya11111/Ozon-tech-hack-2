#include "mqtt_handler.h"
#include "config.h"
#include "motor.h"
#include "servo_control.h"
#include "vl53l0x_sensor.h"

static WiFiClient espClient;
static PubSubClient client(espClient);

// Кэш телеметрии
static unsigned long last_feedback_time = 0;
static int last_pub_rpm = -1;
static unsigned long last_pub_steps = -1;
static int last_pub_is_run = -1;

// TMC Кэш
static uint16_t last_pub_sg = 65535;
static uint32_t last_pub_interstep = 0;
static uint8_t last_pub_current_pct = 255;
static uint16_t last_pub_microsteps = 0;

// Статусы (битовые флаги)
static int last_pub_over_temp = -1;
static int last_pub_short_gnd = -1;
static int last_pub_open_load = -1;
static int last_pub_stealth_active = -1;
static int last_pub_standstill = -1;
static int last_pub_driver_status = -1;
static int last_pub_tmc_software_enable = -1;
static uint8_t last_pub_current_scaling = 255;

// ============================================
// КЭШИРОВАНИЕ ДЛЯ VL53L0X
// ============================================

#define VL53L0X_MAX_CHANNELS 8
static uint16_t last_pub_vl53_distance[VL53L0X_MAX_CHANNELS] = {65535};
static uint16_t last_pub_vl53_raw[VL53L0X_MAX_CHANNELS] = {65535};
static int last_pub_vl53_status[VL53L0X_MAX_CHANNELS] = {-1};
static int last_pub_vl53_calibrated[VL53L0X_MAX_CHANNELS] = {-1};
static MeasurementMode last_pub_vl53_mode = MODE_COUNT;

// ============================================
// БУФЕРЫ ДЛЯ ПРЕОБРАЗОВАНИЯ
// ============================================

static char int_buffer[16];
static char uint_buffer[16];

static const char* intToString(int value) {
    snprintf(int_buffer, sizeof(int_buffer), "%d", value);
    return int_buffer;
}

static const char* uintToString(unsigned long value) {
    snprintf(uint_buffer, sizeof(uint_buffer), "%lu", value);
    return uint_buffer;
}

// ============================================
// WIFI И MQTT ПОДКЛЮЧЕНИЕ
// ============================================

static void setup_wifi() {
    Serial.print("Connecting to WiFi");
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    while (WiFi.status() != WL_CONNECTED) { 
        vTaskDelay(pdMS_TO_TICKS(500)); 
        Serial.print("."); 
    }
    Serial.println("\nWiFi Connected");
}

static void resetAllCaches() {
    // Motor
    last_pub_rpm = -1; 
    last_pub_steps = (unsigned long)-1; 
    last_pub_is_run = -1;
    last_pub_sg = 65535; 
    last_pub_interstep = 0; 
    last_pub_current_pct = 255;
    last_pub_microsteps = 0; 
    last_pub_over_temp = -1; 
    last_pub_short_gnd = -1;
    last_pub_open_load = -1; 
    last_pub_stealth_active = -1; 
    last_pub_standstill = -1;
    last_pub_current_scaling = 255;
    last_pub_driver_status = -1;
    last_pub_tmc_software_enable = -1;
    
    // VL53L0X
    for (int i = 0; i < VL53L0X_MAX_CHANNELS; i++) {
        last_pub_vl53_distance[i] = 65535;
        last_pub_vl53_raw[i] = 65535;
        last_pub_vl53_status[i] = -1;
        last_pub_vl53_calibrated[i] = -1;
    }
    last_pub_vl53_mode = MODE_COUNT;
}

static void subscribeToAllTopics() {
    // Motor
    client.subscribe("motor/control/rpm");
    client.subscribe("motor/control/driver");
    client.subscribe("motor/control/totalsteps/reset");
    client.subscribe("motor/control/tmc/current_percent");
    client.subscribe("motor/control/tmc/microsteps");
    client.subscribe("motor/control/tmc/stallguard");
    client.subscribe("motor/control/tmc/enable");
    client.subscribe("motor/control/tmc/stealthchop");
    client.subscribe("motor/control/tmc/coolstep");

    // Servo
    client.subscribe("servo/control/+/#");
    
    // VL53L0X
    client.subscribe("sensor/control/mode");
    client.subscribe("sensor/control/mode_name");
    client.subscribe("sensor/control/calibrate/start/+");
    client.subscribe("sensor/control/calibrate/finish/+");
    client.subscribe("sensor/control/clear_cal/+");
    client.subscribe("sensor/control/enable/+");
    client.subscribe("sensor/control/publish_all");
}

static void reconnect() {
    while (!client.connected()) {
        if (client.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASS)) {
            resetAllCaches();
            subscribeToAllTopics();
            Serial.println("MQTT Connected and subscribed");
        } else {
            Serial.printf("MQTT connection failed, rc=%d, retrying...\n", client.state());
            vTaskDelay(pdMS_TO_TICKS(5000));
        }
    }
}

// ============================================
// ОБРАБОТКА ВХОДЯЩИХ MQTT КОМАНД
// ============================================
static void callback(char* topic, byte* payload, unsigned int length) {
    char msg[length + 1];
    memcpy(msg, payload, length);
    msg[length] = '\0';

    if (strcmp(topic, "motor/control/rpm") == 0) {
        setTargetRPM(atoi(msg)); // Поддерживает отрицательные для реверса!
    }
    else if (strcmp(topic, "motor/control/driver") == 0) {
        // TMC2209: LOW = Enabled, HIGH = Disabled
        bool enable = (strcmp(msg, "on") == 0);
        digitalWrite(EN_PIN, enable ? LOW : HIGH);
    }
    else if (strcmp(topic, "motor/control/totalsteps/reset") == 0) {
        resetSteps();
        if (client.connected()) client.publish("motor/feedback/totalsteps", "0");
        last_pub_steps = 0;
    }
    // --- TMC Control ---
    else if (strcmp(topic, "motor/control/tmc/current_percent") == 0) {
        uint8_t pct = atoi(msg);
        if (pct <= 100) tmcSetCurrentPercent(pct, pct / 2); // Hold = 50% от Run
    }
    else if (strcmp(topic, "motor/control/tmc/microsteps") == 0) {
        uint16_t ms = atoi(msg);
        tmcSetMicrosteps(ms);
    }
    else if (strcmp(topic, "motor/control/tmc/stallguard") == 0) {
        tmcSetStallGuard(atoi(msg));
    }
    else if (strcmp(topic, "motor/control/tmc/enable") == 0) {
        tmcSoftwareEnable(strcmp(msg, "on") == 0);
    }
    else if (strcmp(topic, "motor/control/tmc/stealthchop") == 0) {
        tmcSetStealthChop(strcmp(msg, "on") == 0);
    }
    else if (strcmp(topic, "motor/control/tmc/coolstep") == 0) {
        tmcSetCoolStep(strcmp(msg, "on") == 0);
    } 
    else if (strncmp(topic, "servo/control", 12) == 0) {
        handleServoMQTTCommand(topic, msg);
    }
    // === VL53L0X ===
    else if (strcmp(topic, "sensor/control/mode") == 0) {
        int mode = atoi(msg);
        if (mode >= 0 && mode < MODE_COUNT) {
            vl53l0xSetMode((MeasurementMode)mode);
        }
    }
    else if (strcmp(topic, "sensor/control/mode_name") == 0) {
        // Маппинг имени режима на ID (если нужно)
        // Пока просто логируем
        Serial.printf("Mode name request: %s\n", msg);
    }
    else if (strncmp(topic, "sensor/control/calibrate/start/", 31) == 0) {
        int channel = atoi(topic + 31);
        int near_mm = atoi(msg);
        if (channel >= 0 && channel < VL53L0X_MAX_CHANNELS && near_mm > 0) {
            vl53l0xStartCalibration(channel, near_mm);
        }
    }
    else if (strncmp(topic, "sensor/control/calibrate/finish/", 32) == 0) {
        int channel = atoi(topic + 32);
        int far_mm = atoi(msg);
        if (channel >= 0 && channel < VL53L0X_MAX_CHANNELS && far_mm > 0) {
            vl53l0xFinishCalibration(channel, far_mm);
        }
    }
    else if (strncmp(topic, "sensor/control/clear_cal/", 25) == 0) {
        int channel = atoi(topic + 25);
        if (channel >= 0 && channel < VL53L0X_MAX_CHANNELS) {
            vl53l0xClearCalibration(channel);
        }
    }
    else if (strncmp(topic, "sensor/control/enable/", 22) == 0) {
        int channel = atoi(topic + 22);
        bool enable = (strcmp(msg, "on") == 0 || strcmp(msg, "1") == 0 || strcmp(msg, "true") == 0);
        if (channel >= 0 && channel < VL53L0X_MAX_CHANNELS) {
            vl53l0xEnableChannel(channel, enable);
        }
    }
    else if (strcmp(topic, "sensor/control/publish_all") == 0) {
        // Сбрасываем кэш для принудительной публикации
        for (int i = 0; i < VL53L0X_MAX_CHANNELS; i++) {
            last_pub_vl53_distance[i] = 65535;
            last_pub_vl53_raw[i] = 65535;
        }
    }
}

// ============================================
// ПУБЛИКАЦИЯ MOTOR TELEMETRY
// ============================================

static void publishMotorTelemetry() {
    // RPM
    int rpm = getCurrentRPM();
    if (rpm != last_pub_rpm) {
        client.publish("motor/feedback/rpm", intToString(rpm));
        last_pub_rpm = rpm;
    }

    // Steps
    unsigned long steps = getMotorSteps();
    if (steps != last_pub_steps) {
        client.publish("motor/feedback/totalsteps", uintToString(steps));
        last_pub_steps = steps;
    }

    // Is running
    int run = isMotorRunning() ? 1 : 0;
    if (run != last_pub_is_run) {
        client.publish("motor/feedback/is_run", run ? "true" : "false");
        last_pub_is_run = run;
    }

    // TMC
    if (tmcIsInitialized()) {
        uint8_t pct = tmcGetRunCurrentPercent();
        if (pct != last_pub_current_pct) {
            client.publish("motor/feedback/tmc/current_percent", intToString(pct));
            last_pub_current_pct = pct;
        }

        uint16_t ms = tmcGetMicrostepsSetting();
        if (ms != last_pub_microsteps) {
            client.publish("motor/feedback/tmc/microsteps", intToString(ms));
            last_pub_microsteps = ms;
        }

        uint16_t sg = tmcGetStallGuardResult();
        if (sg != last_pub_sg) {
            client.publish("motor/feedback/tmc/sg_result", intToString(sg));
            last_pub_sg = sg;
        }

        uint32_t interstep = tmcGetInterstepDuration();
        if (interstep != last_pub_interstep) {
            client.publish("motor/feedback/tmc/interstep_duration", uintToString(interstep));
            last_pub_interstep = interstep;
        }

        TMC2209::Status status = tmcGetStatus();
        
        int ot = (status.over_temperature_warning || status.over_temperature_shutdown) ? 1 : 0;
        if (ot != last_pub_over_temp) {
            client.publish("motor/feedback/tmc/status/over_temp", ot ? "true" : "false");
            last_pub_over_temp = ot;
        }

        int sgnd = (status.short_to_ground_a || status.short_to_ground_b) ? 1 : 0;
        if (sgnd != last_pub_short_gnd) {
            client.publish("motor/feedback/tmc/status/short_to_ground", sgnd ? "true" : "false");
            last_pub_short_gnd = sgnd;
        }

        int ol = (status.open_load_a || status.open_load_b) ? 1 : 0;
        if (ol != last_pub_open_load) {
            client.publish("motor/feedback/tmc/status/open_load", ol ? "true" : "false");
            last_pub_open_load = ol;
        }

        int sa = status.stealth_chop_mode ? 1 : 0;
        if (sa != last_pub_stealth_active) {
            client.publish("motor/feedback/tmc/status/stealth_chop_active", sa ? "true" : "false");
            last_pub_stealth_active = sa;
        }

        int ss = status.standstill ? 1 : 0;
        if (ss != last_pub_standstill) {
            client.publish("motor/feedback/tmc/status/standstill", ss ? "true" : "false");
            last_pub_standstill = ss;
        }

        if (status.current_scaling != last_pub_current_scaling) {
            client.publish("motor/feedback/tmc/status/current_scaling", intToString(status.current_scaling));
            last_pub_current_scaling = status.current_scaling;
        }

        int cds = checkDriverStatus() ? 1 : 0;
        if (cds != last_pub_driver_status) {
            client.publish("motor/feedback/driver/status", cds ? "on" : "off");
            last_pub_driver_status = cds;
        }
        
        int tse = checkTmcSoftwareEnable() ? 1 : 0;
        if (tse != last_pub_tmc_software_enable) {
            client.publish("motor/feedback/tmc/status", tse ? "on" : "off");
            last_pub_tmc_software_enable = tse;
        }
    }
}

// ============================================
// ПУБЛИКАЦИЯ VL53L0X TELEMETRY
// ============================================

static void publishVL53L0XTelemetry() {
    // Публикация режима
    MeasurementMode current_mode = vl53l0xGetMode();
    if (current_mode != last_pub_vl53_mode) {
        const ModeProfile* profile = vl53l0xGetModeProfile();
        
        client.publish("sensor/feedback/mode", profile->name);
        client.publish("sensor/feedback/mode_id", intToString(current_mode));
        client.publish("sensor/feedback/max_range", intToString(profile->max_range_mm));
        
        last_pub_vl53_mode = current_mode;
    }
    
    // Публикация данных с каждого канала
    for (uint8_t ch = 0; ch < VL53L0X_MAX_CHANNELS; ch++) {
        if (!vl53l0xIsChannelPresent(ch)) continue;
        
        char topic[64];
        
        // Статус канала
        int status = vl53l0xIsChannelEnabled(ch) ? 1 : 0;
        if (status != last_pub_vl53_status[ch]) {
            snprintf(topic, sizeof(topic), "sensor/feedback/%d/status", ch);
            client.publish(topic, status ? "on" : "off");
            last_pub_vl53_status[ch] = status;
        }
        
        // Статус калибровки
        int calibrated = vl53l0xIsCalibrated(ch) ? 1 : 0;
        if (calibrated != last_pub_vl53_calibrated[ch]) {
            snprintf(topic, sizeof(topic), "sensor/feedback/%d/calibrated", ch);
            client.publish(topic, calibrated ? "true" : "false");
            last_pub_vl53_calibrated[ch] = calibrated;
        }
        
        // Только если канал активен, публикуем расстояния
        if (vl53l0xIsChannelActive(ch)) {
            // Калиброванное расстояние
            uint16_t distance = vl53l0xReadDistance(ch);
            if (distance != last_pub_vl53_distance[ch]) {
                snprintf(topic, sizeof(topic), "sensor/feedback/%d/distance", ch);
                if (distance != 65535) {
                    client.publish(topic, intToString(distance));
                } else {
                    client.publish(topic, "out_of_range");
                }
                last_pub_vl53_distance[ch] = distance;
            }
            
            // Сырое значение
            uint16_t raw = vl53l0xReadRawDistance(ch);
            if (raw != last_pub_vl53_raw[ch]) {
                snprintf(topic, sizeof(topic), "sensor/feedback/%d/raw", ch);
                if (raw != 65535) {
                    client.publish(topic, intToString(raw));
                }
                last_pub_vl53_raw[ch] = raw;
            }
        }
    }
}

/////

void checkAndPublishServoStatus(uint8_t channel) {
    if (channel >= MAX_SERVOS) return;
    
    bool current_state = servo_enabled[channel];
    if (current_state != last_published_status[channel]) {
        last_published_status[channel] = current_state;
        
        char topic[64];
        snprintf(topic, sizeof(topic), "servo/%d/feedback/status", channel);
        
        String status = current_state ? "on" : "off";
        client.publish(topic, status.c_str());
        
        Serial.printf("Published servo %d status: %s\n", channel, status.c_str());
    }
}

void checkAndPublishServoAngle(uint8_t channel) {
    if (channel >= MAX_SERVOS) return;
    
    uint8_t current_angle = current_angles[channel];
    if (current_angle != last_published_angles[channel]) {
        last_published_angles[channel] = current_angle;
        
        char topic[64];
        snprintf(topic, sizeof(topic), "servo/%d/feedback/angle", channel);
        
        char payload[8];
        snprintf(payload, sizeof(payload), "%d", current_angle);
        client.publish(topic, payload);
        
        Serial.printf("Published servo %d angle: %d\n", channel, current_angle);
    }
}

void handleServoMQTTCommand(const char* topic, const char* payload) {
    // Парсим топик: servo/control/{channel}/{command}
    int channel = -1;
    char command[32] = {0};
    
    if (sscanf(topic, "servo/control/%2d/%8s", &channel, command) != 2) {
        Serial.printf("Invalid servo topic: %s\n", topic);
        return;
    }
    
    if (channel < 0 || channel >= MAX_SERVOS) {
        Serial.printf("Invalid servo channel: %d\n", channel);
        return;
    }
    
    Serial.printf("Servo %d command: %s = %s\n", channel, command, payload);
    
    if (strcmp(command, "angle") == 0) {
        int angle = atoi(payload);
        if (angle >= 0 && angle <= 180) {
            setServoAngle(channel, (uint8_t)angle);
            checkAndPublishServoAngle(channel);
            checkAndPublishServoStatus(channel);
        }
    }
    else if (strcmp(command, "enable") == 0) {
        bool enable = (strcmp(payload, "on") == 0 || strcmp(payload, "1") == 0 || strcmp(payload, "true") == 0);
        if (enable) {
            enableServo(channel);
        } else {
            disableServo(channel);
        }
        checkAndPublishServoStatus(channel);
    }
}

/////

// ============================================
// ГЛАВНЫЙ ЦИКЛ ПУБЛИКАЦИИ
// ============================================

static void publishTelemetry() {
    unsigned long now = millis();
    if (now - last_feedback_time >= 500) {
        publishMotorTelemetry();
        publishVL53L0XTelemetry();
        last_feedback_time = now;
    }
}

void mqttTask(void *parameter) {
    static unsigned long last_stack_check = 0;

    setup_wifi();
    client.setServer(MQTT_SERVER, MQTT_PORT);
    client.setCallback(callback);

    servoInit();

    for (;;) {
        if (!client.connected()) reconnect();
        client.loop();
        publishTelemetry();

        vTaskDelay(pdMS_TO_TICKS(10));
    }
}