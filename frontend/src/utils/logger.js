class Logger {
  static logLevels = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  };

  static currentLevel = this.logLevels.INFO; // Default Level
  static lastPrinterStatus = {};
  static lastLogTime = {};
  static lastNotificationStatus = null;
  static LOG_INTERVAL = 10000; // 10 Sekunden zwischen gleichen Logs

  static setLogLevel(level) {
    this.currentLevel = this.logLevels[level] || this.logLevels.INFO;
  }

  static shouldLog(type, message) {
    const now = Date.now();
    const key = `${type}-${message}`;
    if (this.lastLogTime[key] && (now - this.lastLogTime[key] < this.LOG_INTERVAL)) {
      return false;
    }
    this.lastLogTime[key] = now;
    return true;
  }

  static debug(...args) {
    if (this.currentLevel <= this.logLevels.DEBUG && this.shouldLog('debug', args[0])) {
      console.debug(...args);
    }
  }

  static info(...args) {
    if (this.currentLevel <= this.logLevels.INFO && this.shouldLog('info', args[0])) {
      console.info(...args);
    }
  }

  static warn(...args) {
    if (this.currentLevel <= this.logLevels.WARN) {
      console.warn(...args);
    }
  }

  static error(...args) {
    if (this.currentLevel <= this.logLevels.ERROR) {
      console.error(...args);
    }
  }

  static notification(message, data = null) {
    // Für Status-Checks
    if (message.includes('Checking notification status')) {
      // Nur loggen wenn sich der Status geändert hat
      const statusStr = JSON.stringify(data);
      if (statusStr !== this.lastNotificationStatus) {
        this.info(`[Notification] ${message}`, data);
        this.lastNotificationStatus = statusStr;
      }
      return;
    }
    
    // Alle anderen Notification-Logs normal ausgeben
    this.info(`[Notification] ${message}`, data);
  }

  static apiResponse(endpoint, data) {
    if (this.currentLevel <= this.logLevels.DEBUG) {
      const temps = data?.temperatures || data?.temps;
      const status = data?.status;
      const progress = data?.progress;

      // Kompaktes Logging in einer Zeile
      this.debug(
        `[API] ${endpoint} | ` +
        `Status: ${status || 'N/A'} | ` +
        `Progress: ${progress || 0}% | ` +
        `Temps: ${temps ? `Bed: ${temps.bed}°C, Nozzle: ${temps.nozzle}°C` : 'N/A'}`
      );
    }
  }

  static logPrinterStatus(printerId, status) {
    const lastStatus = this.lastPrinterStatus[printerId];
    
    // Nur loggen wenn sich etwas Wichtiges geändert hat
    if (!lastStatus || 
        lastStatus.status !== status.status ||
        lastStatus.progress !== status.progress ||
        Math.abs(lastStatus.temperatures.bed - status.temperatures.bed) > 1 ||
        Math.abs(lastStatus.temperatures.nozzle - status.temperatures.nozzle) > 1) {
      
      // Kompaktes Status-Logging
      const temps = status.temperatures;
      this.info(`Printer ${printerId}: ${status.status} | Progress: ${status.progress}% | Temps - Bed: ${temps.bed}°C, Nozzle: ${temps.nozzle}°C`);
      
      this.lastPrinterStatus[printerId] = status;
    }
  }

  // Spezielle Methode für Stream-Logs
  static logStream(type, message) {
    if (this.currentLevel <= this.logLevels.DEBUG && this.shouldLog('stream', `${type}-${message}`)) {
      this.debug(`[Stream] ${type}: ${message}`);
    }
  }

  static printer(...args) {
    if (this.currentLevel <= this.logLevels.DEBUG && this.shouldLog('printer', args[0])) {
      this.debug(`[Printer]`, ...args);
    }
  }

  static api(...args) {
    if (this.currentLevel <= this.logLevels.DEBUG && this.shouldLog('api', args[0])) {
      this.debug(`[API]`, ...args);
    }
  }
}

// Setze Log-Level basierend auf Umgebung
if (process.env.NODE_ENV === 'production') {
  Logger.setLogLevel('WARN');
} else {
  Logger.setLogLevel('DEBUG');
}

export default Logger; 