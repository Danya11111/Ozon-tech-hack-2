#ifndef MOTOR_H
#define MOTOR_H

#include <Arduino.h>
#include <TMC2209.h>

void motorInit();
void motorLoop();

// Управление движением (через UART VACTUAL)
void setTargetRPM(int rpm); // Поддерживает отрицательные значения для реверса!
void resetSteps();

// Геттеры состояния движения
unsigned long getMotorSteps(); // Считается программно
int getCurrentRPM();
bool isMotorRunning();

// Управление TMC2209 через UART
void tmcSetCurrentPercent(uint8_t run_percent, uint8_t hold_percent);
void tmcSetMicrosteps(uint16_t ms);
void tmcSetStallGuard(uint8_t threshold);
void tmcSoftwareEnable(bool enable); // Вкл/Выкл драйвер программно
void tmcSetStealthChop(bool enable);
void tmcSetCoolStep(bool enable);

// Расширенная телеметрия
bool tmcIsInitialized();
bool tmcIsCommunicating();
uint16_t tmcGetMicrostepsSetting();
uint8_t tmcGetRunCurrentPercent();

// Структуры статусов для MQTT
TMC2209::Status tmcGetStatus();
TMC2209::Settings tmcGetSettings();
uint16_t tmcGetStallGuardResult();
uint32_t tmcGetInterstepDuration();
uint16_t tmcGetMicrostepCounter();
bool checkDriverStatus();
bool checkTmcSoftwareEnable();

#endif