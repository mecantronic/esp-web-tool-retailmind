// Referencias a elementos DOM
const espInstallButton = document.querySelector('esp-web-install-button');
const boardSelect = document.getElementById('board-select');
const versionDescription = document.getElementById('version-description');
const configButton = document.getElementById('config-button');
const configModal = document.getElementById('config-modal');
const closeModal = document.querySelector('.close-modal');
const configModeToggle = document.getElementById('config-mode-toggle');
const readConfigBtn = document.getElementById('read-config');
const configStatusEl = document.getElementById('config-status');
const configFormEl = document.getElementById('config-form');
const deviceIdInput = document.getElementById('deviceId');
const wifiSsidInput = document.getElementById('wifi-ssid');
const wifiPasswordInput = document.getElementById('wifi-password');
const editConfigBtn = document.getElementById('edit-config');
const saveConfigBtn = document.getElementById('save-config');
const generateUidBtn = document.getElementById('generate-uid');

// Referencias a elementos de instrucciones
const instructionsToggle = document.getElementById('instructions-toggle');
const instructionsContent = document.getElementById('instructions-content');
const browserWarning = document.getElementById('browser-warning');

// Referencias adicionales para el modal de confirmación
const confirmModal = document.getElementById('confirm-modal');
const confirmSaveBtn = document.getElementById('confirm-save');
const confirmCancelBtn = document.getElementById('confirm-cancel');

// Variables globales
let serialPort = null;
let serialReader = null;
let readableStreamClosed = null;
let isConnected = false;
let isClosing = false;
let modeConfigActive = false;
let waitingForConfigResponse = false;
let waitingForWriteResponse = false;
let isEditing = false;

// ===== FUNCIONES DE CARGA DE CONTENIDO =====

// Cargar instrucciones desde archivo markdown
async function loadInstructions() {
  try {
    const response = await fetch('instrucciones.md');
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    const markdown = await response.text();
    const htmlContent = marked.parse(markdown);
    instructionsContent.innerHTML = htmlContent;

    // Configurar las secciones desplegables
    setupInstructionSections();
  } catch (error) {
    console.error('Error al cargar instrucciones:', error);
    instructionsContent.innerHTML = `
      <div class="error-loading">
        <p>Error al cargar las instrucciones. Por favor, recarga la página.</p>
      </div>
    `;
  }
}

// Función para convertir las secciones de instrucciones en desplegables
function setupInstructionSections() {
  // Esperar a que el contenido esté cargado
  const checkContent = setInterval(() => {
    const content = instructionsContent.querySelector('h1');
    if (!content) return;
    
    clearInterval(checkContent);
    
    // Obtener todos los encabezados h2 que representan secciones
    const sections = instructionsContent.querySelectorAll('h2');
    
    sections.forEach(section => {
      // Crear un div para contener la sección
      const sectionContainer = document.createElement('div');
      sectionContainer.className = 'instruction-section';
      
      // Crear el botón desplegable
      const toggleButton = document.createElement('button');
      toggleButton.className = 'section-toggle-button';
      toggleButton.innerHTML = `<span class="toggle-icon">▼</span> ${section.textContent}`;
      
      // Crear el contenedor para el contenido de la sección
      const sectionContent = document.createElement('div');
      sectionContent.className = 'section-content';
      
      // Mover el contenido de la sección al nuevo contenedor
      let nextElem = section.nextElementSibling;
      while (nextElem && nextElem.tagName !== 'H2') {
        const tempElem = nextElem;
        nextElem = nextElem.nextElementSibling;
        sectionContent.appendChild(tempElem);
      }
      
      // Agregar evento al botón
      toggleButton.addEventListener('click', function() {
        this.classList.toggle('active');
        sectionContent.classList.toggle('active');
        
        // Actualizar el ícono
        const icon = this.querySelector('.toggle-icon');
        if (this.classList.contains('active')) {
          icon.textContent = '▲';
        } else {
          icon.textContent = '▼';
        }
      });
      
      // Ensamblar la sección
      sectionContainer.appendChild(toggleButton);
      sectionContainer.appendChild(sectionContent);
      
      // Reemplazar el encabezado original con la nueva sección
      section.parentNode.replaceChild(sectionContainer, section);
    });
    
    // Abrir la primera sección por defecto
    const firstSection = instructionsContent.querySelector('.section-toggle-button');
    if (firstSection) {
      firstSection.click();
    }
  }, 100);
}

// Función para cargar manifiestos de firmware con prioridad para retailmind-device y última versión arriba
async function loadFirmwareManifests() {
  try {
    const boardSelect = document.getElementById('board-select');
    boardSelect.innerHTML = '<option value="">Cargando versiones...</option>';
    
    console.log("Iniciando carga de manifiestos de firmware...");
    
    // Cargar la lista de directorios desde el archivo JSON
    const dirListResponse = await fetch('firmware-list.json');
    if (!dirListResponse.ok) {
      throw new Error(`Error HTTP al cargar firmware-list.json: ${dirListResponse.status}`);
    }
    
    const dirListData = await dirListResponse.json();
    const directories = dirListData.directories || [];
    
    console.log("Directorios encontrados en firmware-list.json:", directories);
    
    // Array para almacenar la información de los manifiestos
    let manifestsInfo = [];
    
    // Comprobamos cada directorio para un manifest.json
    for (const dir of directories) {
      try {
        const manifestUrl = `${dir}/manifest.json`;
        console.log(`Intentando cargar manifiesto desde: ${manifestUrl}`);
        
        const response = await fetch(manifestUrl);
        if (!response.ok) {
          console.warn(`No se pudo cargar el manifiesto en ${manifestUrl}: HTTP ${response.status}`);
          continue;
        }
        
        const manifest = await response.json();
        console.log(`Manifiesto cargado desde ${dir}:`, manifest);
        
        // Obtener los valores name y version del manifiesto
        const name = manifest.name || 'Sin nombre';
        const version = manifest.version || 'Sin versión';
        let chipFamily = '';
        
        // Intentar obtener chipFamily desde diferentes estructuras posibles
        if (manifest.builds && manifest.builds.length > 0) {
          chipFamily = manifest.builds[0].chipFamily || '';
        }
        
        // Guardar la información para ordenar después
        manifestsInfo.push({
          url: manifestUrl,
          name: name,
          version: version,
          chipFamily: chipFamily,
          versionNum: parseVersion(version), // Convertir versión a número para ordenar
          isRetailmind: name.toLowerCase().startsWith('retailmind-device') // Flag para priorizar
        });
      } catch (e) {
        console.error(`Error al procesar manifiesto en ${dir}:`, e);
      }
    }
    
    // Ordenar los manifiestos primero por tipo (retailmind primero) y luego por versión (descendente)
    manifestsInfo.sort((a, b) => {
      // Primero comparar si es retailmind
      if (a.isRetailmind && !b.isRetailmind) return -1;
      if (!a.isRetailmind && b.isRetailmind) return 1;
      
      // Si ambos son del mismo tipo, ordenar por versión (descendente)
      return b.versionNum - a.versionNum;
    });
    
    // Limpiar el select
    boardSelect.innerHTML = '';
    
    // Agregar las opciones ordenadas
    if (manifestsInfo.length > 0) {
      manifestsInfo.forEach(info => {
        const option = document.createElement('option');
        option.value = info.url;
        option.textContent = `${info.name} v${info.version} ${info.chipFamily ? `(${info.chipFamily})` : ''}`;
        boardSelect.appendChild(option);
        console.log(`Opción añadida: ${option.textContent}`);
      });
      
      // Actualizar la descripción con la primera opción (retailmind más reciente)
      await updateFirmwareDescription();
    } else {
      console.error("No se encontraron manifiestos válidos");
      boardSelect.innerHTML = '<option value="">No se encontraron versiones de firmware</option>';
    }
  } catch (error) {
    console.error('Error al cargar manifiestos:', error);
    boardSelect.innerHTML = `<option value="">Error: ${error.message}</option>`;
  }
}

// Función auxiliar para convertir string de versión a número para ordenar
function parseVersion(versionStr) {
  try {
    // Convertir "1.1" a 1.1 (número)
    const parts = versionStr.split('.');
    let result = 0;
    for (let i = 0; i < parts.length; i++) {
      result += parseFloat(parts[i]) / Math.pow(100, i);
    }
    return result;
  } catch (e) {
    console.warn(`Error al parsear versión ${versionStr}:`, e);
    return 0; // Valor por defecto si hay error
  }
}

// Función auxiliar para convertir string de versión a número para ordenar
function parseVersion(versionStr) {
  try {
    // Convertir "1.1" a 1.1 (número)
    const parts = versionStr.split('.');
    let result = 0;
    for (let i = 0; i < parts.length; i++) {
      result += parseFloat(parts[i]) / Math.pow(100, i);
    }
    return result;
  } catch (e) {
    console.warn(`Error al parsear versión ${versionStr}:`, e);
    return 0; // Valor por defecto si hay error
  }
}

// Función para cargar descripción del firmware desde archivo markdown
async function loadFirmwareDescription(manifestPath) {
  try {
    // La ruta ya contiene la carpeta, así que solo necesitamos extraer el directorio
    const lastSlashIndex = manifestPath.lastIndexOf('/');
    // Si no hay slash, usamos la ruta completa
    const firmwareDir = lastSlashIndex !== -1 ? 
      manifestPath.substring(0, lastSlashIndex) : 
      manifestPath;
    
    const descriptionPath = `${firmwareDir}/README.md`;
    
    const response = await fetch(descriptionPath);
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    const markdown = await response.text();
    return marked.parse(markdown);
  } catch (error) {
    console.error(`Error al cargar descripción para ${manifestPath}:`, error);
    return `<div class="error-loading">No se pudo cargar la descripción para esta versión.</div>`;
  }
}

// Actualizar la descripción del firmware
async function updateFirmwareDescription() {
  const selectedManifest = boardSelect.value;
  
  if (!selectedManifest) {
    versionDescription.style.display = 'none';
    return;
  }
  
  espInstallButton.setAttribute('manifest', selectedManifest);

  versionDescription.innerHTML = '<div class="loading">Cargando descripción...</div>';
  versionDescription.style.display = 'block';
  
  try {
    const htmlContent = await loadFirmwareDescription(selectedManifest);
    versionDescription.innerHTML = htmlContent;
  } catch (error) {
    versionDescription.innerHTML = '<div class="error-loading">Error al cargar la descripción.</div>';
  }
}

// ===== FUNCIONES DE UI =====

// Verificación de navegador compatible
function checkBrowserCompatibility() {
  const hasWebSerial = 'serial' in navigator;
  const isChrome = /Chrome/.test(navigator.userAgent) && !/Edg/.test(navigator.userAgent);
  const isEdge = /Edg/.test(navigator.userAgent);
  
  if (!hasWebSerial || (!isChrome && !isEdge)) {
    browserWarning.style.display = 'flex';
    
    // Deshabilitar botones
    const installButtons = document.querySelectorAll('esp-web-install-button button, #config-button');
    installButtons.forEach(button => {
      button.disabled = true;
      button.title = "Navegador no compatible. Use Chrome o Edge.";
    });
  }
}

// Manejar el panel colapsable de instrucciones
function toggleInstructions() {
  const isActive = instructionsContent.classList.contains('active');
  
  if (isActive) {
    instructionsContent.classList.remove('active');
    instructionsToggle.classList.remove('active');
    instructionsToggle.innerHTML = '<span class="toggle-icon">▼</span> Mostrar instrucciones';
  } else {
    instructionsContent.classList.add('active');
    instructionsToggle.classList.add('active');
    instructionsToggle.innerHTML = '<span class="toggle-icon">▲</span> Ocultar instrucciones';
  }
}

// Actualizar estado en la UI
function updateStatus(message, type = 'info') {
  configStatusEl.textContent = `Estado: ${message}`;
  
  // Quitar todas las clases de estado
  configStatusEl.classList.remove('connecting', 'error', 'success');
  
  // Añadir clase según tipo de mensaje
  if (type === 'connecting') {
    configStatusEl.classList.add('connecting');
  } else if (type === 'error') {
    configStatusEl.classList.add('error');
  } else if (type === 'success') {
    configStatusEl.classList.add('success');
  }
}

// Actualizar UI según estado de conexión
function updateConnectionUI(connected) {
  // Actualizar estado del toggle de modo configuración
  configModeToggle.disabled = !connected;
  
  // Mostrar/ocultar formulario según estado de conexión
  configFormEl.style.opacity = connected ? '1' : '0.6';
  
  // Actualizar botones de edición
  editConfigBtn.disabled = !connected || !modeConfigActive;
  
  // Actualizar UI para botones relacionados con modo config
  updateModeConfigUI(modeConfigActive);
}

// Actualizar UI según modo config
function updateModeConfigUI(active) {
  configModeToggle.checked = active;
  readConfigBtn.disabled = !active || !isConnected || isClosing;
  editConfigBtn.disabled = !active || !isConnected || isClosing;
}

// Habilitar/deshabilitar modo edición
function toggleEditMode(enable) {
  isEditing = enable;
  
  const formInputs = document.querySelectorAll('#config-form .form-control');
  formInputs.forEach(input => {
    if (input.id !== 'deviceId') { // No permitir editar ID directamente
      input.readOnly = !enable;
      if (enable) {
        input.classList.add('editable');
      } else {
        input.classList.remove('editable');
      }
    }
  });
  
  // Habilitar/deshabilitar el botón de generar UID
  generateUidBtn.disabled = !enable;
  
  editConfigBtn.disabled = enable || !modeConfigActive || !isConnected;
  saveConfigBtn.disabled = !enable;
}

// Función para generar un UUID v4
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ===== FUNCIONES PARA MODAL DE CONFIRMACIÓN =====

// Abrir modal de confirmación
function openConfirmModal() {
  confirmModal.style.display = 'block';
  document.body.style.overflow = 'hidden';
}

// Cerrar modal de confirmación
function closeConfirmModal() {
  confirmModal.style.display = 'none';
  document.body.style.overflow = 'auto';
}

// ===== FUNCIONES DE GESTIÓN DEL MODAL =====

// Abrir modal con conexión automática
async function openModal() {
  configModal.style.display = 'block';
  document.body.style.overflow = 'hidden'; 
  
  // Limpiar formulario
  deviceIdInput.value = '';
  wifiSsidInput.value = '';
  wifiPasswordInput.value = '';
  
  // Iniciar la conexión automáticamente al abrir el modal
  updateStatus('Solicitando puerto USB...', 'connecting');
  configStatusEl.classList.add('connecting-indicator');
  
  try {
    serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate: 115200 });
    
    isConnected = true;
    isClosing = false;
    updateConnectionUI(true);
    updateStatus('Conectado al puerto serial', 'success');
    
    startSerialReading();
  } catch (error) {
    if (error.name === 'NotFoundError') {
      updateStatus('No se seleccionó ningún puerto', 'error');
    } else {
      updateStatus(`Error: ${error.message || 'Fallo al conectar'}`, 'error');
    }
    
    isConnected = false;
    isClosing = false;
    updateConnectionUI(false);
  } finally {
    configStatusEl.classList.remove('connecting-indicator');
  }
}

// Cerrar modal con desconexión automática
async function closeModalFn() {
  // Desactivar modo edición si está activo
  if (isEditing) {
    toggleEditMode(false);
  }
  
  // Si hay una conexión activa, desconectar al cerrar el modal
  if (isConnected && !isClosing) {
    await disconnectSerial();
  }
  
  configModal.style.display = 'none';
  document.body.style.overflow = 'auto';
}

// ===== FUNCIONES DE COMUNICACIÓN SERIAL =====

// Desconectar puerto serial
async function disconnectSerial() {
  if (!serialPort || isClosing) {
    if (isClosing) {
      updateStatus('Desconectando, por favor espera...', 'connecting');
    }
    return;
  }
  
  isClosing = true;
  updateConnectionUI(false);
  updateStatus('Desconectando...', 'connecting');
  
  try {
    // Desactivar modo config si está activo
    if (modeConfigActive) {
      await sendCommand('MODE_CONFIG OFF', false);
      await new Promise(resolve => setTimeout(resolve, 500));
      modeConfigActive = false;
    }
    
    // Cerrar lectura y puerto
    if (serialReader) {
      await serialReader.cancel();
      if (readableStreamClosed) {
        await readableStreamClosed.catch(() => {});
      }
    }
    
    if (serialPort) {
      await serialPort.close();
    }
    
    serialPort = null;
    serialReader = null;
    readableStreamClosed = null;
    isConnected = false;
    
    updateStatus('Desconectado del puerto serial');
  } catch (error) {
    console.error('Error al desconectar:', error);
    updateStatus(`Error: ${error.message || 'Fallo al desconectar'}`, 'error');
    
    isConnected = false;
    serialPort = null;
    serialReader = null;
    readableStreamClosed = null;
  } finally {
    isClosing = false;
    modeConfigActive = false;
    waitingForConfigResponse = false;
    waitingForWriteResponse = false;
    updateConnectionUI(false);
  }
}

// Iniciar lectura del puerto serial
async function startSerialReading() {
  if (!serialPort?.readable) {
    console.error('El puerto serial no está disponible para lectura');
    updateStatus('Error: Puerto serial no disponible', 'error');
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
          break;
        }
        
        buffer += textDecoder.decode(value);
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (!line.trim()) continue;
          
          const cleanLine = stripAnsiEscapeCodes(line.trim());
          
          // Procesar respuestas de configuración
          if (cleanLine.includes('{') && cleanLine.includes('}') || 
              cleanLine.includes('Config loaded:')) {
            if (waitingForConfigResponse) {
              processConfigInfo(cleanLine);
              waitingForConfigResponse = false;
            }
          }
          
          // Procesar respuestas de guardado
          if (waitingForWriteResponse) {
            if (cleanLine.includes('CONFIG_WRITE: Success')) {
              updateStatus('Configuración guardada correctamente', 'success');
              waitingForWriteResponse = false;
            } else if (cleanLine.includes('CONFIG_WRITE: Error')) {
              updateStatus('Error al guardar la configuración', 'error');
              waitingForWriteResponse = false;
            }
          }
          
          // Detectar cambios en modo config
          if (cleanLine.includes('MODE_CONFIG: Starting mode_config')) {
            modeConfigActive = true;
            updateStatus('Modo Config ACTIVADO', 'success');
            updateModeConfigUI(true);
          } else if (cleanLine.includes('MODE_CONFIG: Stopping mode_config')) {
            modeConfigActive = false;
            updateStatus('Modo Config DESACTIVADO');
            updateModeConfigUI(false);
            toggleEditMode(false); // Desactivar modo edición si se desactiva el modo config
          }
        }
      } catch (readError) {
        if (readError.name === 'NetworkError') {
          updateStatus('Dispositivo desconectado', 'error');
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } catch (error) {
    updateStatus(`Error: ${error.message || 'Fallo de comunicación'}`, 'error');
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
    updateStatus('No hay conexión serial activa', 'error');
    return false;
  }

  try {
    const writer = serialPort.writable.getWriter();
    
    if (command === 'CONFIG_READ') {
      waitingForConfigResponse = true;
    } else if (command.startsWith('CONFIG_WRITE')) {
      waitingForWriteResponse = true;
    }
    
    await writer.write(new TextEncoder().encode(command + '\n'));
    writer.releaseLock();
    
    updateUI && updateStatus(`Comando "${command.split(' ')[0]}" enviado`, 'connecting');
    
    if (command === 'MODE_CONFIG ON') {
      modeConfigActive = true;
      updateModeConfigUI(true);
    } else if (command === 'MODE_CONFIG OFF') {
      modeConfigActive = false;
      updateModeConfigUI(false);
      toggleEditMode(false); // Desactivar modo edición si se desactiva el modo config
    }
    
    return true;
  } catch (error) {
    updateStatus(`Error: ${error.message || 'Fallo al enviar el comando'}`, 'error');
    
    error.name === 'NetworkError' && await disconnectSerial();
    
    return false;
  }
}

// ===== FUNCIONES AUXILIARES =====

// Función para limpiar códigos ANSI
function stripAnsiEscapeCodes(text) {
  return text.replace(/\x1B\[\d+(?:;\d+)*m/g, '')
             .replace(/\[\d+(?:;\d+)*m/g, '');
}

// Procesar respuestas JSON de configuración
function processConfigInfo(configText) {
  try {
    if (configText.includes('{') && configText.includes('}')) {
      const jsonStart = configText.indexOf('{');
      const jsonEnd = configText.lastIndexOf('}') + 1;
      const jsonStr = configText.substring(jsonStart, jsonEnd);
      
      try {
        const configData = JSON.parse(jsonStr);
        deviceIdInput.value = configData.deviceId || '';
        wifiSsidInput.value = configData.wifi_ssid || '';
        wifiPasswordInput.value = configData.wifi_password || '';
        updateStatus('Configuración cargada correctamente', 'success');
        return true;
      } catch (e) {
        console.error('Error al parsear JSON:', e);
        updateStatus('Error: Formato de configuración no válido', 'error');
      }
    } else {
      updateStatus('Error: No se encontró configuración válida', 'error');
    }
    return false;
  } catch (e) {
    console.error('Error al procesar la configuración:', e);
    updateStatus('Error: No se pudo procesar la configuración', 'error');
    return false;
  }
}

// Guardar configuración en el dispositivo
async function saveConfig() {
  // Obtener valores actuales
  const configData = {
    deviceId: deviceIdInput.value,
    wifi_ssid: wifiSsidInput.value,
    wifi_password: wifiPasswordInput.value
  };
  
  // Validar datos
  if (!configData.wifi_ssid.trim()) {
    updateStatus('Error: El SSID WiFi no puede estar vacío', 'error');
    return false;
  }
  
  // Serializar a JSON
  const configJSON = JSON.stringify(configData);
  
  // Enviar comando
  updateStatus('Guardando configuración...', 'connecting');
  return await sendCommand(`CONFIG_WRITE ${configJSON}`, false);
}

// ===== EVENTOS =====

// Eventos principales
boardSelect.addEventListener('change', updateFirmwareDescription);
configButton.addEventListener('click', openModal);
closeModal.addEventListener('click', closeModalFn);
instructionsToggle.addEventListener('click', toggleInstructions);

// Toggle para modo config
configModeToggle.addEventListener('change', function() {
  if (this.checked) {
    sendCommand('MODE_CONFIG ON') && updateStatus('Activando Modo Config...', 'connecting');
  } else {
    sendCommand('MODE_CONFIG OFF') && updateStatus('Desactivando Modo Config...', 'connecting');
  }
});

// Manejar cierre del modal al hacer clic fuera del contenido
configModal.addEventListener('click', function(event) {
  if (event.target === configModal) {
    closeModalFn();
  }
});

// Evento de botón para generar UUID
generateUidBtn.addEventListener('click', function() {
  deviceIdInput.value = generateUUID();
  updateStatus('ID de dispositivo generado', 'success');
});

// Evento de botón para leer configuración
readConfigBtn.addEventListener('click', async () => {
  updateStatus('Leyendo configuración...', 'connecting');
  await sendCommand('CONFIG_READ');
});

// Evento de botón para editar configuración
editConfigBtn.addEventListener('click', function() {
  toggleEditMode(true);
});

// Evento de botón para guardar configuración
saveConfigBtn.addEventListener('click', function() {
  openConfirmModal();
});

// Eventos de modal de confirmación
confirmSaveBtn.addEventListener('click', async function() {
  closeConfirmModal();
  if (await saveConfig()) {
    toggleEditMode(false);
  }
});

confirmCancelBtn.addEventListener('click', function() {
  closeConfirmModal();
});

// Cerrar el modal de confirmación al hacer clic fuera
confirmModal.addEventListener('click', function(event) {
  if (event.target === confirmModal) {
    closeConfirmModal();
  }
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

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', () => {
  // Verificar compatibilidad del navegador
  checkBrowserCompatibility();
  
  // Cargar instrucciones desde archivo markdown
  loadInstructions();
  
  // Cargar manifiestos de firmware dinámicamente
  loadFirmwareManifests();
});