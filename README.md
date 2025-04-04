# RetailMind ESP32 Flasher

Este repositorio contiene una herramienta web para instalar el firmware del grabador de audio **RetailMind** en dispositivos **ESP32**, directamente desde el navegador.

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
- Dispositivo: **ESP32**, incluyendo variantes como **ESP32 PICO D4** y **ESP32 TinyPico**

---

## 🔌 Instrucciones de uso

1. Conectá tu dispositivo ESP32 por USB a la computadora.
2. Accedé al enlace: [https://mecantronic.github.io/esp-web-tool-retailmind/](https://mecantronic.github.io/esp-web-tool-retailmind/)
3. Seleccioná la versión correspondiente del firmware en el desplegable.
   - Versión: 1.0 (ESP32)
   - Versión: 1.1 (ESP32 TinyPico)
   - Versión: 1.2 (ESP32 TinyPico)
4. Presioná el botón `Connect`.
5. Seleccioná el puerto USB cuando el navegador lo solicite.
6. Esperá a que el proceso termine (sin desconectar el dispositivo).
7. ¡Listo! El firmware estará flasheado correctamente.

---

## 🧠 Sobre los manifests

Los archivos `manifest_***.json` definen:

- Los binarios necesarios para el dispositivo
- Las ubicaciones (offsets) en memoria
- La familia de chip compatible (`ESP32`)

Este archivo es utilizado por **ESP Web Tools** para automatizar el proceso de flasheo directamente desde el navegador.

---

## 🧩 Tecnología utilizada

- [ESP Web Tools](https://esphome.github.io/esp-web-tools/)
- [ESP-IDF](https://docs.espressif.com/projects/esp-idf/en/latest/) + [FreeRTOS](https://www.freertos.org/)
- Dispositivos: [ESP32 PICO D4](https://www.espressif.com/en/products/socs/esp32/pico-d4), ESP32 TinyPico

---

## ✨ Créditos

Firmware desarrollado por el equipo de [Devolut](https://devolut.tech/).  
Web Installer basado en el trabajo de [ESPHome / balloob](https://github.com/balloob/squeezelite-esp32-install).


---

