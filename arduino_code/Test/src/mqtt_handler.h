#ifndef MQTT_HANDLER_H
#define MQTT_HANDLER_H

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>

void mqttTask(void *parameter);
void handleServoMQTTCommand(const char* topic, const char* payload);

#endif