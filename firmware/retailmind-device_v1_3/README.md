# Versión 1.3 – retailmind-device
Esta versión incluye mejoras significativas de rendimiento y usabilidad:

## Características
* **Sistema avanzado de monitoreo de batería**: Implementación completa de detección de niveles de batería (3.56V-4.20V) con indicadores visuales para:batería baja, batería crítica, estado de carga y carga completa.
* **Indicadores LED mejorados**: Sistema completo de 11 estados visuales que proporcionan información clara sobre:estado del sistema (idle, grabando, enviando), nivel de batería (bajo, crítico, cargando, carga completa), mensajes pendientes y en envío, modos combinados (grabación + envío, grabación + mensajes pendientes), error y configuración.
* **Codificación de audio en formato AAC**: Implementación de codificación de audio en formato AAC de alta eficiencia, permitiendo mejor calidad de audio.
* **Análisis de rendimiento**: Incremento notable en la velocidad de subida de archivos .opus a GCP, con mejoras de hasta +763% en el rendimiento promedio.
* **Monitoreo de batería mejorado**: Indicadores visuales precisos para batería baja, crítica, en carga y completamente cargada. Alertas mediante LED RGB.
* **Implementar múltiples servicios NTP**:  Sistema de múltiples servidores NTP para garantizar la disponibilidad y precisión del tiempo del sistema.
* **Agregar información del firmware en payload de generate-signed-url**: Ahora incluye información sobre la versión del firmware.

## Compatibilidad
Compatible con dispositivos ESP32 TinyPico.
