#ifndef SERVO_H
#define SERVO_H

#include <Arduino.h>
#include <Adafruit_PWMServoDriver.h>


// Хранение текущего состояния сервоприводов
#define MAX_SERVOS 16
static uint8_t current_angles[MAX_SERVOS] = {0};
static bool servo_enabled[MAX_SERVOS] = {false};
static uint8_t last_published_angles[MAX_SERVOS] = {255};
static bool last_published_status[MAX_SERVOS] = {false};

// Минимальная и максимальная длина импульса для сервопривода (в микросекундах)
static const uint16_t SERVO_MIN_PULSE = 600;
static const uint16_t SERVO_MAX_PULSE = 2400;

// Инициализация сервопривода
void servoInit();

// Управление сервоприводом
void setServoAngle(uint8_t channel, uint8_t angle);
void setServoPulse(uint8_t channel, uint16_t pulse);
void enableServo(uint8_t channel);
void disableServo(uint8_t channel);

// Получение состояния
uint8_t getServoAngle(uint8_t channel);
bool isServoEnabled(uint8_t channel);

#endif // SERVO_H