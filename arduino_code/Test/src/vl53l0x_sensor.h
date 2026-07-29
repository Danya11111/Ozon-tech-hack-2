#ifndef VL53L0X_SENSOR_H
#define VL53L0X_SENSOR_H

#include <Arduino.h>
#include <VL53L0X.h>
#include <Wire.h>
#include <Preferences.h>

// Режимы измерения
enum MeasurementMode {
    MODE_HIGH_ACCURACY = 0,
    MODE_PRECISION = 1,
    MODE_DEFAULT = 2,
    MODE_LONG_RANGE = 3,
    MODE_ULTRA_LONG = 4,
    MODE_COUNT = 5
};

struct ModeProfile {
    const char* name;
    uint32_t timing_budget_us;
    uint8_t vcsel_prerange;
    uint8_t vcsel_final;
    float signal_rate_limit;
    uint16_t max_range_mm;
    uint8_t accuracy_mm;
};

struct CalibrationData {
    bool valid;
    uint16_t near_raw;
    uint16_t near_known;
    uint16_t far_raw;
    uint16_t far_known;
    float scale;
    float offset;
};

// Инициализация и цикл
void vl53l0xInit();
void vl53l0xLoop();

// Управление режимами
bool vl53l0xSetMode(MeasurementMode mode);
MeasurementMode vl53l0xGetMode();
const ModeProfile* vl53l0xGetModeProfile();

// Чтение данных
uint16_t vl53l0xReadDistance(uint8_t channel);
uint16_t vl53l0xReadRawDistance(uint8_t channel);
bool vl53l0xIsChannelActive(uint8_t channel);
int vl53l0xGetChannelCount();

// Калибровка
bool vl53l0xStartCalibration(uint8_t channel, uint16_t near_known_mm);
bool vl53l0xFinishCalibration(uint8_t channel, uint16_t far_known_mm);
void vl53l0xClearCalibration(uint8_t channel);
bool vl53l0xIsCalibrated(uint8_t channel);
CalibrationData vl53l0xGetCalibration(uint8_t channel);

// Управление каналами
void vl53l0xEnableChannel(uint8_t channel, bool enable);
bool vl53l0xIsChannelEnabled(uint8_t channel);
bool vl53l0xIsChannelPresent(uint8_t channel);

void sensorTask(void *parameter);

#endif // VL53L0X_SENSOR_H