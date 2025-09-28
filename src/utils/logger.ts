/**
 * Logger utility to replace console.log statements
 * Provides structured logging with different levels
 */

import { toast } from 'sonner';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
}

class Logger {
  private logs: LogEntry[] = [];
  private isDevelopment = process.env.NODE_ENV === 'development';

  private addLog(level: LogLevel, message: string, data?: any) {
    const logEntry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
    };

    this.logs.push(logEntry);

    // Keep only last 1000 logs to prevent memory issues
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }

    // In development, also log to console
    if (this.isDevelopment) {
      const logMethod = console[level] || console.log;
      if (data) {
        logMethod(`[${level.toUpperCase()}] ${message}`, data);
      } else {
        logMethod(`[${level.toUpperCase()}] ${message}`);
      }
    }
  }

  debug(message: string, data?: any) {
    this.addLog('debug', message, data);
  }

  info(message: string, data?: any) {
    this.addLog('info', message, data);
    // Show info messages as toast notifications
    toast.info(message);
  }

  warn(message: string, data?: any) {
    this.addLog('warn', message, data);
    // Show warnings as toast notifications
    toast.warning(message);
  }

  error(message: string, data?: any) {
    this.addLog('error', message, data);
    // Show errors as toast notifications
    toast.error(message);
  }

  success(message: string) {
    this.addLog('info', message);
    toast.success(message);
  }

  // Get logs for debugging purposes
  getLogs(level?: LogLevel): LogEntry[] {
    if (level) {
      return this.logs.filter(log => log.level === level);
    }
    return [...this.logs];
  }

  // Clear all logs
  clearLogs() {
    this.logs = [];
  }

  // Export logs as JSON for debugging
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // Group methods for console grouping (development only)
  group(label: string) {
    this.addLog('debug', `=== ${label} ===`);
    if (this.isDevelopment) {
      console.group(label);
    }
  }

  groupEnd() {
    if (this.isDevelopment) {
      console.groupEnd();
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export toast functions for direct use
export { toast };