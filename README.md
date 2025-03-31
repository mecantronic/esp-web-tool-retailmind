# RetailMind ESP32 Flasher

Este repositorio contiene una herramienta web para instalar el firmware del grabador de audio **RetailMind** en dispositivos **ESP32 PICO**, directamente desde el navegador.

---

## 🌐 URL de instalación

Accedé a la herramienta desde este enlace:

👉 **[Instalar Firmware](https://mecantronic.github.io/esp-web-tool-retailmind/)**

> Compatible con navegadores basados en Chromium (Chrome, Edge). No funciona en Firefox o Safari.

---

## 🛠️ Requisitos

- Navegador: **Google Chrome** o **Microsoft Edge**
- Sistema operativo: Windows, macOS o Linux
- Conexión USB disponible
- Dispositivo: **ESP32 PICO** con puerto USB

---

## 🔌 Instrucciones de uso

1. Conectá tu dispositivo ESP32 PICO a la computadora vía USB.
2. Accedé al enlace: [https://mec.github.io/esp-web-tool-retailmind/install.html](https://mec.github.io/esp-web-tool-retailmind/install.html)
3. Presioná el botón `Instalar Firmware`.
4. Seleccioná el puerto serie del ESP32 cuando el navegador lo solicite.
5. Esperá a que el proceso termine (sin desconectar el dispositivo).
6. ¡Listo! El firmware quedará flasheado y el dispositivo estará listo para ser usado.

---

## 🧠 Sobre el manifest

Los archivos `manifest_***.json` definen:
- Los binarios necesarios para el dispositivo
- Las ubicaciones (offsets) en memoria
- La familia de chip compatible (`ESP32`)

Este archivo es usado por `ESP Web Tools` para automatizar el flasheo del firmware.

---

## 🧩 Tecnología utilizada

- [ESP Web Tools](https://esphome.github.io/esp-web-tools/)
- [ESP-IDF](https://docs.espressif.com/projects/esp-idf/en/latest/) + [FreeRTOS](https://www.freertos.org/)
- [ESP32 PICO D4](https://www.espressif.com/en/products/socs/esp32/pico-d4)

---

## ✨ Créditos

Firmware desarrollado por el equipo de [Devolut](https://devolut.tech/).  
Web Installer basado en el trabajo de [ESPHome / balloob](https://github.com/balloob/squeezelite-esp32-install).

---

