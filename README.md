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
- Dispositivo: **ESP32**, incluyendo variantes como **ESP32 PICO D4**

---

## 🔌 Instrucciones de uso

1. Conectá tu dispositivo ESP32 por USB a la computadora.
2. Accedé al enlace: [https://mecantronic.github.io/esp-web-tool-retailmind/](https://mecantronic.github.io/esp-web-tool-retailmind/)
3. Seleccioná la versión correspondiente del firmware en el desplegable.
4. Presioná el botón `INSTALAR`.
5. Seleccioná el puerto USB cuando el navegador lo solicite.
6. Esperá a que el proceso termine (sin desconectar el dispositivo).
7. ¡Listo! El firmware estará flasheado correctamente.

## ⚙️ Configuración del dispositivo

Una vez instalado el firmware, podés configurar tu dispositivo RetailMind:

1. Hacé clic en el botón `CONFIGURACIÓN`.
2. Cuando el navegador lo solicite, seleccioná el puerto USB del dispositivo.
3. Una vez conectado, activá el **Modo Config** usando el interruptor.
4. Hacé clic en **Leer Configuración** para obtener la configuración actual.
5. Para modificar la configuración:
   - Hacé clic en el botón **Editar**
   - Modificá los campos de SSID WiFi y Contraseña WiFi
   - Si necesitás un nuevo ID de dispositivo, hacé clic en el botón 🔁
   - Hacé clic en **Guardar** y confirmá los cambios
6. El dispositivo guardará la configuración y, si cambiaste los datos WiFi, intentará conectarse a la nueva red.
7. Cuando termines, desactivá el **Modo Config** antes de desconectar el dispositivo.

---

## 🧠 Características de la herramienta

### Carga dinámica de firmware
- La herramienta carga automáticamente las versiones de firmware disponibles
- Prioriza las versiones RetailMind sobre otras versiones
- Muestra siempre la versión más reciente en la parte superior
- Obtiene nombre, versión y familia de chip directamente de cada manifest.json

### Instrucciones interactivas
- Panel principal desplegable para mostrar/ocultar las instrucciones
- Secciones internas desplegables para una mejor organización
- Formato Markdown para una visualización clara y estructurada

### Funcionalidad de configuración
- Permite configurar el dispositivo después de la instalación
- Interfaz gráfica para editar WiFi SSID y contraseña
- Generador de ID de dispositivo único
- Confirmación de cambios para evitar errores

### Compatibilidad y diagnóstico
- Detecta navegadores incompatibles y muestra advertencias
- Proporciona solución a problemas comunes
- Muestra el estado de la conexión y operaciones en tiempo real

---

## 🧩 Tecnología utilizada

- [ESP Web Tools](https://esphome.github.io/esp-web-tools/)
- [ESP-IDF](https://docs.espressif.com/projects/esp-idf/en/latest/) + [FreeRTOS](https://www.freertos.org/)
- [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Serial) para comunicación post-instalación
- [Marked.js](https://marked.js.org/) para renderizar contenido Markdown
- Dispositivos: [ESP32 PICO D4](https://www.espressif.com/en/products/socs/esp32/pico-d4), ESP32 TinyPico

---

## 📂 Estructura del proyecto

- `index.html` - Interfaz principal
- `styles.css` - Estilos visuales
- `script.js` - Lógica de la aplicación
- `instrucciones.md` - Instrucciones en formato Markdown
- `firmware-list.json` - Lista de directorios de firmware disponibles
- `firmware/` - Carpeta con las diferentes versiones de firmware
   - Cada subcarpeta contiene un `manifest.json` con los metadatos del firmware
   - `README.md` en cada carpeta con la descripción de la versión
