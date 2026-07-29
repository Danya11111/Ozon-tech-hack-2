#include "config.h"

const char* WIFI_SSID = "TP-Link_3E5C";
const char* WIFI_PASS = "12697571";
const char* MQTT_SERVER = "192.168.0.200";
const int MQTT_PORT = 1883;
const char* MQTT_USER = "test";
const char* MQTT_PASS = "1234";
const char* MQTT_CLIENT_ID = "ESP32_Stepper";

// UART2: RX=16, TX=17
HardwareSerial& TMC_SERIAL = Serial2;
const uint32_t TMC_BAUD_RATE = 115200;
const uint8_t TMC_SERIAL_ADDRESS = 0; // Если MS1 и MS2 на GND

const int16_t TMC_RX_PIN = 16;
const int16_t TMC_TX_PIN = 17;
const int EN_PIN = 18;

const int STEPS_PER_REVOLUTION = 200;
const unsigned long RAMP_DURATION_MS = 2000;

// Ток задается в процентах от максимума (зависит от R_sense). 
// Для R_sense=0.11 Ом, 100% ~ 1.77А RMS. Для R_sense=0.15 Ом, 100% ~ 1.2А RMS.
const uint8_t TMC_RUN_CURRENT_PERCENT = 50;   // 50% тока при движении
const uint8_t TMC_HOLD_CURRENT_PERCENT = 20;  // 20% тока в простое
const uint8_t TMC_STALL_GUARD_THRESH = 10;    
const uint16_t TMC_MICROSTEPS = 1;           

// I2C Настройка
const int16_t I2C_SDA_PIN = 21;
const int16_t I2C_SCL_PIN = 22;


// ========== SERVO CONFIGURATION ==========
#define SERVO_DEFAULT_CHANNEL 0
#define SERVO_MIN_ANGLE 0
#define SERVO_MAX_ANGLE 180