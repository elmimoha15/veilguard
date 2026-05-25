type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel = (process.env.VEILGUARD_LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[currentLevel];
}

function formatMessage(level: LogLevel, message: string): string {
  const timestamp = new Date().toISOString();
  return `[veilguard] ${timestamp} ${level.toUpperCase()} ${message}`;
}

export const logger = {
  debug(message: string): void {
    if (shouldLog('debug')) {
      process.stderr.write(formatMessage('debug', message) + '\n');
    }
  },

  info(message: string): void {
    if (shouldLog('info')) {
      process.stderr.write(formatMessage('info', message) + '\n');
    }
  },

  warn(message: string): void {
    if (shouldLog('warn')) {
      process.stderr.write(formatMessage('warn', message) + '\n');
    }
  },

  error(message: string): void {
    if (shouldLog('error')) {
      process.stderr.write(formatMessage('error', message) + '\n');
    }
  },
};
