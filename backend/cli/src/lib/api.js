import axios from 'axios';
import { getApiUrl } from './config.js';

const apiClient = axios.create({
  baseURL: getApiUrl(),
  headers: {
    'Content-Type': 'application/json'
  }
});

// --- Media ---
export async function listMedia({ offset, limit, year, month }) {
  const params = { offset, limit };
  if (year) params.year = year;
  if (month) params.month = month;

  const response = await apiClient.get('/media', { params });
  return response.data;
}

export async function getThumb(hash) {
  const response = await apiClient.get(`/media/thumb/${hash}`, {
    responseType: 'arraybuffer'
  });
  return response.data;
}

// --- Sources ---
export async function listSources() {
  const response = await apiClient.get('/admin/sources');
  return response.data;
}

export async function addSource(type, config) {
  const response = await apiClient.post('/admin/sources', { type, config });
  return response.data;
}

// --- Indexing ---
export async function startIndexing(sourceId) {
  const response = await apiClient.post('/admin/index', { sourceId });
  return response.data;
}

export async function getIndexingStatus(sourceId) {
  const response = await apiClient.get('/admin/index/status', { params: { sourceId } });
  return response.data;
}

export async function getIndexingHistory(sourceId) {
  const response = await apiClient.get('/admin/index/history', { params: { sourceId } });
  return response.data;
}

// --- Thumbnails ---
export async function getThumbnailStatus() {
  const response = await apiClient.get('/admin/thumbnails/status');
  return response.data;
}

export async function getThumbnailHistory(params = {}) {
  const response = await apiClient.get('/admin/thumbnails/history', { params });
  return response.data;
}

export async function triggerThumbnailGeneration(sourceId = null) {
  const response = await apiClient.post('/admin/thumbnails/generate', { sourceId });
  return response.data;
}

// --- Deduplication ---
export async function startDeduplication() {
  const response = await apiClient.post('/admin/deduplication/start');
  return response.data; // Should contain { message: '...' }
}

export async function getDeduplicationStatus() {
  const response = await apiClient.get('/admin/deduplication/status');
  return response.data; // Should contain the status object
}