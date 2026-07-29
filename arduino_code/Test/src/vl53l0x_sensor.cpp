#include "vl53l0x_sensor.h"
#include "config.h"

// ============================================
// КОНСТАНТЫ
// ============================================

#define TCA9548A_ADDRESS 0x70
#define TCA9548A_CHANNELS 8

#define MIN_DISTANCE_MM 30
#define OUT_OF_RANGE_VALUE 65535

#define FILTER_SIZE 5

// ============================================
// ПРОФИЛИ РЕЖИМОВ
// ============================================

static const ModeProfile MODES[MODE_COUNT] = {
    {
        "HIGH_ACCURACY",
        200000, 14, 10, 0.5f, 500, 2
    },
    {
        "PRECISION",
        66000, 14, 10, 0.3f, 1000, 5
    },
    {
        "DEFAULT",
        33000, 14, 10, 0.25f, 1200, 15
    },
    {
        "LONG_RANGE",
        33000, 18, 14, 0.1f, 2000, 40
    },
    {
        "ULTRA_LONG",
        100000, 18, 14, 0.05f, 2500, 80
    }
};

// ============================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================

static VL53L0X sensor;
static Preferences preferences;

static MeasurementMode current_mode = MODE_DEFAULT;
static bool sensor_present[TCA9548A_CHANNELS] = {false};
static bool channel_enabled[TCA9548A_CHANNELS] = {false};
static CalibrationData calibration[TCA9548A_CHANNELS];

static uint16_t filter_buffer[TCA9548A_CHANNELS][FILTER_SIZE];
static uint8_t filter_index[TCA9548A_CHANNELS] = {0};

static bool calibration_in_progress = false;
static uint8_t calibration_channel = 0;
static uint16_t calibration_near_raw = 0;
static uint16_t calibration_near_known = 0;

// ============================================
// TCA9548A МУЛЬТИПЛЕКСОР
// ============================================

static void TCA9548A_Select(uint8_t channel) {
    Wire.beginTransmission(TCA9548A_ADDRESS);
    Wire.write((channel < TCA9548A_CHANNELS) ? (1 << channel) : 0x00);
    Wire.endTransmission();
    delay(3);
}

static void TCA9548A_DisableAll() {
    Wire.beginTransmission(TCA9548A_ADDRESS);
    Wire.write(0x00);
    Wire.endTransmission();
}

static bool checkTCA9548A() {
    Wire.beginTransmission(TCA9548A_ADDRESS);
    return (Wire.endTransmission() == 0);
}

// ============================================
// NVS (СОХРАНЕНИЕ В FLASH)
// ============================================

static void loadCalibration() {
    preferences.begin("vl53_cal", true);
    
    for (uint8_t ch = 0; ch < TCA9548A_CHANNELS; ch++) {
        char key[16];
        snprintf(key, sizeof(key), "ch%d", ch);
        
        size_t len = preferences.getBytesLength(key);
        if (len == sizeof(CalibrationData)) {
            preferences.getBytes(key, &calibration[ch], sizeof(CalibrationData));
        } else {
            calibration[ch].valid = false;
            calibration[ch].scale = 1.0f;
            calibration[ch].offset = 0.0f;
        }
    }
    
    int saved_mode = preferences.getInt("mode", MODE_DEFAULT);
    if (saved_mode >= 0 && saved_mode < MODE_COUNT) {
        current_mode = (MeasurementMode)saved_mode;
    }
    
    preferences.end();
}

static void saveCalibration(uint8_t channel) {
    preferences.begin("vl53_cal", false);
    char key[16];
    snprintf(key, sizeof(key), "ch%d", channel);
    preferences.putBytes(key, &calibration[channel], sizeof(CalibrationData));
    preferences.end();
}

static void saveMode() {
    preferences.begin("vl53_cal", false);
    preferences.putInt("mode", (int)current_mode);
    preferences.end();
}

// ============================================
// ПРИМЕНЕНИЕ РЕЖИМА
// ============================================

static bool applyModeProfile() {
    const ModeProfile& profile = MODES[current_mode];
    
    sensor.setTimeout(500);
    
    if (!sensor.init()) {
        return false;
    }
    
    sensor.setAddress(0x29);
    sensor.setSignalRateLimit(profile.signal_rate_limit);
    
    sensor.setVcselPulsePeriod(VL53L0X::VcselPeriodPreRange, profile.vcsel_prerange);
    sensor.setVcselPulsePeriod(VL53L0X::VcselPeriodFinalRange, profile.vcsel_final);
    sensor.setMeasurementTimingBudget(profile.timing_budget_us);
    
    return true;
}

// ============================================
// КАЛИБРОВКА И ФИЛЬТРАЦИЯ
// ============================================

static uint16_t applyCalibration(uint8_t channel, uint16_t raw_mm) {
    if (!calibration[channel].valid || raw_mm == OUT_OF_RANGE_VALUE) {
        return raw_mm;
    }
    
    float calibrated = (float)raw_mm * calibration[channel].scale + calibration[channel].offset;
    
    const ModeProfile& profile = MODES[current_mode];
    if (calibrated < MIN_DISTANCE_MM) calibrated = MIN_DISTANCE_MM;
    if (calibrated > profile.max_range_mm) return OUT_OF_RANGE_VALUE;
    
    return (uint16_t)calibrated;
}

static uint16_t applyFilter(uint8_t channel, uint16_t new_value) {
    if (new_value == OUT_OF_RANGE_VALUE) return OUT_OF_RANGE_VALUE;
    
    filter_buffer[channel][filter_index[channel]] = new_value;
    filter_index[channel] = (filter_index[channel] + 1) % FILTER_SIZE;
    
    uint32_t sum = 0;
    uint8_t count = 0;
    for (uint8_t i = 0; i < FILTER_SIZE; i++) {
        if (filter_buffer[channel][i] != 0) {
            sum += filter_buffer[channel][i];
            count++;
        }
    }
    
    return (count > 0) ? (uint16_t)(sum / count) : new_value;
}

// ============================================
// ПУБЛИЧНЫЕ ФУНКЦИИ
// ============================================

void vl53l0xInit() {
    Serial.println("Initializing VL53L0X sensors...");
    
    Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
    Wire.setClock(400000);
    delay(100);
    
    if (!checkTCA9548A()) {
        Serial.println("ERROR: TCA9548A not found!");
        return;
    }
    Serial.println("✓ TCA9548A found");
    TCA9548A_DisableAll();
    
    loadCalibration();
    Serial.printf("✓ Loaded mode: %s\n", MODES[current_mode].name);
    
    Serial.println("\nScanning VL53L0X channels:");
    for (uint8_t channel = 0; channel < TCA9548A_CHANNELS; channel++) {
        TCA9548A_Select(channel);
        delay(20);
        
        if (applyModeProfile()) {
            sensor_present[channel] = true;
            channel_enabled[channel] = true;
            Serial.printf("  ✓ Channel %d: VL53L0X found", channel);
            if (calibration[channel].valid) Serial.print(" [CALIBRATED]");
            Serial.println();
            
            memset(filter_buffer[channel], 0, sizeof(filter_buffer[channel]));
            filter_index[channel] = 0;
        } else {
            sensor_present[channel] = false;
            channel_enabled[channel] = false;
            Serial.printf("  ✗ Channel %d: No device\n", channel);
        }
        
        TCA9548A_DisableAll();
        delay(5);
    }
    
    Serial.printf("\n✓ VL53L0X initialized: %d sensors found\n\n", 
                  vl53l0xGetChannelCount());
}

void vl53l0xLoop() {
    // Внутренняя логика датчиков (если нужна)
    // Сейчас вся публикация в mqtt_handle.cpp
}

bool vl53l0xSetMode(MeasurementMode mode) {
    if (mode < 0 || mode >= MODE_COUNT) {
        Serial.printf("ERROR: Invalid mode %d\n", mode);
        return false;
    }
    
    current_mode = mode;
    saveMode();
    
    const ModeProfile& profile = MODES[current_mode];
    Serial.printf("✓ Mode changed to: %s (max %d mm)\n", 
                  profile.name, profile.max_range_mm);
    
    return true;
}

MeasurementMode vl53l0xGetMode() {
    return current_mode;
}

const ModeProfile* vl53l0xGetModeProfile() {
    return &MODES[current_mode];
}

uint16_t vl53l0xReadDistance(uint8_t channel) {
    if (channel >= TCA9548A_CHANNELS || !sensor_present[channel] || !channel_enabled[channel]) {
        return OUT_OF_RANGE_VALUE;
    }
    
    TCA9548A_Select(channel);
    
    if (!applyModeProfile()) {
        TCA9548A_DisableAll();
        return OUT_OF_RANGE_VALUE;
    }
    
    uint16_t distance = sensor.readRangeSingleMillimeters();
    bool timeout = sensor.timeoutOccurred();
    
    TCA9548A_DisableAll();
    
    if (distance == 65535 || timeout) return OUT_OF_RANGE_VALUE;
    
    const ModeProfile& profile = MODES[current_mode];
    if (distance < MIN_DISTANCE_MM || distance > profile.max_range_mm) {
        return OUT_OF_RANGE_VALUE;
    }
    
    uint16_t filtered = applyFilter(channel, distance);
    uint16_t calibrated = applyCalibration(channel, filtered);
    
    return calibrated;
}

uint16_t vl53l0xReadRawDistance(uint8_t channel) {
    if (channel >= TCA9548A_CHANNELS || !sensor_present[channel] || !channel_enabled[channel]) {
        return OUT_OF_RANGE_VALUE;
    }
    
    TCA9548A_Select(channel);
    
    if (!applyModeProfile()) {
        TCA9548A_DisableAll();
        return OUT_OF_RANGE_VALUE;
    }
    
    uint16_t distance = sensor.readRangeSingleMillimeters();
    bool timeout = sensor.timeoutOccurred();
    
    TCA9548A_DisableAll();
    
    if (distance == 65535 || timeout) return OUT_OF_RANGE_VALUE;
    
    return distance;
}

bool vl53l0xIsChannelActive(uint8_t channel) {
    return (channel < TCA9548A_CHANNELS && sensor_present[channel] && channel_enabled[channel]);
}

int vl53l0xGetChannelCount() {
    int count = 0;
    for (uint8_t i = 0; i < TCA9548A_CHANNELS; i++) {
        if (sensor_present[i]) count++;
    }
    return count;
}

bool vl53l0xStartCalibration(uint8_t channel, uint16_t near_known_mm) {
    if (channel >= TCA9548A_CHANNELS || !sensor_present[channel]) {
        Serial.printf("ERROR: Channel %d not available\n", channel);
        return false;
    }
    
    Serial.printf("Starting calibration for channel %d (near point: %d mm)\n", 
                  channel, near_known_mm);
    
    uint32_t sum = 0;
    uint8_t valid = 0;
    
    for (uint8_t i = 0; i < 20; i++) {
        uint16_t d = vl53l0xReadRawDistance(channel);
        if (d != OUT_OF_RANGE_VALUE) {
            sum += d;
            valid++;
        }
        delay(50);
    }
    
    if (valid == 0) {
        Serial.println("ERROR: Failed to read near point");
        return false;
    }
    
    calibration_near_raw = (uint16_t)(sum / valid);
    calibration_near_known = near_known_mm;
    calibration_channel = channel;
    calibration_in_progress = true;
    
    Serial.printf("✓ Near point captured: raw=%d mm, actual=%d mm\n", 
                  calibration_near_raw, calibration_near_known);
    Serial.println("Now place object at FAR point and call vl53l0xFinishCalibration()");
    
    return true;
}

bool vl53l0xFinishCalibration(uint8_t channel, uint16_t far_known_mm) {
    if (!calibration_in_progress || channel != calibration_channel) {
        Serial.println("ERROR: Calibration not in progress or wrong channel");
        return false;
    }
    
    Serial.printf("Finishing calibration for channel %d (far point: %d mm)\n", 
                  channel, far_known_mm);
    
    uint32_t sum = 0;
    uint8_t valid = 0;
    
    for (uint8_t i = 0; i < 20; i++) {
        uint16_t d = vl53l0xReadRawDistance(channel);
        if (d != OUT_OF_RANGE_VALUE) {
            sum += d;
            valid++;
        }
        delay(50);
    }
    
    if (valid == 0) {
        Serial.println("ERROR: Failed to read far point");
        calibration_in_progress = false;
        return false;
    }
    
    uint16_t far_raw = (uint16_t)(sum / valid);
    
    Serial.printf("✓ Far point captured: raw=%d mm, actual=%d mm\n", 
                  far_raw, far_known_mm);
    
    if (far_raw == calibration_near_raw) {
        Serial.println("ERROR: Raw values are identical");
        calibration_in_progress = false;
        return false;
    }
    
    float scale = (float)(far_known_mm - calibration_near_known) / 
                  (float)(far_raw - calibration_near_raw);
    float offset = (float)calibration_near_known - 
                   (float)calibration_near_raw * scale;
    
    calibration[channel].valid = true;
    calibration[channel].near_raw = calibration_near_raw;
    calibration[channel].near_known = calibration_near_known;
    calibration[channel].far_raw = far_raw;
    calibration[channel].far_known = far_known_mm;
    calibration[channel].scale = scale;
    calibration[channel].offset = offset;
    
    saveCalibration(channel);
    
    Serial.printf("✓ Calibration complete: scale=%.5f, offset=%.2f\n", scale, offset);
    
    calibration_in_progress = false;
    
    return true;
}

void vl53l0xClearCalibration(uint8_t channel) {
    if (channel >= TCA9548A_CHANNELS) return;
    
    calibration[channel].valid = false;
    calibration[channel].scale = 1.0f;
    calibration[channel].offset = 0.0f;
    saveCalibration(channel);
    
    Serial.printf("✓ Channel %d calibration cleared\n", channel);
}

bool vl53l0xIsCalibrated(uint8_t channel) {
    return (channel < TCA9548A_CHANNELS && calibration[channel].valid);
}

CalibrationData vl53l0xGetCalibration(uint8_t channel) {
    if (channel >= TCA9548A_CHANNELS) {
        CalibrationData empty = {false, 0, 0, 0, 0, 1.0f, 0.0f};
        return empty;
    }
    return calibration[channel];
}

void vl53l0xEnableChannel(uint8_t channel, bool enable) {
    if (channel >= TCA9548A_CHANNELS) return;
    
    if (!sensor_present[channel]) {
        Serial.printf("ERROR: Channel %d not present\n", channel);
        return;
    }
    
    channel_enabled[channel] = enable;
    Serial.printf("✓ Channel %d %s\n", channel, enable ? "enabled" : "disabled");
}

bool vl53l0xIsChannelEnabled(uint8_t channel) {
    return (channel < TCA9548A_CHANNELS && channel_enabled[channel]);
}

bool vl53l0xIsChannelPresent(uint8_t channel) {
    return (channel < TCA9548A_CHANNELS && sensor_present[channel]);
}

void sensorTask(void *parameter) {
    vl53l0xInit();
    
    for (;;) {
        vl53l0xLoop();
        vTaskDelay(pdMS_TO_TICKS(50));
    }
}