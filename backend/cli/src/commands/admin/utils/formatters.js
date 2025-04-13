import chalk from 'chalk';

export function formatBytes(bytes) {
  if (bytes === null || bytes === undefined || isNaN(bytes)) return 'N/A';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${Math.round(size * 100) / 100} ${units[unitIndex]}`;
}

export function formatStatus(status) {
  return status === 'completed' || status === 'success' 
    ? chalk.green(status) 
    : chalk.red(status);
}

export function formatDate(date) {
  return new Date(date).toLocaleString();
}

export function formatSourceConfig(config) {
  return Object.entries(config).map(([key, value]) => {
    const displayValue = key === 'pass' ? '********' : value;
    return `    ${key}: ${displayValue}`;
  }).join('\n');
}