// logger.js - универсальный логгер для разработки и продакшена
const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.logDir = path.join(__dirname, 'logs');
    
    // Создаем папку для логов если её нет
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    this.logFile = path.join(this.logDir, 'app.log');
  }
  
  log(message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ℹ️ ${message}`;
    
    // В продакшене пишем в файл и console.log
    if (this.isProduction) {
      // Записываем в файл
      fs.appendFileSync(this.logFile, logMessage + '\n');
      
      // Также пишем в stdout для Railway
      console.log(logMessage);
      
      if (data) {
        const dataStr = JSON.stringify(data, null, 2);
        fs.appendFileSync(this.logFile, dataStr + '\n');
        console.log(dataStr);
      }
    } else {
      // В разработке только console.log
      console.log(logMessage);
      if (data) console.log(data);
    }
  }
  
  error(message, error = null) {
    const timestamp = new Date().toISOString();
    const errorMessage = `[${timestamp}] ❌ ${message}`;
    
    if (this.isProduction) {
      fs.appendFileSync(this.logFile, errorMessage + '\n');
      console.error(errorMessage);
      
      if (error) {
        const errorStr = JSON.stringify({
          message: error.message,
          stack: error.stack,
          ...error
        }, null, 2);
        fs.appendFileSync(this.logFile, errorStr + '\n');
        console.error(errorStr);
      }
    } else {
      console.error(errorMessage);
      if (error) console.error(error);
    }
  }
  
  warn(message, data = null) {
    const timestamp = new Date().toISOString();
    const warnMessage = `[${timestamp}] ⚠️ ${message}`;
    
    if (this.isProduction) {
      fs.appendFileSync(this.logFile, warnMessage + '\n');
      console.warn(warnMessage);
      
      if (data) {
        const dataStr = JSON.stringify(data, null, 2);
        fs.appendFileSync(this.logFile, dataStr + '\n');
        console.warn(dataStr);
      }
    } else {
      console.warn(warnMessage);
      if (data) console.warn(data);
    }
  }
  
  success(message, data = null) {
    const timestamp = new Date().toISOString();
    const successMessage = `[${timestamp}] ✅ ${message}`;
    
    if (this.isProduction) {
      fs.appendFileSync(this.logFile, successMessage + '\n');
      console.log(successMessage);
      
      if (data) {
        const dataStr = JSON.stringify(data, null, 2);
        fs.appendFileSync(this.logFile, dataStr + '\n');
        console.log(dataStr);
      }
    } else {
      console.log(successMessage);
      if (data) console.log(data);
    }
  }
}

module.exports = new Logger();