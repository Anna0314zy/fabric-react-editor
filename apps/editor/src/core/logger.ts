type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const STORAGE_KEY = 'fabric-editor:debug-log';

function isLogEnabled(): boolean {
  if (!import.meta.env.DEV) return false;
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(STORAGE_KEY) !== 'false';
}

function write(level: LogLevel, scope: string, args: unknown[]): void {
  if (!isLogEnabled()) return;
  const prefix = `[${scope}]`;
  console[level](prefix, ...args);
}

export const logger = {
  debug(scope: string, ...args: unknown[]): void {
    write('debug', scope, args);
  },
  info(scope: string, ...args: unknown[]): void {
    write('info', scope, args);
  },
  warn(scope: string, ...args: unknown[]): void {
    write('warn', scope, args);
  },
  error(scope: string, ...args: unknown[]): void {
    write('error', scope, args);
  },
};

export function setDebugLogEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(enabled));
}
