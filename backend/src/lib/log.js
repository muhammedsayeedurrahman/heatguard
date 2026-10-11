/**
 * Structured JSON logging (CloudWatch Logs Insights friendly).
 */

function emit(level, message, fields = {}) {
  const line = JSON.stringify({ level, message, ...fields, timestamp: new Date().toISOString() });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const log = {
  info: (message, fields) => emit('info', message, fields),
  warn: (message, fields) => emit('warn', message, fields),
  error: (message, fields) => emit('error', message, fields),
};
