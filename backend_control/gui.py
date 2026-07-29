import customtkinter as ctk
import paho.mqtt.client as mqtt

# ================= НАСТРОЙКИ =================
MQTT_BROKER = "192.168.0.200"
MQTT_PORT = 1883
MQTT_USER = "test"
MQTT_PASSWORD = "1234"

MAX_SERVOS = 4 
MAX_SENSORS = 8  # Количество каналов VL53L0X

# Цвета
COLOR_OK = "#28a745"
COLOR_ERR = "#dc3545"
COLOR_OFF = "#555555"
COLOR_ACTIVE = "#00d2ff"
COLOR_PENDING = "#ffaa00"
COLOR_WARN = "#ff9900" # Для out_of_range

class MotorSCADA:
    def __init__(self):
        ctk.set_appearance_mode("Dark")
        ctk.set_default_color_theme("blue")
        
        self.root = ctk.CTk()
        self.root.title("🚀 Motor, Servo & Sensor SCADA")
        self.root.geometry("1200x900")
        self.root.minsize(1100, 800)
        
        # Флаги ожидания
        self.driver_pending = False
        self.tmc_pending = False
        self.servo_pending = {i: False for i in range(MAX_SERVOS)}
        self.sensor_pending = {i: False for i in range(MAX_SENSORS)}
        
        self.setup_gui()
        self.setup_mqtt()
        
    def setup_gui(self):
        # --- Шапка ---
        header = ctk.CTkFrame(self.root, height=60)
        header.pack(fill="x", padx=20, pady=(20, 10))
        header.pack_propagate(False)
        ctk.CTkLabel(header, text="Motor, Servo & Sensor SCADA", font=ctk.CTkFont(size=24, weight="bold")).pack(side="left", padx=20)
        self.lbl_status = ctk.CTkLabel(header, text="● Отключено", text_color=COLOR_ERR, font=ctk.CTkFont(size=16, weight="bold"))
        self.lbl_status.pack(side="right", padx=20)

        # --- Вкладки ---
        self.tabview = ctk.CTkTabview(self.root)
        self.tabview.pack(fill="both", expand=True, padx=20, pady=10)
        
        self.tab_motor = self.tabview.add("Шаговый двигатель (TMC2209)")
        self.tab_servo = self.tabview.add(f"Сервоприводы (0-{MAX_SERVOS-1})")
        self.tab_sensor = self.tabview.add(f"Датчики VL53L0X (0-{MAX_SENSORS-1})")
        
        self.create_motor_tab(self.tab_motor)
        self.create_servo_tab(self.tab_servo)
        self.create_sensor_tab(self.tab_sensor)

    # ================= ВКЛАДКА ШАГОВОГО ДВИГАТЕЛЯ =================
    # (Код для мотора остался без изменений, чтобы не раздувать ответ, 
    # но в реальном файле он должен быть здесь полностью)
    def create_motor_tab(self, parent):
        grid = ctk.CTkFrame(parent, fg_color="transparent")
        grid.pack(fill="both", expand=True)
        grid.grid_columnconfigure((0, 1, 2), weight=1, uniform="col")
        grid.grid_rowconfigure(0, weight=1)
        self.create_control_frame(grid)
        self.create_modes_frame(grid)
        self.create_telemetry_frame(grid)

    def create_control_frame(self, parent):
        frame = ctk.CTkFrame(parent)
        frame.grid(row=0, column=0, sticky="nsew", padx=(0, 10))
        ctk.CTkLabel(frame, text="⚙️ Управление", font=ctk.CTkFont(size=18, weight="bold")).pack(pady=(10, 20))
        ctk.CTkLabel(frame, text="Целевой RPM:").pack(anchor="w", padx=20)
        rpm_frame = ctk.CTkFrame(frame, fg_color="transparent")
        rpm_frame.pack(fill="x", padx=20, pady=5)
        self.sld_rpm = ctk.CTkSlider(rpm_frame, from_=-1000, to=1000, command=self.on_rpm_slider_change)
        self.sld_rpm.pack(side="left", fill="x", expand=True, padx=(0, 10))
        self.ent_rpm = ctk.CTkEntry(rpm_frame, width=80, justify="right")
        self.ent_rpm.insert(0, "0"); self.ent_rpm.pack(side="left", padx=(0, 10))
        self.ent_rpm.bind("<Return>", self.on_rpm_entry_apply); self.ent_rpm.bind("<FocusOut>", self.on_rpm_entry_apply)
        self.lbl_rpm_val = ctk.CTkLabel(rpm_frame, text="0", width=50); self.lbl_rpm_val.pack(side="right")
        
        ctk.CTkLabel(frame, text="Ток (%):").pack(anchor="w", padx=20, pady=(15,0))
        cur_frame = ctk.CTkFrame(frame, fg_color="transparent")
        cur_frame.pack(fill="x", padx=20, pady=5)
        self.sld_current = ctk.CTkSlider(cur_frame, from_=0, to=100, command=self.on_current_change)
        self.sld_current.pack(side="left", fill="x", expand=True)
        self.lbl_cur_val = ctk.CTkLabel(cur_frame, text="50", width=50); self.lbl_cur_val.pack(side="right", padx=(10, 0))
        
        ctk.CTkLabel(frame, text="StallGuard (0-255):").pack(anchor="w", padx=20, pady=(15,0))
        self.ent_sg = ctk.CTkEntry(frame, width=100); self.ent_sg.insert(0, "0")
        self.ent_sg.pack(anchor="w", padx=20, pady=5)
        ctk.CTkButton(frame, text="Применить SG", width=150, command=self.on_sg_apply).pack(pady=5)
        
        ctk.CTkLabel(frame, text="Микрошаги:").pack(anchor="w", padx=20, pady=(15,0))
        self.opt_msteps = ctk.CTkOptionMenu(frame, values=["1", "2", "4", "8", "16", "32", "64", "128", "256"], command=self.on_msteps_change)
        self.opt_msteps.set("16"); self.opt_msteps.pack(anchor="w", padx=20, pady=5)
        ctk.CTkButton(frame, text="Сбросить счетчик шагов", fg_color="#dc3545", hover_color="#b02a37", command=self.on_reset_steps).pack(pady=20)

    def create_modes_frame(self, parent):
        frame = ctk.CTkFrame(parent)
        frame.grid(row=0, column=1, sticky="nsew", padx=10)
        ctk.CTkLabel(frame, text="🔌 Режимы и Включение", font=ctk.CTkFont(size=18, weight="bold")).pack(pady=(10, 20))
        self.sw_driver, self.led_driver_fb = self.create_switch_with_feedback(frame, "Аппаратное вкл. (Driver EN)", self.on_driver_change)
        self.sw_tmc_enable, self.led_tmc_fb = self.create_switch_with_feedback(frame, "Программное вкл. (TMC Chip)", self.on_tmc_enable_change)
        ctk.CTkFrame(frame, height=2, fg_color="#4a4a6a").pack(fill="x", padx=20, pady=15)
        self.sw_stealth = self.create_switch(frame, "StealthChop (Тихий)", self.on_stealth_change)
        self.sw_cool = self.create_switch(frame, "CoolStep (Энергосбер.)", self.on_cool_change)

    def create_telemetry_frame(self, parent):
        frame = ctk.CTkFrame(parent)
        frame.grid(row=0, column=2, sticky="nsew", padx=(10, 0))
        ctk.CTkLabel(frame, text="📊 Телеметрия и Статусы", font=ctk.CTkFont(size=18, weight="bold")).pack(pady=(10, 10))
        tel_frame = ctk.CTkFrame(frame); tel_frame.pack(fill="x", padx=10, pady=5)
        self.lbl_fb_rpm = self.create_telemetry_row(tel_frame, "Текущий RPM:")
        self.lbl_fb_steps = self.create_telemetry_row(tel_frame, "Всего шагов:")
        self.lbl_fb_run = self.create_telemetry_row(tel_frame, "Вращение:")
        self.lbl_fb_sg = self.create_telemetry_row(tel_frame, "SG Result:")
        self.lbl_fb_interstep = self.create_telemetry_row(tel_frame, "Interstep:")
        self.lbl_fb_cscale = self.create_telemetry_row(tel_frame, "Current Scaling:")
        ctk.CTkLabel(frame, text="🚨 Ошибки и Флаги", font=ctk.CTkFont(size=16, weight="bold")).pack(pady=(15, 5))
        stat_frame = ctk.CTkFrame(frame); stat_frame.pack(fill="x", padx=10, pady=5)
        self.led_over_temp = self.create_led_row(stat_frame, "Перегрев:")
        self.led_short_gnd = self.create_led_row(stat_frame, "КЗ на землю:")
        self.led_open_load = self.create_led_row(stat_frame, "Обрыв нагрузки:")
        self.led_stealth_act = self.create_led_row(stat_frame, "StealthChop активен:")
        self.led_standstill = self.create_led_row(stat_frame, "Остановка:")

    # ================= ВКЛАДКА СЕРВОПРИВОДОВ =================
    def create_servo_tab(self, parent):
        grid = ctk.CTkFrame(parent, fg_color="transparent")
        grid.pack(fill="both", expand=True, padx=10, pady=10)
        grid.grid_columnconfigure((0, 1), weight=1, uniform="col")
        grid.grid_rowconfigure((0, 1), weight=1, uniform="row")
        self.servo_ui = {}
        for i in range(MAX_SERVOS):
            row, col = divmod(i, 2)
            frame = ctk.CTkFrame(grid)
            frame.grid(row=row, column=col, sticky="nsew", padx=10, pady=10)
            self.servo_ui[i] = self.create_servo_card(frame, i)

    def create_servo_card(self, parent, channel):
        ui = {}
        ctk.CTkLabel(parent, text=f"🦾 Сервопривод #{channel}", font=ctk.CTkFont(size=16, weight="bold")).pack(pady=(10, 10))
        ctk.CTkLabel(parent, text="Угол (0-180°):").pack(anchor="w", padx=20)
        ang_frame = ctk.CTkFrame(parent, fg_color="transparent"); ang_frame.pack(fill="x", padx=20, pady=5)
        sld = ctk.CTkSlider(ang_frame, from_=0, to=180, command=lambda val, ch=channel: self.on_servo_ang_slider(ch, val))
        sld.pack(side="left", fill="x", expand=True, padx=(0, 10)); sld.set(90)
        ent = ctk.CTkEntry(ang_frame, width=60, justify="right"); ent.insert(0, "90"); ent.pack(side="left", padx=(0, 10))
        ent.bind("<Return>", lambda event, ch=channel: self.on_servo_ang_entry(ch, event))
        ent.bind("<FocusOut>", lambda event, ch=channel: self.on_servo_ang_entry(ch, event))
        lbl_val = ctk.CTkLabel(ang_frame, text="90", width=40); lbl_val.pack(side="right")
        ui['slider_ang'], ui['entry_ang'], ui['lbl_ang_val'] = sld, ent, lbl_val
        
        sw, led_fb = self.create_switch_with_feedback(parent, "Включить серво", lambda ch=channel: self.on_servo_enable_change(ch))
        ui['switch_en'], ui['led_fb'] = sw, led_fb
        
        tel_frame = ctk.CTkFrame(parent); tel_frame.pack(fill="x", padx=10, pady=15)
        ui['lbl_fb_ang'] = self.create_telemetry_row(tel_frame, "Текущий угол:")
        stat_frame = ctk.CTkFrame(parent); stat_frame.pack(fill="x", padx=10, pady=5)
        ui['led_status'] = self.create_led_row(stat_frame, "Статус:")
        return ui

    # ================= ВКЛАДКА ДАТЧИКОВ VL53L0X =================
    def create_sensor_tab(self, parent):
        main_frame = ctk.CTkFrame(parent, fg_color="transparent")
        main_frame.pack(fill="both", expand=True, padx=10, pady=10)
        
        # --- Глобальное управление ---
        global_frame = ctk.CTkFrame(main_frame)
        global_frame.pack(fill="x", padx=10, pady=(0, 10))
        ctk.CTkLabel(global_frame, text="📏 Глобальные настройки VL53L0X", font=ctk.CTkFont(size=18, weight="bold")).pack(pady=(10, 5))
        
        info_frame = ctk.CTkFrame(global_frame, fg_color="transparent")
        info_frame.pack(fill="x", padx=20, pady=10)
        
        self.lbl_sensor_mode = self.create_telemetry_row(info_frame, "Режим:")
        self.lbl_sensor_mode_id = self.create_telemetry_row(info_frame, "ID режима:")
        self.lbl_sensor_max_range = self.create_telemetry_row(info_frame, "Макс. дальность (мм):")
        
        ctrl_frame = ctk.CTkFrame(global_frame, fg_color="transparent")
        ctrl_frame.pack(fill="x", padx=20, pady=(0, 10))
        
        ctk.CTkLabel(ctrl_frame, text="Выбрать режим:").pack(side="left", padx=(0, 10))
        # Предполагаем, что режимов от 0 до 4 (Default, HighAccuracy, LongRange, HighSpeed)
        self.opt_sensor_mode = ctk.CTkOptionMenu(ctrl_frame, values=["0", "1", "2", "3", "4"], width=100, command=self.on_sensor_mode_change)
        self.opt_sensor_mode.set("0"); self.opt_sensor_mode.pack(side="left", padx=(0, 20))
        
        ctk.CTkButton(ctrl_frame, text="🔄 Принудительно обновить все", fg_color="#007bff", hover_color="#0056b3", command=self.on_sensor_publish_all).pack(side="right")

        # --- Сетка каналов (Scrollable) ---
        scroll_frame = ctk.CTkScrollableFrame(main_frame)
        scroll_frame.pack(fill="both", expand=True, padx=10, pady=10)
        scroll_frame.grid_columnconfigure((0, 1, 2, 3), weight=1, uniform="col")
        
        self.sensor_ui = {}
        for i in range(MAX_SENSORS):
            row, col = divmod(i, 4)
            frame = ctk.CTkFrame(scroll_frame)
            frame.grid(row=row, column=col, sticky="nsew", padx=5, pady=5)
            self.sensor_ui[i] = self.create_sensor_card(frame, i)

    def create_sensor_card(self, parent, channel):
        ui = {}
        ctk.CTkLabel(parent, text=f"📡 Канал #{channel}", font=ctk.CTkFont(size=14, weight="bold")).pack(pady=(5, 5))
        
        # Включение и калибровка
        sw, led_fb = self.create_switch_with_feedback(parent, "Включить", lambda ch=channel: self.on_sensor_enable_change(ch))
        ui['switch_en'], ui['led_fb'] = sw, led_fb
        
        cal_stat_frame = ctk.CTkFrame(parent, fg_color="transparent")
        cal_stat_frame.pack(fill="x", padx=10, pady=5)
        ctk.CTkLabel(cal_stat_frame, text="Калибровка:").pack(side="left")
        ui['led_calibrated'] = ctk.CTkLabel(cal_stat_frame, text="●", font=ctk.CTkFont(size=16), text_color=COLOR_OFF)
        ui['led_calibrated'].pack(side="right")
        
        # Поля калибровки
        cal_ctrl_frame = ctk.CTkFrame(parent, fg_color="transparent")
        cal_ctrl_frame.pack(fill="x", padx=10, pady=5)
        
        ctk.CTkLabel(cal_ctrl_frame, text="Ближняя (мм):").pack(anchor="w")
        ent_near = ctk.CTkEntry(cal_ctrl_frame, width=60, justify="right"); ent_near.insert(0, "50"); ent_near.pack(side="left", padx=(0, 5))
        btn_start = ctk.CTkButton(cal_ctrl_frame, text="Старт", width=60, height=28, command=lambda ch=channel, e=ent_near: self.on_sensor_cal_start(ch, e))
        btn_start.pack(side="right")
        
        ctk.CTkLabel(cal_ctrl_frame, text="Дальняя (мм):").pack(anchor="w", pady=(5,0))
        ent_far = ctk.CTkEntry(cal_ctrl_frame, width=60, justify="right"); ent_far.insert(0, "500"); ent_far.pack(side="left", padx=(0, 5), pady=(5,0))
        btn_finish = ctk.CTkButton(cal_ctrl_frame, text="Финиш", width=60, height=28, command=lambda ch=channel, e=ent_far: self.on_sensor_cal_finish(ch, e))
        btn_finish.pack(side="right")
        
        ctk.CTkButton(parent, text="Сбросить калибровку", fg_color="#6c757d", hover_color="#5a6268", height=28, command=lambda ch=channel: self.on_sensor_clear_cal(ch)).pack(pady=5)
        
        ui['ent_near'], ui['ent_far'] = ent_near, ent_far
        
        # Телеметрия
        tel_frame = ctk.CTkFrame(parent)
        tel_frame.pack(fill="x", padx=5, pady=5)
        ui['lbl_dist'] = self.create_telemetry_row(tel_frame, "Дист. (мм):")
        ui['lbl_raw'] = self.create_telemetry_row(tel_frame, "Сырое (мм):")
        
        return ui

    # ================= ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ GUI =================
    def create_switch(self, parent, text, command):
        frame = ctk.CTkFrame(parent, fg_color="transparent"); frame.pack(fill="x", padx=10, pady=5)
        ctk.CTkLabel(frame, text=text).pack(side="left")
        switch = ctk.CTkSwitch(frame, text="", command=command); switch.pack(side="right")
        return switch

    def create_switch_with_feedback(self, parent, text, command):
        frame = ctk.CTkFrame(parent, fg_color="transparent"); frame.pack(fill="x", padx=10, pady=5)
        ctk.CTkLabel(frame, text=text).pack(side="left")
        feedback_led = ctk.CTkLabel(frame, text="●", font=ctk.CTkFont(size=18), text_color=COLOR_OFF)
        feedback_led.pack(side="right", padx=(10, 0))
        switch = ctk.CTkSwitch(frame, text="", command=command); switch.pack(side="right", padx=(10, 0))
        return switch, feedback_led

    def create_telemetry_row(self, parent, text):
        frame = ctk.CTkFrame(parent, fg_color="transparent"); frame.pack(fill="x", pady=2)
        ctk.CTkLabel(frame, text=text, anchor="w", font=ctk.CTkFont(size=12)).pack(side="left")
        val_lbl = ctk.CTkLabel(frame, text="-", font=ctk.CTkFont(weight="bold", size=12), text_color=COLOR_ACTIVE, anchor="e")
        val_lbl.pack(side="right")
        return val_lbl

    def create_led_row(self, parent, text):
        frame = ctk.CTkFrame(parent, fg_color="transparent"); frame.pack(fill="x", pady=2)
        ctk.CTkLabel(frame, text=text, anchor="w", font=ctk.CTkFont(size=12)).pack(side="left")
        led_lbl = ctk.CTkLabel(frame, text="●", font=ctk.CTkFont(size=16), text_color=COLOR_OFF)
        led_lbl.pack(side="right")
        return led_lbl

    # ================= MQTT =================
    def setup_mqtt(self):
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="python_scada")
        self.client.username_pw_set(MQTT_USER, MQTT_PASSWORD)
        self.client.on_connect = self.on_mqtt_connect
        self.client.on_disconnect = self.on_mqtt_disconnect
        self.client.on_message = self.on_mqtt_message
        try:
            self.client.connect(MQTT_BROKER, MQTT_PORT, 60)
            self.client.loop_start()
        except Exception as e:
            print(f"Ошибка подключения: {e}")
            self.update_status(False)

    def on_mqtt_connect(self, client, userdata, flags, reason_code, properties):
        if reason_code == 0:
            self.root.after(0, self.update_status, True)
            client.subscribe("motor/feedback/#")
            client.subscribe("servo/+/feedback/#")
            client.subscribe("sensor/feedback/#") # Подписка на датчики
        else:
            self.root.after(0, self.update_status, False)

    def on_mqtt_disconnect(self, client, userdata, flags, reason_code, properties):
        self.root.after(0, self.update_status, False)

    def on_mqtt_message(self, client, userdata, msg):
        self.root.after(0, self.process_feedback, msg.topic, msg.payload.decode('utf-8'))

    def process_feedback(self, topic, val):
        parts = topic.split('/')
        
        # --- MOTOR ---
        if parts[0] == 'motor' and parts[1] == 'feedback':
            if topic == "motor/feedback/rpm": self.lbl_fb_rpm.configure(text=val)
            elif topic == "motor/feedback/totalsteps": self.lbl_fb_steps.configure(text=val)
            elif topic == "motor/feedback/is_run":
                is_run = val == "true"
                self.lbl_fb_run.configure(text="Да" if is_run else "Нет", text_color=COLOR_OK if is_run else COLOR_ERR)
            elif topic == "motor/feedback/tmc/current_percent": self.lbl_cur_val.configure(text=val); self.sld_current.set(int(val))
            elif topic == "motor/feedback/tmc/microsteps": self.opt_msteps.set(val)
            elif topic == "motor/feedback/tmc/sg_result": self.lbl_fb_sg.configure(text=val)
            elif topic == "motor/feedback/tmc/interstep_duration": self.lbl_fb_interstep.configure(text=val)
            elif topic == "motor/feedback/tmc/status/current_scaling": self.lbl_fb_cscale.configure(text=val)
            elif topic == "motor/feedback/tmc/status/over_temp": self.update_led(self.led_over_temp, val, True)
            elif topic == "motor/feedback/tmc/status/short_to_ground": self.update_led(self.led_short_gnd, val, True)
            elif topic == "motor/feedback/tmc/status/open_load": self.update_led(self.led_open_load, val, True)
            elif topic == "motor/feedback/tmc/status/stealth_chop_active": self.update_led(self.led_stealth_act, val, False)
            elif topic == "motor/feedback/tmc/status/standstill": self.update_led(self.led_standstill, val, False)
            elif topic == "motor/feedback/driver/status":
                is_on = val == "on"; self.driver_pending = False
                if self.sw_driver.get() != is_on: self.sw_driver.select() if is_on else self.sw_driver.deselect()
                self.led_driver_fb.configure(text_color=COLOR_OK if is_on else COLOR_OFF)
            elif topic == "motor/feedback/tmc/status":
                is_on = val == "on"; self.tmc_pending = False
                if self.sw_tmc_enable.get() != is_on: self.sw_tmc_enable.select() if is_on else self.sw_tmc_enable.deselect()
                self.led_tmc_fb.configure(text_color=COLOR_OK if is_on else COLOR_OFF)

        # --- SERVO ---
        elif parts[0] == 'servo' and len(parts) == 4 and parts[2] == 'feedback':
            try:
                ch = int(parts[1]); param = parts[3]
                if ch in self.servo_ui:
                    ui = self.servo_ui[ch]
                    if param == 'angle': ui['lbl_fb_ang'].configure(text=val)
                    elif param == 'status':
                        is_on = val == "on"; self.servo_pending[ch] = False
                        if ui['switch_en'].get() != is_on: ui['switch_en'].select() if is_on else ui['switch_en'].deselect()
                        ui['led_fb'].configure(text_color=COLOR_OK if is_on else COLOR_OFF)
                        self.update_led(ui['led_status'], val, False)
            except ValueError: pass

        # --- SENSOR ---
        elif parts[0] == 'sensor' and parts[1] == 'feedback':
            if len(parts) == 3: # Глобальные sensor/feedback/mode...
                param = parts[2]
                if param == 'mode': self.lbl_sensor_mode.configure(text=val)
                elif param == 'mode_id': self.lbl_sensor_mode_id.configure(text=val); self.opt_sensor_mode.set(val)
                elif param == 'max_range': self.lbl_sensor_max_range.configure(text=val)
            elif len(parts) == 4: # Канальные sensor/feedback/{ch}/...
                try:
                    ch = int(parts[2]); param = parts[3]
                    if ch in self.sensor_ui:
                        ui = self.sensor_ui[ch]
                        if param == 'status':
                            is_on = val == "on"; self.sensor_pending[ch] = False
                            if ui['switch_en'].get() != is_on: ui['switch_en'].select() if is_on else ui['switch_en'].deselect()
                            ui['led_fb'].configure(text_color=COLOR_OK if is_on else COLOR_OFF)
                        elif param == 'calibrated':
                            is_cal = val == "true"
                            ui['led_calibrated'].configure(text_color=COLOR_OK if is_cal else COLOR_OFF)
                        elif param == 'distance':
                            if val == "out_of_range":
                                ui['lbl_dist'].configure(text="Вне диапазона", text_color=COLOR_WARN)
                            else:
                                ui['lbl_dist'].configure(text=val, text_color=COLOR_ACTIVE)
                        elif param == 'raw':
                            ui['lbl_raw'].configure(text=val, text_color=COLOR_ACTIVE)
                except ValueError: pass

    # ================= ОБРАБОТЧИКИ СОБЫТИЙ =================
    def publish(self, topic, payload):
        if self.client.is_connected(): self.client.publish(topic, str(payload), qos=1)

    def update_status(self, is_online):
        self.lbl_status.configure(text="● Подключено" if is_online else "● Отключено", text_color=COLOR_OK if is_online else COLOR_ERR)

    def update_led(self, label, val, is_error):
        is_true = val in ["true", "1", "on"]
        label.configure(text_color=COLOR_ERR if (is_true and is_error) else (COLOR_OK if is_true else COLOR_OFF))

    # --- Motor Handlers ---
    def on_rpm_slider_change(self, value):
        int_val = int(value); self.ent_rpm.delete(0, ctk.END); self.ent_rpm.insert(0, str(int_val))
        self.lbl_rpm_val.configure(text=str(int_val)); self.publish("motor/control/rpm", int_val)
    def on_rpm_entry_apply(self, event=None):
        try:
            int_val = max(-1000, min(1000, int(self.ent_rpm.get())))
            self.sld_rpm.set(int_val); self.lbl_rpm_val.configure(text=str(int_val)); self.publish("motor/control/rpm", int_val)
        except ValueError: self.ent_rpm.delete(0, ctk.END); self.ent_rpm.insert(0, str(int(self.sld_rpm.get())))
    def on_current_change(self, value):
        int_val = int(value); self.lbl_cur_val.configure(text=str(int_val)); self.publish("motor/control/tmc/current_percent", int_val)
    def on_sg_apply(self):
        val = self.ent_sg.get()
        if val.isdigit() and 0 <= int(val) <= 255: self.publish("motor/control/tmc/stallguard", int(val))
    def on_msteps_change(self, choice): self.publish("motor/control/tmc/microsteps", int(choice))
    def on_reset_steps(self): self.publish("motor/control/totalsteps/reset", "1")
    def on_driver_change(self):
        is_on = self.sw_driver.get(); self.driver_pending = True; self.led_driver_fb.configure(text_color=COLOR_PENDING)
        self.publish("motor/control/driver", "on" if is_on else "off")
    def on_tmc_enable_change(self):
        is_on = self.sw_tmc_enable.get(); self.tmc_pending = True; self.led_tmc_fb.configure(text_color=COLOR_PENDING)
        self.publish("motor/control/tmc/enable", "on" if is_on else "off")
    def on_stealth_change(self): self.publish("motor/control/tmc/stealthchop", "on" if self.sw_stealth.get() else "off")
    def on_cool_change(self): self.publish("motor/control/tmc/coolstep", "on" if self.sw_cool.get() else "off")

    # --- Servo Handlers ---
    def on_servo_ang_slider(self, channel, value):
        int_val = int(value); ui = self.servo_ui[channel]
        ui['entry_ang'].delete(0, ctk.END); ui['entry_ang'].insert(0, str(int_val))
        ui['lbl_ang_val'].configure(text=str(int_val)); self.publish(f"servo/control/{channel}/angle", int_val)
    def on_servo_ang_entry(self, channel, event=None):
        ui = self.servo_ui[channel]
        try:
            int_val = max(0, min(180, int(ui['entry_ang'].get())))
            ui['slider_ang'].set(int_val); ui['lbl_ang_val'].configure(text=str(int_val)); self.publish(f"servo/control/{channel}/angle", int_val)
        except ValueError: ui['entry_ang'].delete(0, ctk.END); ui['entry_ang'].insert(0, str(int(ui['slider_ang'].get())))
    def on_servo_enable_change(self, channel):
        ui = self.servo_ui[channel]; is_on = ui['switch_en'].get()
        self.servo_pending[channel] = True; ui['led_fb'].configure(text_color=COLOR_PENDING)
        self.publish(f"servo/control/{channel}/enable", "on" if is_on else "off")

    # --- Sensor Handlers ---
    def on_sensor_mode_change(self, choice):
        self.publish("sensor/control/mode", int(choice))
        
    def on_sensor_publish_all(self):
        self.publish("sensor/control/publish_all", "1")
        
    def on_sensor_enable_change(self, channel):
        ui = self.sensor_ui[channel]; is_on = ui['switch_en'].get()
        self.sensor_pending[channel] = True; ui['led_fb'].configure(text_color=COLOR_PENDING)
        self.publish(f"sensor/control/enable/{channel}", "on" if is_on else "off")
        
    def on_sensor_cal_start(self, channel, entry_widget):
        val = entry_widget.get()
        if val.isdigit():
            self.publish(f"sensor/control/calibrate/start/{channel}", int(val))
            
    def on_sensor_cal_finish(self, channel, entry_widget):
        val = entry_widget.get()
        if val.isdigit():
            self.publish(f"sensor/control/calibrate/finish/{channel}", int(val))
            
    def on_sensor_clear_cal(self, channel):
        self.publish(f"sensor/control/clear_cal/{channel}", "1")

    def run(self):
        self.root.mainloop()
        self.client.loop_stop()
        self.client.disconnect()

if __name__ == "__main__":
    app = MotorSCADA()
    app.run()