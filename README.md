#Делайка демо версия

##Создание скрипта для автоматической установки на линукс.
1. Скачать демо версию в <a href="https://github.com/san4jkee/delaika-landing/releases/tag/demo">Releases</a>
2. Создать скрипт:
```bash
sudo nano auto_install.sh
```

<pre>
#!/bin/bash

# Установка Java JDK
sudo apt install openjdk-17-jdk
sudo apt install default-jre

# Установка PostgreSQL
sudo apt install postgresql postgresql-contrib

# Активация пользователя postgres в PostgreSQL
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'root';"

# Создание базы данных "taskmanager"
sudo -u postgres createdb taskmanager

# Создание службы systemd
echo "[Unit]
Description=TaskManager Run Service
After=network.target

[Service]
User=root
WorkingDirectory=/home
ExecStart=/usr/bin/java -jar TaskManager.jar
SuccessExitStatus=143

[Install]
WantedBy=multi-user.target" | sudo tee /etc/systemd/system/taskmanager.service

# Перезапуск службы systemd и включение в автозагрузку
sudo systemctl daemon-reload
sudo systemctl enable taskmanager.service
sudo systemctl start taskmanager.service

echo "Установка завершена."
</pre>

3. Сделать скрипт исполняемым:
```bash
sudo chmod +x auto_install.sh
```

4. Запустить скрипт:
```bash
./auto_install.sh
```

5. Перейдите в браузере по адресу http://localhost:8754
6. При первом запуске программы войти с логином <b>admin</b> и ввести любой пароль, программа поймет, что пароля нет и предложит придумать пароль.