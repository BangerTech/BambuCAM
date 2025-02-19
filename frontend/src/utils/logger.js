const LOG_LEVELS = {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR'
};

const LOG_CATEGORIES = {
    PRINTER: 'PRINTER',
    STREAM: 'STREAM',
    NETWORK: 'NETWORK',
    API: 'API',
    SYSTEM: 'SYSTEM',
    NOTIFICATION: 'NOTIFICATION'
};

class Logger {
    static lastLogs = new Map();  // Speichert die letzten Logs pro Kategorie/Message
    
    static formatLogKey(level, category, message, data) {
        // Erstellt einen eindeutigen Schlüssel für den Log
        return `${level}-${category}-${message}-${JSON.stringify(data)}`;
    }

    static formatPrinterStatus(printer, status) {
        const name = printer?.name || 'Unknown Printer';
        const temps = [];
        
        // Vereinheitlichte Temperatur-Bezeichnungen
        if (status.temps) {
            if (status.temps.bed !== undefined) {
                temps.push(`Bed: ${status.temps.bed.toFixed(1)}°C`);
            }
            if (status.temps.nozzle !== undefined || status.temps.hotend !== undefined) {
                const temp = status.temps.nozzle || status.temps.hotend;
                temps.push(`Tool: ${temp.toFixed(1)}°C`);
            }
            if (status.temps.chamber !== undefined) {
                temps.push(`Chamber: ${status.temps.chamber.toFixed(1)}°C`);
            }
        }

        return {
            message: `Printer "${name}": ${status.status} | Progress: ${status.progress}% | Temps - ${temps.join(', ')}`,
            data: { printer, status }
        };
    }

    // Spezielle Logger-Methoden
    static logPrinterStatus(printerId, status) {
        return this.debug(
            LOG_CATEGORIES.PRINTER,
            `Printer ${printerId} status:`,
            status
        );
    }

    static logStream(message, data = null) {
        return this.debug(LOG_CATEGORIES.STREAM, message, data);
    }

    static logApi(message, data = null) {
        return this.debug(LOG_CATEGORIES.API, message, data);
    }

    static logApiResponse(endpoint, data = null) {
        return this.debug(LOG_CATEGORIES.API, `Response from ${endpoint}`, data);
    }

    static logPrinter(message, data = null) {
        return this.debug(LOG_CATEGORIES.PRINTER, message, data);
    }

    static notification(message, data = null) {
        return this.info(LOG_CATEGORIES.NOTIFICATION, message, data);
    }

    static printer(message, data = null) {
        return this.debug(LOG_CATEGORIES.PRINTER, message, data);
    }

    // Basis Logger-Methoden
    static log(level, category, message, data = null) {
        const timestamp = new Date().toISOString();
        const logKey = this.formatLogKey(level, category, message, data);
        
        if (this.lastLogs.has(logKey)) {
            const lastLog = this.lastLogs.get(logKey);
            lastLog.count++;
            lastLog.lastTimestamp = timestamp;
            
            // Nur alle 10 Wiederholungen oder nach 30 Sekunden ausgeben
            if (lastLog.count % 10 === 0 || 
                (new Date(timestamp) - new Date(lastLog.firstTimestamp)) > 30000) {
                console.log(
                    `${lastLog.firstTimestamp} [${level}] [${category}] ${message} ` +
                    `(${lastLog.count}x in ${Math.round((new Date(timestamp) - new Date(lastLog.firstTimestamp))/1000)}s)`,
                    data || ''
                );
            }
        } else {
            // Neuer Log-Eintrag
            this.lastLogs.set(logKey, {
                firstTimestamp: timestamp,
                lastTimestamp: timestamp,
                count: 1
            });
            
            console.log(
                `${timestamp} [${level}] [${category}] ${message}`,
                data || ''
            );
        }

        return {
            timestamp,
            level,
            category,
            message,
            data
        };
    }

    static debug(category, message, data = null) {
        return this.log(LOG_LEVELS.DEBUG, category, message, data);
    }

    static info(category, message, data = null) {
        return this.log(LOG_LEVELS.INFO, category, message, data);
    }

    static warn(category, message, data = null) {
        return this.log(LOG_LEVELS.WARN, category, message, data);
    }

    static error(category, message, data = null) {
        return this.log(LOG_LEVELS.ERROR, category, message, data);
    }
}

export { Logger, LOG_LEVELS, LOG_CATEGORIES }; 