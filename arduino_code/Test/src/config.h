#ifndef CONFIG_H
#define CONFIG_H

#include <stdint.h>
#include <Arduino.h>

// WiFi & MQTT
extern const char* WIFI_SSID;
extern const char* WIFI_PASS;
extern const char* MQTT_SERVER;
extern const int MQTT_PORT;
extern const char* MQTT_USER;
extern const char* MQTT_PASS;
extern const char* MQTT_CLIENT_ID;

// UART for TMC2209
extern HardwareSerial& TMC_SERIAL;
extern const uint32_t TMC_BAUD_RATE;
extern const uint8_t TMC_SERIAL_ADDRESS; // Адрес драйвера (0-3)
extern const int16_t TMC_RX_PIN;
extern const int16_t TMC_TX_PIN;
extern const int EN_PIN;

// Motor Params
extern const int STEPS_PER_REVOLUTION; // Базовые шаги мотора (обычно 200)
extern const unsigned long RAMP_DURATION_MS;

// TMC2209 Defaults (Токи в процентах 0-100%)
extern const uint8_t TMC_RUN_CURRENT_PERCENT;   
extern const uint8_t TMC_HOLD_CURRENT_PERCENT;  
extern const uint8_t TMC_STALL_GUARD_THRESH;    
extern const uint16_t TMC_MICROSTEPS;          

// I2C Настройка
extern const int16_t I2C_SDA_PIN;
extern const int16_t I2C_SCL_PIN;

#endif