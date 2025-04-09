import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const logFile = path.join(__dirname, '../../stderr.log');

export function logError(error, context = '') {
  const timestamp = new Date().toISOString();
  let errorMessage = `\n[${timestamp}] ${context}\n`;
  
  // Basic error info
  errorMessage += `Message: ${error.message}\n`;
  errorMessage += `Stack: ${error.stack}\n`;

  // If it's an Axios error, include response data
  if (error.isAxiosError) {
    errorMessage += 'Axios Error Details:\n';
    if (error.response) {
      errorMessage += `Status: ${error.response.status}\n`;
      errorMessage += `Status Text: ${error.response.statusText}\n`;
      errorMessage += `Response Data: ${JSON.stringify(error.response.data, null, 2)}\n`;
    } else if (error.request) {
      errorMessage += 'No response received\n';
      errorMessage += `Request: ${JSON.stringify(error.request, null, 2)}\n`;
    }
    errorMessage += `Config: ${JSON.stringify(error.config, null, 2)}\n`;
  }

  errorMessage += '----------------------------------------\n';

  // Append to log file
  fs.appendFileSync(logFile, errorMessage);
}

export function clearErrorLog() {
  fs.writeFileSync(logFile, '');
}