import axios from 'axios';
import { getApiUrl } from './config.js';

const api = axios.create({
  baseURL: getApiUrl()
});

export async function listMedia({ offset, limit, year, month }) {
  const params = { offset, limit };
  if (year) params.year = year;
  if (month) params.month = month;
  
  const response = await api.get('/media', { params });
  return response.data;
}

export async function getThumb(hash, outputPath) {
  const response = await api.get(`/media/thumb/${hash}`, {
    responseType: 'stream'
  });
  return response.data;
}

export async function listSources() {
  const response = await api.get('/admin/sources');
  return response.data;
}

export async function addSource(type, config) {
  const response = await api.post('/admin/sources', { type, config });
  return response.data;
}

export async function startIndexing(sourceId) {
  const response = await api.post('/admin/index', { sourceId });
  return response.data;
}

export async function getIndexingStatus(sourceId) {
  const response = await api.get('/admin/stats', { params: { sourceId } });
  return response.data;
}