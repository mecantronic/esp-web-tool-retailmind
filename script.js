// Referencias a elementos DOM
const espInstallButton = document.querySelector('esp-web-install-button');
const boardSelect = document.getElementById('board-select');
const versionDescription = document.getElementById('version-description');
const configButton = document.getElementById('config-button');
const configModal = document.getElementById('config-modal');
const closeModal = document.querySelector('.close-modal');
const connectSerialBtn = document.getElementById('connect-serial');
const installButton = document.getElementById('install-button');
const activateConfigBtn = document.getElementById('activate-config');
const deactivateConfigBtn = document.getElementById('deactivate-config');
const readConfigBtn = document.getElementById('read-config');
const configStatusEl = document.getElementById('config-status');
const configFormEl = document.getElementById('config-form');
const deviceIdInput = document.getElementById('deviceId');
const wifiSsidInput = document.getElementById('wifi-ssid');
const wifiPasswordInput = document.getElementById('wifi-password');

// Variables globales
const DEBUG_MODE = false; // Configura a true para ver todos los mensajes
let serialPort = null;
let serialReader = null;
let readableStreamClosed = null;
let isConnected = false;
let isClosing = false;
let modeConfigActive = false;
let waitingForConfigResponse = false;

// Descripciones de versiones
const firmwareDescriptions = {
  "manifest_esp32_tinypico_v1_1.json": `
    <strong>Versión 1.1 – retailmind-device</strong><br>
    <ul>
      <li>Feat: Mantener presionado para entrar en modo suspensión.</li>
      <li>Feat: Envío por POST a un endpoint al finalizar la subida.</li>
      <li>Feat: Subida de archivos optimizada.</li>
      <li>Change: La grabación ya no comienza automáticamente al arrancar</li>
    </ul>
  `,
  "manifest_esp32_tinypico_v1_0.json": `
    <strong>Versión 1.0 – retailmind-device</strong><br>
    <p>Primera versión funcional.</p>
    <ul>
      <li>Grabación y envío de audio</li>
      <li>Integración con servidor</li>
    </ul>
  `,
  "manifest_esp32.json": `
    <strong>Versión 1.0 – ESP32 estándar (test)</strong><br>
    <p>Versión de prueba para conectividad y flasheo.</p>
  `,
};

// Verificar soporte Web Serial API
if (!('serial' in navigator)) {
  configStatusEl.textContent = 'Estado: Web Serial API no soportada en este navegador';
  connectSerialBtn.disabled = true;
}

// Función para abrir y cerrar el modal
function openModal() {
  configModal.style.display = 'block';
  document.body.style.overflow = 'hidden'; // Evitar scroll del fondo
}

function closeModalFn() {
  configModal.style.display = 'none';
  document.body.style.overflow = 'auto';
  
  // Si hay una conexión activa, desconectar al cerrar el modal
  if (isConnected && !isClosing) {
    disconnectSerial();
  }
}

// Función para logging condicional
function debugLog(type, ...args) {
  if (DEBUG_MODE || type === 'tx' || type === 'rx') {
    console.log(...args);
  }
}

// Función para limpiar códigos ANSI
function stripAnsiEscapeCodes(text) {
  return text.replace(/\x1B\[\d+(?:;\d+)*m/g, '')
             .replace(/\[\d+(?:;\d+)*m/g, '');
}

// Función para procesar la configuración JSON
function processConfigInfo(configText) {
  try {
    // Intentar extraer JSON de la respuesta
    if (configText.includes('{') && configText.includes('}')) {
      const jsonStart = configText.indexOf('{');
      const jsonEnd = configText.lastIndexOf('}') + 1;
      const jsonStr = configText.substring(jsonStart, jsonEnd);
      
      try {
        const configData = JSON.parse(jsonStr);
        
        // Actualizar formulario con los datos
        deviceIdInput.value = configData.deviceId || '';
        wifiSsidInput.value = configData.wifi_ssid || '';
        wifiPasswordInput.value = configData.wifi_password || '';
        
        // Mostrar el formulario
        configFormEl.style.display = 'block';
        
        updateStatus('Configuración cargada correctamente');
        return true;
      } catch (e) {
        debugLog('error', 'Error al parsear JSON:', e);
      }
    }
    
    return false;
  } catch (e) {
    debugLog('error', 'Error al procesar la configuración:', e);
    return false;
  }
}

// Actualizar el manifiesto del firmware
function updateFirmwareDescription() {
  const selectedManifest = boardSelect.value;
  espInstallButton.setAttribute('manifest', selectedManifest);

  if (firmwareDescriptions[selectedManifest]) {
    versionDescription.innerHTML = firmwareDescriptions[selectedManifest];
    versionDescription.style.display = 'block';
  } else {
    versionDescription.style.display = 'none';
  }
}

// Manejar la conexión serial
async function handleSerialConnection() {
  if (isConnected) {
    await disconnectSerial();
  } else {
    await connectSerial();
  }
}

// Conectar al puerto serial
async function connectSerial() {
  try {
    updateStatus('Solicitando puerto serial...');
    configFormEl.style.display = 'none';
    
    serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate: 115200 });
    
    isConnected = true;
    updateConnectionUI(true);
    updateStatus('Conectado al puerto serial');
    
    startSerialReading();
  } catch (error) {
    debugLog('error', 'Error al conectar:', error);
    updateStatus(error.name === 'NotFoundError' ? 
      'No se seleccionó ningún puerto' : 
      `Error: ${error.message || 'Fallo al conectar'}`);
    
    isConnected = false;
    updateConnectionUI(false);
  }
}

// Desconectar del puerto serial
async function disconnectSerial() {
  if (!serialPort || isClosing) {
    isClosing && updateStatus('Desconectando, por favor espera...');
    return;
  }
  
  isClosing = true;
  updateConnectionUI(false);
  
  try {
    // Desactivar modo config si está activo
    if (modeConfigActive) {
      try {
        updateStatus('Desactivando Modo Config...');
        await sendCommand('MODE_CONFIG OFF', false);
        await new Promise(resolve => setTimeout(resolve, 500));
        modeConfigActive = false;
      } catch (e) {
        debugLog('warn', 'Error al desactivar Modo Config:', e);
      }
    }
    
    // Detener lectura serial
    if (serialReader) {
      try {
        await serialReader.cancel();
        if (readableStreamClosed) {
          await readableStreamClosed.catch(() => {});
        }
      } catch (e) {
        debugLog('warn', 'Error al cancelar lectura:', e);
      }
      
      serialReader = null;
      readableStreamClosed = null;
    }
    
    // Cerrar puerto
    if (serialPort) {
      try {
        await serialPort.close();
      } catch (e) {
        if (e.name === 'InvalidStateError' && e.message.includes('already in progress')) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    serialPort = null;
    isConnected = false;
    
    updateConnectionUI(false);
    updateStatus('Desconectado del puerto serial');
  } catch (error) {
    debugLog('error', 'Error al desconectar:', error);
    updateStatus(`Error: ${error.message || 'Fallo al desconectar'}`);
    
    isConnected = false;
    serialPort = null;
    serialReader = null;
    readableStreamClosed = null;
    updateConnectionUI(false);
  } finally {
    isClosing = false;
    modeConfigActive = false;
    waitingForConfigResponse = false;
    updateConnectionUI(false);
  }
}

// Iniciar lectura del puerto serial
async function startSerialReading() {
  if (!serialPort?.readable) {
    debugLog('error', 'El puerto serial no está disponible para lectura');
    updateStatus('Error: Puerto serial no disponible');
    await disconnectSerial();
    return;
  }
  
  const textDecoder = new TextDecoder();
  let buffer = '';
  
  try {
    serialReader = serialPort.readable.getReader();
    readableStreamClosed = serialReader.closed.catch(() => {});
    
    while (true) {
      try {
        const { value, done } = await serialReader.read();
        
        if (done) {
          debugLog('info', 'La lectura del puerto serial finalizó');
          break;
        }
        
        buffer += textDecoder.decode(value);
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (!line.trim()) continue;
          
          // Limpiar códigos ANSI
          const cleanLine = stripAnsiEscapeCodes(line.trim());
          
          // Mostrar respuestas
          if (cleanLine.includes('{') && cleanLine.includes('}') || 
              cleanLine.includes('Config loaded:')) {
            debugLog('rx', 'RX:', cleanLine);
            
            if (waitingForConfigResponse) {
              processConfigInfo(cleanLine);
              waitingForConfigResponse = false;
            }
          } else {
            debugLog('info', 'RX:', cleanLine);
          }
          
          // Detectar cambios de estado
          if (cleanLine.includes('MODE_CONFIG: Starting mode_config')) {
            modeConfigActive = true;
            updateStatus('Modo Config ACTIVADO');
            updateModeConfigUI(true);
          } else if (cleanLine.includes('MODE_CONFIG: Stopping mode_config')) {
            modeConfigActive = false;
            updateStatus('Modo Config DESACTIVADO');
            updateModeConfigUI(false);
          }
        }
      } catch (readError) {
        debugLog('error', 'Error durante la lectura:', readError);
        
        if (readError.name === 'NetworkError') {
          updateStatus('Dispositivo desconectado');
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } catch (error) {
    debugLog('error', 'Error general durante la lectura serial:', error);
    updateStatus(`Error: ${error.message || 'Fallo de comunicación'}`);
  } finally {
    if (serialReader) {
      try { serialReader.releaseLock(); } catch (e) {}
      serialReader = null;
    }
    
    isConnected && await disconnectSerial();
  }
}

// Enviar comando al dispositivo
async function sendCommand(command, updateUI = true) {
  if (!serialPort || !isConnected) {
    updateStatus('No hay conexión serial activa');
    return false;
  }

  try {
    const writer = serialPort.writable.getWriter();
    
    debugLog('tx', 'TX:', command);
    
    if (command === 'CONFIG_READ') {
      waitingForConfigResponse = true;
    }
    
    await writer.write(new TextEncoder().encode(command + '\n'));
    writer.releaseLock();
    
    updateUI && updateStatus(`Comando "${command}" enviado`);
    
    if (command === 'MODE_CONFIG ON') {
      modeConfigActive = true;
      updateModeConfigUI(true);
    } else if (command === 'MODE_CONFIG OFF') {
      modeConfigActive = false;
      updateModeConfigUI(false);
    }
    
    return true;
  } catch (error) {
    debugLog('error', 'Error al enviar comando:', error);
    updateStatus(`Error: ${error.message || 'Fallo al enviar el comando'}`);
    
    error.name === 'NetworkError' && await disconnectSerial();
    
    return false;
  }
}

// Actualizar el estado en la UI
function updateStatus(message) {
  configStatusEl.textContent = `Estado: ${message}`;
}

// Actualizar UI según estado de conexión
function updateConnectionUI(connected) {
  if (isClosing) {
    connectSerialBtn.textContent = 'Desconectando...';
    connectSerialBtn.disabled = true;
  } else {
    connectSerialBtn.textContent = connected ? 'Desconectar Puerto Serial' : 'Conectar Puerto Serial';
    connectSerialBtn.disabled = false;
  }
  
  updateModeConfigUI(modeConfigActive);
}

// Actualizar UI según modo config
function updateModeConfigUI(active) {
  activateConfigBtn.disabled = active || !isConnected || isClosing;
  deactivateConfigBtn.disabled = !active || !isConnected || isClosing;
  readConfigBtn.disabled = !active || !isConnected || isClosing;
}

// Eventos
boardSelect.addEventListener('change', updateFirmwareDescription);
configButton.addEventListener('click', openModal);
closeModal.addEventListener('click', closeModalFn);

// Cerrar modal haciendo clic fuera del contenido
window.addEventListener('click', (e) => {
  if (e.target === configModal) {
    closeModalFn();
  }
});

connectSerialBtn.addEventListener('click', handleSerialConnection);

activateConfigBtn.addEventListener('click', async () => {
  await sendCommand('MODE_CONFIG ON') && updateStatus('Activando Modo Config...');
});

deactivateConfigBtn.addEventListener('click', async () => {
  await sendCommand('MODE_CONFIG OFF') && updateStatus('Desactivando Modo Config...');
});

readConfigBtn.addEventListener('click', async () => {
    configFormEl.style.display = 'none';
    await sendCommand('CONFIG_READ') && updateStatus('Leyendo configuración...');
  });
  
  // Limpieza al salir
  window.addEventListener('beforeunload', () => {
    if (isConnected && serialPort && modeConfigActive) {
      try {
        const writer = serialPort.writable.getWriter();
        writer.write(new TextEncoder().encode('MODE_CONFIG OFF\n'));
        writer.releaseLock();
        serialReader?.cancel();
        serialPort.close();
      } catch (e) {}
    }
  });
  
  // Inicialización
  updateFirmwareDescription();