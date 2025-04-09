import axios from 'axios';
import { getApiUrl } from './config.js';

const api = axios.create({
  baseURL: getApiUrl(),
  headers: {
    'Content-Type': 'application/json'
  }
});

export async function listMedia({ offset, limit, year, month }) {
  const params = { offset, limit };
  if (year) params.year = year;
  if (month) params.month = month;
  
  const response = await api.get('/media', { params });
  return response.data;
}

export async function getThumb(hash) {
  const response = await api.get(`/media/thumb/${hash}`, {
    responseType: 'arraybuffer'
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

export async function getIndexingHistory(sourceId) {
  const response = await api.get('/admin/index/history', { params: { sourceId } });
  return response.data;
}

export async function getThumbnailStatus() {
  const response = await api.get('/admin/thumbnails/status');
  return response.data;
}

export async function getThumbnailHistory(params = {}) {
  const response = await api.get('/admin/thumbnails/history', { params });
  return response.data;
}

export async function triggerThumbnailGeneration(sourceId = null) {
  const response = await api.post('/admin/thumbnails/generate', { sourceId });
  return response.data;
}