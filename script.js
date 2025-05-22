/**
 * RetailMind Firmware Installer
 * Main application script for ESP32 firmware installation and configuration
 */

// =============================================================================
// CONSTANTS AND CONFIGURATION
// =============================================================================

const CONFIG = {
  SERIAL_BAUD_RATE: 115200,
  BATTERY_UPDATE_INTERVAL: 20000, // 20 seconds
  CONFIG_TIMEOUT: 5000,
  INSTRUCTION_CHECK_INTERVAL: 100,
  DEVICE_RESTART_DELAY: 5000,
  FIRMWARE_LIST_FILE: 'firmware-list.json',
  INSTRUCTIONS_FILE: 'instrucciones.md'
};

const SERIAL_COMMANDS = {
  MODE_CONFIG_ON: 'MODE_CONFIG ON',
  MODE_CONFIG_OFF: 'MODE_CONFIG OFF',
  CONFIG_READ: 'CONFIG_READ',
  CONFIG_WRITE: 'CONFIG_WRITE',
  BATTERY_STATUS: 'BATTERY_STATUS',
  RESET: 'RESET'
};

const STATUS_TYPES = {
  INFO: 'info',
  CONNECTING: 'connecting',
  ERROR: 'error',
  SUCCESS: 'success'
};

// =============================================================================
// DOM ELEMENT REFERENCES
// =============================================================================

class DOMElements {
  constructor() {
    // Main interface elements
    this.espInstallButton = document.querySelector('esp-web-install-button');
    this.boardSelect = document.getElementById('board-select');
    this.versionDescription = document.getElementById('version-description');
    this.configButton = document.getElementById('config-button');
    
    // Modal elements
    this.configModal = document.getElementById('config-modal');
    this.closeModal = document.querySelector('.close-modal');
    this.batteryIndicator = document.getElementById('battery-indicator');
    
    // Configuration elements
    this.configModeToggle = document.getElementById('config-mode-toggle');
    this.readConfigBtn = document.getElementById('read-config');
    this.configStatusEl = document.getElementById('config-status');
    this.configFormEl = document.getElementById('config-form');
    
    // Form inputs
    this.deviceIdInput = document.getElementById('deviceId');
    this.wifiSsidInput = document.getElementById('wifi-ssid');
    this.wifiPasswordInput = document.getElementById('wifi-password');
    this.audioFormatSelect = document.getElementById('audio-format');
    
    // Action buttons
    this.editConfigBtn = document.getElementById('edit-config');
    this.saveConfigBtn = document.getElementById('save-config');
    this.generateUidBtn = document.getElementById('generate-uid');
    
    // Instructions elements
    this.instructionsToggle = document.getElementById('instructions-toggle');
    this.instructionsContent = document.getElementById('instructions-content');
    
    // Confirmation modal elements
    this.confirmModal = document.getElementById('confirm-modal');
    this.confirmSaveBtn = document.getElementById('confirm-save');
    this.confirmCancelBtn = document.getElementById('confirm-cancel');
    
    // Warning elements
    this.browserWarning = document.getElementById('browser-warning');
  }
}

// =============================================================================
// APPLICATION STATE
// =============================================================================

class ApplicationState {
  constructor() {
    this.serialPort = null;
    this.serialReader = null;
    this.readableStreamClosed = null;
    this.isConnected = false;
    this.isClosing = false;
    this.modeConfigActive = false;
    this.waitingForConfigResponse = false;
    this.waitingForWriteResponse = false;
    this.isEditing = false;
    this.batteryStatusInterval = null;
  }

  reset() {
    this.serialPort = null;
    this.serialReader = null;
    this.readableStreamClosed = null;
    this.isConnected = false;
    this.isClosing = false;
    this.modeConfigActive = false;
    this.waitingForConfigResponse = false;
    this.waitingForWriteResponse = false;
    this.isEditing = false;
    this.clearBatteryInterval();
  }

  clearBatteryInterval() {
    if (this.batteryStatusInterval) {
      clearInterval(this.batteryStatusInterval);
      this.batteryStatusInterval = null;
    }
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

class Utils {
  /**
   * Generate a UUID v4
   * @returns {string} UUID string
   */
  static generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Parse version string to number for sorting
   * @param {string} versionStr - Version string (e.g., "1.2.3")
   * @returns {number} Numeric version for comparison
   */
  static parseVersion(versionStr) {
    try {
      const parts = versionStr.split('.');
      let result = 0;
      for (let i = 0; i < parts.length; i++) {
        result += parseFloat(parts[i]) / Math.pow(100, i);
      }
      return result;
    } catch (error) {
      console.warn(`Error parsing version ${versionStr}:`, error);
      return 0;
    }
  }

  /**
   * Remove ANSI escape codes from text
   * @param {string} text - Text with potential ANSI codes
   * @returns {string} Clean text
   */
  static stripAnsiEscapeCodes(text) {
    return text.replace(/\x1B\[\d+(?:;\d+)*m/g, '')
               .replace(/\[\d+(?:;\d+)*m/g, '');
  }

  /**
   * Check if browser supports Web Serial API
   * @returns {object} Browser compatibility info
   */
  static checkBrowserCompatibility() {
    const hasWebSerial = 'serial' in navigator;
    const isChrome = /Chrome/.test(navigator.userAgent) && !/Edg/.test(navigator.userAgent);
    const isEdge = /Edg/.test(navigator.userAgent);
    
    return {
      isSupported: hasWebSerial && (isChrome || isEdge),
      hasWebSerial,
      isChrome,
      isEdge
    };
  }

  /**
   * Delay execution for specified milliseconds
   * @param {number} ms - Milliseconds to wait
   * @returns {Promise} Promise that resolves after delay
   */
  static delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =============================================================================
// CONTENT LOADER
// =============================================================================

class ContentLoader {
  constructor(dom) {
    this.dom = dom;
  }

  /**
   * Load instructions from markdown file
   */
  async loadInstructions() {
    try {
      const response = await fetch(CONFIG.INSTRUCTIONS_FILE);
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }
      
      const markdown = await response.text();
      const htmlContent = marked.parse(markdown);
      this.dom.instructionsContent.innerHTML = htmlContent;

      this.setupInstructionSections();
    } catch (error) {
      console.error('Error loading instructions:', error);
      this.dom.instructionsContent.innerHTML = `
        <div class="error-loading">
          <p>Error al cargar las instrucciones. Por favor, recarga la página.</p>
        </div>
      `;
    }
  }

  /**
   * Convert instruction sections to collapsible format
   */
  setupInstructionSections() {
    const checkContent = setInterval(() => {
      const content = this.dom.instructionsContent.querySelector('h1');
      if (!content) return;
      
      clearInterval(checkContent);
      this.createCollapsibleSections();
    }, CONFIG.INSTRUCTION_CHECK_INTERVAL);
  }

  /**
   * Create collapsible sections from h2 headers
   */
  createCollapsibleSections() {
    const sections = this.dom.instructionsContent.querySelectorAll('h2');
    
    sections.forEach(section => {
      const sectionContainer = this.createSectionContainer(section);
      section.parentNode.replaceChild(sectionContainer, section);
    });
    
    // Open first section by default
    const firstSection = this.dom.instructionsContent.querySelector('.section-toggle-button');
    if (firstSection) {
      firstSection.click();
    }
  }

  /**
   * Create a collapsible section container
   * @param {HTMLElement} section - Section header element
   * @returns {HTMLElement} Section container
   */
  createSectionContainer(section) {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'instruction-section';
    
    const toggleButton = document.createElement('button');
    toggleButton.className = 'section-toggle-button';
    toggleButton.innerHTML = `<span class="toggle-icon">▼</span> ${section.textContent}`;
    
    const sectionContent = document.createElement('div');
    sectionContent.className = 'section-content';
    
    // Move section content to new container
    let nextElem = section.nextElementSibling;
    while (nextElem && nextElem.tagName !== 'H2') {
      const tempElem = nextElem;
      nextElem = nextElem.nextElementSibling;
      sectionContent.appendChild(tempElem);
    }
    
    // Add toggle functionality
    toggleButton.addEventListener('click', () => {
      this.toggleSection(toggleButton, sectionContent);
    });
    
    sectionContainer.appendChild(toggleButton);
    sectionContainer.appendChild(sectionContent);
    
    return sectionContainer;
  }

  /**
   * Toggle section visibility
   * @param {HTMLElement} button - Toggle button
   * @param {HTMLElement} content - Section content
   */
  toggleSection(button, content) {
    button.classList.toggle('active');
    content.classList.toggle('active');
    
    const icon = button.querySelector('.toggle-icon');
    icon.textContent = button.classList.contains('active') ? '▲' : '▼';
  }

  /**
   * Load firmware manifests from directories
   */
  async loadFirmwareManifests() {
    try {
      this.dom.boardSelect.innerHTML = '<option value="">Cargando versiones...</option>';
      console.log("Loading firmware manifests...");
      
      const directories = await this.loadDirectoryList();
      const manifestsInfo = await this.loadManifestData(directories);
      
      this.populateFirmwareSelect(manifestsInfo);
      await this.updateFirmwareDescription();
      
    } catch (error) {
      console.error('Error loading manifests:', error);
      this.dom.boardSelect.innerHTML = `<option value="">Error: ${error.message}</option>`;
    }
  }

  /**
   * Load directory list from JSON file
   * @returns {Array} Array of directory paths
   */
  async loadDirectoryList() {
    const response = await fetch(CONFIG.FIRMWARE_LIST_FILE);
    if (!response.ok) {
      throw new Error(`HTTP Error loading ${CONFIG.FIRMWARE_LIST_FILE}: ${response.status}`);
    }
    
    const data = await response.json();
    return data.directories || [];
  }

  /**
   * Load manifest data from directories
   * @param {Array} directories - Array of directory paths
   * @returns {Array} Array of manifest information
   */
  async loadManifestData(directories) {
    const manifestsInfo = [];
    
    for (const dir of directories) {
      try {
        const manifestUrl = `${dir}/manifest.json`;
        const manifest = await this.loadSingleManifest(manifestUrl);
        
        if (manifest) {
          manifestsInfo.push(this.processManifestData(manifest, manifestUrl));
        }
      } catch (error) {
        console.error(`Error processing manifest in ${dir}:`, error);
      }
    }
    
    return this.sortManifests(manifestsInfo);
  }

  /**
   * Load a single manifest file
   * @param {string} manifestUrl - URL of manifest file
   * @returns {Object|null} Manifest data or null if failed
   */
  async loadSingleManifest(manifestUrl) {
    console.log(`Loading manifest from: ${manifestUrl}`);
    
    const response = await fetch(manifestUrl);
    if (!response.ok) {
      console.warn(`Could not load manifest at ${manifestUrl}: HTTP ${response.status}`);
      return null;
    }
    
    const manifest = await response.json();
    console.log(`Manifest loaded from ${manifestUrl}:`, manifest);
    return manifest;
  }

  /**
   * Process manifest data into standardized format
   * @param {Object} manifest - Raw manifest data
   * @param {string} manifestUrl - Manifest URL
   * @returns {Object} Processed manifest info
   */
  processManifestData(manifest, manifestUrl) {
    const name = manifest.name || 'Unnamed';
    const version = manifest.version || 'No version';
    let chipFamily = '';
    
    if (manifest.builds && manifest.builds.length > 0) {
      chipFamily = manifest.builds[0].chipFamily || '';
    }
    
    return {
      url: manifestUrl,
      name,
      version,
      chipFamily,
      versionNum: Utils.parseVersion(version),
      isRetailmind: name.toLowerCase().startsWith('retailmind-device')
    };
  }

  /**
   * Sort manifests by priority (retailmind first) and version (descending)
   * @param {Array} manifestsInfo - Array of manifest info objects
   * @returns {Array} Sorted manifest info
   */
  sortManifests(manifestsInfo) {
    return manifestsInfo.sort((a, b) => {
      // Prioritize retailmind devices
      if (a.isRetailmind && !b.isRetailmind) return -1;
      if (!a.isRetailmind && b.isRetailmind) return 1;
      
      // Sort by version (descending)
      return b.versionNum - a.versionNum;
    });
  }

  /**
   * Populate firmware selection dropdown
   * @param {Array} manifestsInfo - Sorted manifest info
   */
  populateFirmwareSelect(manifestsInfo) {
    this.dom.boardSelect.innerHTML = '';
    
    if (manifestsInfo.length > 0) {
      manifestsInfo.forEach(info => {
        const option = document.createElement('option');
        option.value = info.url;
        option.textContent = `${info.name} v${info.version} ${info.chipFamily ? `(${info.chipFamily})` : ''}`;
        this.dom.boardSelect.appendChild(option);
        console.log(`Option added: ${option.textContent}`);
      });
    } else {
      console.error("No valid manifests found");
      this.dom.boardSelect.innerHTML = '<option value="">No se encontraron versiones de firmware</option>';
    }
  }

  /**
   * Load firmware description from README file
   * @param {string} manifestPath - Path to manifest file
   * @returns {string} HTML description
   */
  async loadFirmwareDescription(manifestPath) {
    try {
      const lastSlashIndex = manifestPath.lastIndexOf('/');
      const firmwareDir = lastSlashIndex !== -1 ? 
        manifestPath.substring(0, lastSlashIndex) : 
        manifestPath;
      
      const descriptionPath = `${firmwareDir}/README.md`;
      
      const response = await fetch(descriptionPath);
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }
      
      const markdown = await response.text();
      return marked.parse(markdown);
    } catch (error) {
      console.error(`Error loading description for ${manifestPath}:`, error);
      return `<div class="error-loading">No se pudo cargar la descripción para esta versión.</div>`;
    }
  }

  /**
   * Update firmware description display
   */
  async updateFirmwareDescription() {
    const selectedManifest = this.dom.boardSelect.value;
    
    if (!selectedManifest) {
      this.dom.versionDescription.style.display = 'none';
      return;
    }
    
    this.dom.espInstallButton.setAttribute('manifest', selectedManifest);
    this.dom.versionDescription.innerHTML = '<div class="loading">Cargando descripción...</div>';
    this.dom.versionDescription.style.display = 'block';
    
    try {
      const htmlContent = await this.loadFirmwareDescription(selectedManifest);
      this.dom.versionDescription.innerHTML = htmlContent;
    } catch (error) {
      this.dom.versionDescription.innerHTML = '<div class="error-loading">Error al cargar la descripción.</div>';
    }
  }
}

// =============================================================================
// UI MANAGER
// =============================================================================

class UIManager {
  constructor(dom, state) {
    this.dom = dom;
    this.state = state;
  }

  /**
   * Check browser compatibility and show warning if needed
   */
  checkBrowserCompatibility() {
    const compatibility = Utils.checkBrowserCompatibility();
    
    if (!compatibility.isSupported) {
      this.dom.browserWarning.style.display = 'flex';
      this.disableButtons();
    }
  }

  /**
   * Disable buttons for incompatible browsers
   */
  disableButtons() {
    const buttons = document.querySelectorAll('esp-web-install-button button, #config-button');
    buttons.forEach(button => {
      button.disabled = true;
      button.title = "Navegador no compatible. Use Chrome o Edge.";
    });
  }

  /**
   * Toggle instructions panel visibility
   */
  toggleInstructions() {
    const isActive = this.dom.instructionsContent.classList.contains('active');
    const toggleIcon = this.dom.instructionsToggle.querySelector('.toggle-icon');
    const toggleText = this.dom.instructionsToggle.querySelector('span:not(.toggle-icon)');
    
    if (isActive) {
      this.dom.instructionsContent.classList.remove('active');
      this.dom.instructionsToggle.classList.remove('active');
      toggleIcon.textContent = '▼';
      toggleText.textContent = 'Mostrar instrucciones';
      this.dom.instructionsToggle.setAttribute('aria-expanded', 'false');
    } else {
      this.dom.instructionsContent.classList.add('active');
      this.dom.instructionsToggle.classList.add('active');
      toggleIcon.textContent = '▲';
      toggleText.textContent = 'Ocultar instrucciones';
      this.dom.instructionsToggle.setAttribute('aria-expanded', 'true');
    }
  }

  /**
   * Update status message and styling
   * @param {string} message - Status message
   * @param {string} type - Status type (info, connecting, error, success)
   */
  updateStatus(message, type = STATUS_TYPES.INFO) {
    this.dom.configStatusEl.textContent = `Estado: ${message}`;
    
    // Remove all status classes
    Object.values(STATUS_TYPES).forEach(statusType => {
      this.dom.configStatusEl.classList.remove(statusType);
    });
    
    // Add appropriate status class
    if (Object.values(STATUS_TYPES).includes(type)) {
      this.dom.configStatusEl.classList.add(type);
    }
  }

  /**
   * Update UI based on connection state
   * @param {boolean} connected - Connection status
   */
  updateConnectionUI(connected) {
    this.dom.configModeToggle.disabled = !connected;
    this.dom.configFormEl.style.opacity = connected ? '1' : '0.6';
    this.dom.editConfigBtn.disabled = !connected || !this.state.modeConfigActive;
    this.updateModeConfigUI(this.state.modeConfigActive);
  }

  /**
   * Update UI based on config mode state
   * @param {boolean} active - Config mode active status
   */
  updateModeConfigUI(active) {
    this.dom.configModeToggle.checked = active;
    this.dom.readConfigBtn.disabled = !active || !this.state.isConnected || this.state.isClosing;
    this.dom.editConfigBtn.disabled = !active || !this.state.isConnected || this.state.isClosing;
  }

  /**
   * Toggle edit mode for configuration form
   * @param {boolean} enable - Enable edit mode
   */
  toggleEditMode(enable) {
    this.state.isEditing = enable;
    
    const formInputs = document.querySelectorAll('#config-form .form-control');
    formInputs.forEach(input => {
      if (input.id !== 'deviceId') {
        input.readOnly = !enable;
        input.classList.toggle('editable', enable);
      }
    });

    this.dom.audioFormatSelect.disabled = !enable;
    this.dom.generateUidBtn.disabled = !enable;
    this.dom.editConfigBtn.disabled = enable || !this.state.modeConfigActive || !this.state.isConnected;
    this.dom.saveConfigBtn.disabled = !enable;
  }

  /**
   * Update battery indicator display
   * @param {number} percentage - Battery percentage
   */
  updateBatteryIndicator(percentage) {
    this.dom.batteryIndicator.textContent = `🔋${percentage}%`;
    this.dom.batteryIndicator.setAttribute('aria-label', `Estado de batería: ${percentage}%`);
  }

  /**
   * Open configuration modal
   */
  openModal() {
    this.dom.configModal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    this.dom.configModal.focus();
  }

  /**
   * Close configuration modal
   */
  closeModal() {
    this.dom.configModal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }

  /**
   * Open confirmation modal
   */
  openConfirmModal() {
    this.dom.confirmModal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    this.dom.confirmModal.focus();
  }

  /**
   * Close confirmation modal
   */
  closeConfirmModal() {
    this.dom.confirmModal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }

  /**
   * Clear configuration form
   */
  clearConfigForm() {
    this.dom.deviceIdInput.value = '';
    this.dom.wifiSsidInput.value = '';
    this.dom.wifiPasswordInput.value = '';
    this.dom.audioFormatSelect.value = '';
  }

  /**
   * Populate configuration form with data
   * @param {Object} configData - Configuration data
   */
  populateConfigForm(configData) {
    this.dom.deviceIdInput.value = configData.deviceId || '';
    this.dom.wifiSsidInput.value = configData.wifi_ssid || '';
    this.dom.wifiPasswordInput.value = configData.wifi_password || '';
    this.dom.audioFormatSelect.value = configData.audio_format || '';
  }

  /**
   * Get configuration data from form
   * @returns {Object} Configuration data
   */
  getConfigFormData() {
    return {
      deviceId: this.dom.deviceIdInput.value.trim(),
      wifi_ssid: this.dom.wifiSsidInput.value.trim(),
      wifi_password: this.dom.wifiPasswordInput.value.trim(),
      audio_format: this.dom.audioFormatSelect.value
    };
  }

  /**
   * Validate configuration data
   * @param {Object} configData - Configuration data to validate
   * @returns {Object} Validation result
   */
  validateConfigData(configData) {
    const errors = [];

    if (!configData.wifi_ssid) {
      errors.push('El SSID WiFi no puede estar vacío');
    }

    if (!configData.deviceId) {
      errors.push('El ID del dispositivo no puede estar vacío');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// =============================================================================
// SERIAL COMMUNICATION MANAGER
// =============================================================================

class SerialManager {
  constructor(dom, state, uiManager) {
    this.dom = dom;
    this.state = state;
    this.ui = uiManager;
  }

  /**
   * Request and open serial port connection
   * @returns {Promise<boolean>} Success status
   */
  async connect() {
    this.ui.updateStatus('Solicitando puerto USB...', STATUS_TYPES.CONNECTING);
    this.dom.configStatusEl.classList.add('connecting-indicator');
    
    try {
      this.state.serialPort = await navigator.serial.requestPort();
      await this.state.serialPort.open({ baudRate: CONFIG.SERIAL_BAUD_RATE });
      
      this.state.isConnected = true;
      this.state.isClosing = false;
      this.ui.updateConnectionUI(true);
      this.ui.updateStatus('Conectado al puerto serial', STATUS_TYPES.SUCCESS);
      
      this.startSerialReading();
      this.startBatteryStatusPolling();
      
      return true;
    } catch (error) {
      this.handleConnectionError(error);
      return false;
    } finally {
      this.dom.configStatusEl.classList.remove('connecting-indicator');
    }
  }

  /**
   * Handle connection errors
   * @param {Error} error - Connection error
   */
  handleConnectionError(error) {
    if (error.name === 'NotFoundError') {
      this.ui.updateStatus('No se seleccionó ningún puerto', STATUS_TYPES.ERROR);
    } else {
      this.ui.updateStatus(`Error: ${error.message || 'Fallo al conectar'}`, STATUS_TYPES.ERROR);
    }
    
    this.state.isConnected = false;
    this.state.isClosing = false;
    this.ui.updateConnectionUI(false);
  }

  /**
   * Disconnect from serial port
   */
  async disconnect() {
    if (!this.state.serialPort || this.state.isClosing) {
      if (this.state.isClosing) {
        this.ui.updateStatus('Desconectando, por favor espera...', STATUS_TYPES.CONNECTING);
      }
      return;
    }
    
    this.state.isClosing = true;
    this.ui.updateConnectionUI(false);
    this.ui.updateStatus('Desconectando...', STATUS_TYPES.CONNECTING);
    
    try {
      // Disable config mode if active
      if (this.state.modeConfigActive) {
        await this.sendCommand(SERIAL_COMMANDS.MODE_CONFIG_OFF, false);
        await Utils.delay(500);
        this.state.modeConfigActive = false;
      }
      
      // Close serial connection
      await this.closeSerialConnection();
      
      this.state.reset();
      this.ui.updateStatus('Desconectado del puerto serial');
      
    } catch (error) {
      console.error('Error disconnecting:', error);
      this.ui.updateStatus(`Error: ${error.message || 'Fallo al desconectar'}`, STATUS_TYPES.ERROR);
      this.state.reset();
    } finally {
      this.ui.updateConnectionUI(false);
    }
  }

  /**
   * Close serial connection properly
   */
  async closeSerialConnection() {
    if (this.state.serialReader) {
      await this.state.serialReader.cancel();
      if (this.state.readableStreamClosed) {
        await this.state.readableStreamClosed.catch(() => {});
      }
    }
    
    if (this.state.serialPort) {
      await this.state.serialPort.close();
    }
  }

  /**
   * Start reading from serial port
   */
  async startSerialReading() {
    if (!this.state.serialPort?.readable) {
      console.error('Serial port not available for reading');
      this.ui.updateStatus('Error: Puerto serial no disponible', STATUS_TYPES.ERROR);
      await this.disconnect();
      return;
    }
    
    const textDecoder = new TextDecoder();
    let buffer = '';
    
    try {
      this.state.serialReader = this.state.serialPort.readable.getReader();
      this.state.readableStreamClosed = this.state.serialReader.closed.catch(() => {});
      
      while (true) {
        try {
          const { value, done } = await this.state.serialReader.read();
          
          if (done) break;
          
          buffer += textDecoder.decode(value);
          buffer = this.processSerialBuffer(buffer);
          
        } catch (readError) {
          if (readError.name === 'NetworkError') {
            this.ui.updateStatus('Dispositivo desconectado', STATUS_TYPES.ERROR);
            break;
          }
          
          await Utils.delay(1000);
        }
      }
    } catch (error) {
      this.ui.updateStatus(`Error: ${error.message || 'Fallo de comunicación'}`, STATUS_TYPES.ERROR);
    } finally {
      this.cleanupSerialReader();
    }
  }

  /**
   * Process serial data buffer
   * @param {string} buffer - Serial data buffer
   * @returns {string} Remaining buffer data
   */
  processSerialBuffer(buffer) {
    const lines = buffer.split('\n');
    const remainingBuffer = lines.pop() || '';
    
    lines.forEach(line => {
      if (line.trim()) {
        this.processSerialLine(line.trim());
      }
    });
    
    return remainingBuffer;
  }

  /**
   * Process individual serial line
   * @param {string} line - Serial line data
   */
  processSerialLine(line) {
    const cleanLine = Utils.stripAnsiEscapeCodes(line);
    
    // Process configuration responses
    if ((cleanLine.includes('{') && cleanLine.includes('}')) || 
        cleanLine.includes('Config loaded:')) {
      if (this.state.waitingForConfigResponse) {
        this.processConfigResponse(cleanLine);
        this.state.waitingForConfigResponse = false;
      }
    }
    
    // Process write responses
    if (this.state.waitingForWriteResponse) {
      this.processWriteResponse(cleanLine);
    }
    
    // Process mode config changes
    this.processModeConfigChanges(cleanLine);
    
    // Process battery status
    this.processBatteryStatus(cleanLine);
  }

  /**
   * Process configuration response
   * @param {string} line - Response line
   */
  processConfigResponse(line) {
    try {
      if (line.includes('{') && line.includes('}')) {
        const jsonStart = line.indexOf('{');
        const jsonEnd = line.lastIndexOf('}') + 1;
        const jsonStr = line.substring(jsonStart, jsonEnd);
        
        const configData = JSON.parse(jsonStr);
        this.ui.populateConfigForm(configData);
        this.ui.updateStatus('Configuración cargada correctamente', STATUS_TYPES.SUCCESS);
      }
    } catch (error) {
      console.error('Error parsing config JSON:', error);
      this.ui.updateStatus('Error: Formato de configuración no válido', STATUS_TYPES.ERROR);
    }
  }

  /**
   * Process write response
   * @param {string} line - Response line
   */
  processWriteResponse(line) {
    if (line.includes('CONFIG_WRITE: Success')) {
      this.ui.updateStatus('Configuración guardada correctamente', STATUS_TYPES.SUCCESS);
      this.state.waitingForWriteResponse = false;
    } else if (line.includes('CONFIG_WRITE: Error')) {
      this.ui.updateStatus('Error al guardar la configuración', STATUS_TYPES.ERROR);
      this.state.waitingForWriteResponse = false;
    }
  }

  /**
   * Process mode config changes
   * @param {string} line - Response line
   */
  processModeConfigChanges(line) {
    if (line.includes('MODE_CONFIG: Starting mode_config')) {
      this.state.modeConfigActive = true;
      this.ui.updateStatus('Modo Config ACTIVADO', STATUS_TYPES.SUCCESS);
      this.ui.updateModeConfigUI(true);
    } else if (line.includes('MODE_CONFIG: Stopping mode_config')) {
      this.state.modeConfigActive = false;
      this.ui.updateStatus('Modo Config DESACTIVADO');
      this.ui.updateModeConfigUI(false);
      this.ui.toggleEditMode(false);
    }
  }

  /**
   * Process battery status response
   * @param {string} line - Response line
   */
  processBatteryStatus(line) {
    if (line.includes('"battery_status_percentage":')) {
      try {
        const batteryData = JSON.parse(line);
        if (batteryData.battery_status_percentage !== undefined) {
          this.ui.updateBatteryIndicator(batteryData.battery_status_percentage);
        }
      } catch (error) {
        console.error('Error processing battery status:', error);
      }
    }
  }

  /**
   * Cleanup serial reader
   */
  cleanupSerialReader() {
    if (this.state.serialReader) {
      try { 
        this.state.serialReader.releaseLock(); 
      } catch (error) {
        console.warn('Error releasing reader lock:', error);
      }
      this.state.serialReader = null;
    }
    
    if (this.state.isConnected) {
      this.disconnect();
    }
  }

  /**
   * Send command to device
   * @param {string} command - Command to send
   * @param {boolean} updateUI - Whether to update UI
   * @returns {Promise<boolean>} Success status
   */
  async sendCommand(command, updateUI = true) {
    if (!this.state.serialPort || !this.state.isConnected) {
      this.ui.updateStatus('No hay conexión serial activa', STATUS_TYPES.ERROR);
      return false;
    }

    try {
      const writer = this.state.serialPort.writable.getWriter();
      
      this.setCommandFlags(command);
      
      await writer.write(new TextEncoder().encode(command + '\n'));
      writer.releaseLock();
      
      if (updateUI) {
        this.ui.updateStatus(`Comando "${command.split(' ')[0]}" enviado`, STATUS_TYPES.CONNECTING);
      }
      
      this.handleModeConfigCommands(command);
      
      return true;
    } catch (error) {
      this.ui.updateStatus(`Error: ${error.message || 'Fallo al enviar el comando'}`, STATUS_TYPES.ERROR);
      
      if (error.name === 'NetworkError') {
        await this.disconnect();
      }
      
      return false;
    }
  }

  /**
   * Set command-specific flags
   * @param {string} command - Command being sent
   */
  setCommandFlags(command) {
    if (command === SERIAL_COMMANDS.CONFIG_READ) {
      this.state.waitingForConfigResponse = true;
    } else if (command.startsWith(SERIAL_COMMANDS.CONFIG_WRITE)) {
      this.state.waitingForWriteResponse = true;
    }
  }

  /**
   * Handle mode config command effects
   * @param {string} command - Command that was sent
   */
  handleModeConfigCommands(command) {
    if (command === SERIAL_COMMANDS.MODE_CONFIG_ON) {
      this.state.modeConfigActive = true;
      this.ui.updateModeConfigUI(true);
    } else if (command === SERIAL_COMMANDS.MODE_CONFIG_OFF) {
      this.state.modeConfigActive = false;
      this.ui.updateModeConfigUI(false);
      this.ui.toggleEditMode(false);
    }
  }

  /**
   * Start battery status polling
   */
  startBatteryStatusPolling() {
    this.state.batteryStatusInterval = setInterval(() => {
      this.requestBatteryStatus();
    }, CONFIG.BATTERY_UPDATE_INTERVAL);
    
    // Request immediately
    this.requestBatteryStatus();
  }

  /**
   * Request battery status from device
   */
  async requestBatteryStatus() {
    if (!this.state.serialPort || !this.state.isConnected) return;
    
    try {
      const writer = this.state.serialPort.writable.getWriter();
      await writer.write(new TextEncoder().encode(SERIAL_COMMANDS.BATTERY_STATUS + '\n'));
      writer.releaseLock();
    } catch (error) {
      console.error('Error requesting battery status:', error);
    }
  }
}

// =============================================================================
// CONFIGURATION MANAGER
// =============================================================================

class ConfigManager {
  constructor(dom, state, uiManager, serialManager) {
    this.dom = dom;
    this.state = state;
    this.ui = uiManager;
    this.serial = serialManager;
  }

  /**
   * Save configuration to device
   * @returns {Promise<boolean>} Success status
   */
  async saveConfig() {
    const configData = this.ui.getConfigFormData();
    const validation = this.ui.validateConfigData(configData);
    
    if (!validation.isValid) {
      this.ui.updateStatus(`Error: ${validation.errors[0]}`, STATUS_TYPES.ERROR);
      return false;
    }
    
    const configJSON = JSON.stringify(configData);
    this.ui.updateStatus('Guardando configuración...', STATUS_TYPES.CONNECTING);
    
    const success = await this.serial.sendCommand(`${SERIAL_COMMANDS.CONFIG_WRITE} ${configJSON}`, false);
    
    if (success) {
      // Send reset command and restart config mode
      await this.serial.sendCommand(SERIAL_COMMANDS.RESET);
      this.ui.updateStatus('Dispositivo reiniciado', STATUS_TYPES.SUCCESS);
      
      await Utils.delay(CONFIG.DEVICE_RESTART_DELAY);
      await this.serial.sendCommand(SERIAL_COMMANDS.MODE_CONFIG_ON);
    }
    
    return success;
  }

  /**
   * Read configuration from device
   */
  async readConfig() {
    this.ui.updateStatus('Leyendo configuración...', STATUS_TYPES.CONNECTING);
    await this.serial.sendCommand(SERIAL_COMMANDS.CONFIG_READ);
  }

  /**
   * Generate new device UUID
   */
  generateDeviceId() {
    this.dom.deviceIdInput.value = Utils.generateUUID();
    this.ui.updateStatus('ID de dispositivo generado', STATUS_TYPES.SUCCESS);
  }

  /**
   * Toggle config mode
   * @param {boolean} enable - Enable config mode
   */
  async toggleConfigMode(enable) {
    const command = enable ? SERIAL_COMMANDS.MODE_CONFIG_ON : SERIAL_COMMANDS.MODE_CONFIG_OFF;
    const statusMessage = enable ? 'Activando Modo Config...' : 'Desactivando Modo Config...';
    
    if (await this.serial.sendCommand(command)) {
      this.ui.updateStatus(statusMessage, STATUS_TYPES.CONNECTING);
    }
  }
}

// =============================================================================
// MAIN APPLICATION CLASS
// =============================================================================

class RetailMindInstaller {
  constructor() {
    this.dom = new DOMElements();
    this.state = new ApplicationState();
    this.ui = new UIManager(this.dom, this.state);
    this.serial = new SerialManager(this.dom, this.state, this.ui);
    this.config = new ConfigManager(this.dom, this.state, this.ui, this.serial);
    this.contentLoader = new ContentLoader(this.dom);
  }

  /**
   * Initialize the application
   */
  async init() {
    console.log('Initializing RetailMind Installer...');
    
    this.ui.checkBrowserCompatibility();
    this.setupEventListeners();
    
    // Load content
    await this.contentLoader.loadInstructions();
    await this.contentLoader.loadFirmwareManifests();
    
    console.log('RetailMind Installer initialized successfully');
  }

  /**
   * Setup all event listeners
   */
  setupEventListeners() {
    // Main interface events
    this.dom.boardSelect.addEventListener('change', () => {
      this.contentLoader.updateFirmwareDescription();
    });
    
    this.dom.configButton.addEventListener('click', () => {
      this.openConfigModal();
    });
    
    this.dom.instructionsToggle.addEventListener('click', () => {
      this.ui.toggleInstructions();
    });

    // Modal events
    this.setupModalEvents();
    
    // Configuration events
    this.setupConfigEvents();
    
    // Window events
    this.setupWindowEvents();
  }

  /**
   * Setup modal-related event listeners
   */
  setupModalEvents() {
    // Close modal events
    this.dom.closeModal.addEventListener('click', () => {
      this.closeConfigModal();
    });
    
    this.dom.configModal.addEventListener('click', (event) => {
      if (event.target === this.dom.configModal) {
        this.closeConfigModal();
      }
    });

    // Confirmation modal events
    this.dom.confirmSaveBtn.addEventListener('click', () => {
      this.handleConfirmSave();
    });
    
    this.dom.confirmCancelBtn.addEventListener('click', () => {
      this.ui.closeConfirmModal();
    });
    
    this.dom.confirmModal.addEventListener('click', (event) => {
      if (event.target === this.dom.confirmModal) {
        this.ui.closeConfirmModal();
      }
    });
  }

  /**
   * Setup configuration-related event listeners
   */
  setupConfigEvents() {
    // Config mode toggle
    this.dom.configModeToggle.addEventListener('change', (event) => {
      this.config.toggleConfigMode(event.target.checked);
    });

    // Configuration buttons
    this.dom.readConfigBtn.addEventListener('click', () => {
      this.config.readConfig();
    });
    
    this.dom.editConfigBtn.addEventListener('click', () => {
      this.ui.toggleEditMode(true);
    });
    
    this.dom.saveConfigBtn.addEventListener('click', () => {
      this.ui.openConfirmModal();
    });
    
    this.dom.generateUidBtn.addEventListener('click', () => {
      this.config.generateDeviceId();
    });
  }

  /**
   * Setup window-related event listeners
   */
  setupWindowEvents() {
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
  }

  /**
   * Open configuration modal
   */
  async openConfigModal() {
    this.ui.openModal();
    this.ui.clearConfigForm();
    
    // Auto-connect when opening modal
    await this.serial.connect();
  }

  /**
   * Close configuration modal
   */
  async closeConfigModal() {
    // Disable edit mode if active
    if (this.state.isEditing) {
      this.ui.toggleEditMode(false);
    }
    
    // Disconnect if connected
    if (this.state.isConnected && !this.state.isClosing) {
      await this.serial.disconnect();
    }

    this.ui.closeModal();
  }

  /**
   * Handle confirmation save
   */
  async handleConfirmSave() {
    this.ui.closeConfirmModal();
    
    if (await this.config.saveConfig()) {
      this.ui.toggleEditMode(false);
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.state.isConnected && this.state.serialPort && this.state.modeConfigActive) {
      try {
        const writer = this.state.serialPort.writable.getWriter();
        writer.write(new TextEncoder().encode(SERIAL_COMMANDS.MODE_CONFIG_OFF + '\n'));
        writer.releaseLock();
        this.state.serialReader?.cancel();
        this.state.serialPort.close();
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
    }
    
    this.state.clearBatteryInterval();
  }
}

// =============================================================================
// APPLICATION INITIALIZATION
// =============================================================================

/**
 * Initialize application when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const app = new RetailMindInstaller();
    await app.init();
    
    // Make app globally available for debugging
    window.retailMindApp = app;
  } catch (error) {
    console.error('Failed to initialize RetailMind Installer:', error);
  }
});