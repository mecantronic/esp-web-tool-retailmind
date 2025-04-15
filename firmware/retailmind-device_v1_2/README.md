# Versión 1.2 – retailmind-device

Esta versión incluye mejoras significativas de rendimiento y usabilidad:

## Características

* **Modo suspensión mejorado**: Mantener presionado para entrar en modo suspensión.
* **Integración de servicios**: Envío de archivos a GCP mediante POST con confirmación de subida exitosa.
* **Optimización**:  Subida de archivos optimizada para un mejor rendimiento y eliminación automática de archivos .opus tras confirmación de subida.
* **Control manual**: La grabación comienza automáticamente al despertar del modo suspensión o puede iniciarse manualmente mediante el botón.
* **Modo configuración**: Nuevo modo activado por UART (MODE_CONFIG ON) que permite leer y escribir configuraciones en la tarjeta SD. El LED amarillo indica que este modo está activo.

## Compatibilidad

Compatible con dispositivos ESP32 TinyPico.
