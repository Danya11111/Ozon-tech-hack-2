#include <Arduino.h>
#include <TMC2209.h>
#include "config.h"
#include "motor.h"
#include "vl53l0x_sensor.h"
#include "mqtt_handler.h"

void setup() {
    Serial.begin(115200);
    
    // Инициализация мотора (Core 1 context initially)
    motorInit();

    xTaskCreatePinnedToCore(
        sensorTask, 
        "SensorTask", 
        4096, 
        NULL, 
        1, 
        NULL, 
        0
    );

    // Запуск задачи MQTT на Core 0
    xTaskCreatePinnedToCore(
        mqttTask,
        "MQTT_Task",
        20480,
        NULL,
        3,
        NULL,
        0 // CORE 0
    );

    Serial.println("System Initialized. Multi-core ready.");
}

void loop() {
    // Loop выполняется на Core 1
    motorLoop();
    vTaskDelay(pdMS_TO_TICKS(5));
}