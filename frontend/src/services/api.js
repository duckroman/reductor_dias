import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper para agregar sheet y state a los params
const sheetParams = (sheet, state) => {
  const params = {};
  if (sheet) params.sheet = sheet;
  if (state) params.state = state;
  return params;
};

// ============================================================
// Dataset Selection
// ============================================================

export const getDatasets = async (stage = null) => {
  const params = stage ? { stage } : {};
  const response = await api.get('/datasets', { params });
  return response.data;
};

export const selectDataset = async (filename, stage) => {
  const response = await api.post('/select-dataset', null, {
    params: { filename, stage },
  });
  return response.data;
};

export const clearCache = async () => {
  const response = await api.get('/clear-cache');
  return response.data;
};

// ============================================================
// Existing endpoints
// ============================================================

export const getActiveFile = async () => {
  const response = await api.get('/active-file');
  return response.data;
};

export const getSheets = async (stage = null) => {
  const params = stage ? { stage } : {};
  const response = await api.get('/sheets', { params });
  return response.data;
};

export const getFullData = async (sheet = null, state = null) => {
  const response = await api.get('/data', { params: sheetParams(sheet, state) });
  return response.data;
};

export const getStats = async (sheet = null, state = null) => {
  const response = await api.get('/stats', { params: sheetParams(sheet, state) });
  return response.data;
};

export const getDistributions = async (day, sheet = null, state = null) => {
  const response = await api.get(`/distributions/${day}`, { params: sheetParams(sheet, state) });
  return response.data;
};

export const getCorrelation = async (sheet = null, state = null) => {
  const response = await api.get('/correlation', { params: sheetParams(sheet, state) });
  return response.data;
};

export const getBoxplot = async (sheet = null, state = null) => {
  const response = await api.get('/boxplot', { params: sheetParams(sheet, state) });
  return response.data;
};

export const getLaggingDistricts = async (sheet = null, state = null) => {
  const response = await api.get('/lagging', { params: sheetParams(sheet, state) });
  return response.data;
};

export const getComparative = async (state = null) => {
  const params = state ? { state } : {};
  const response = await api.get('/comparative', { params });
  return response.data;
};

export const getClusters = async (k = null, sheet = null, state = null) => {
  const params = sheetParams(sheet, state);
  if (k) params.k = k;
  const response = await api.get('/clusters', { params });
  return response.data;
};

export const getReductorAnalysis = async (threshold = 0.90, coverage = 0.80, manualDay = null, sheet = null, state = null) => {
  const params = { threshold, coverage, ...sheetParams(sheet, state) };
  if (manualDay) params.manual_day = manualDay;
  const response = await api.get('/reductor', { params });
  return response.data;
};

export const getStateSummary = async (sheet = null) => {
  const params = {};
  if (sheet) params.sheet = sheet;
  const response = await api.get('/state-summary', { params });
  return response.data;
};

export const getRawData = async (sheet = null, state = null) => {
  const response = await api.get('/raw-data', { params: sheetParams(sheet, state) });
  return response.data;
};

export const uploadDataFile = async (file, stage = null) => {
  const formData = new FormData();
  formData.append('file', file);
  const params = stage ? { stage } : {};
  const response = await api.post('/upload', formData, {
    params,
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

// ============================================================
// Promedios por Entidad y Clustering
// ============================================================

export const getEntidadesData = async () => {
  const response = await api.get('/entidades/data');
  return response.data;
};

export const uploadEntidadesFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/entidades/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const getEntidadesClustering = async (stage, k) => {
  const response = await api.get('/entidades/clustering', { params: { stage, k } });
  return response.data;
};

export const getEstadoDistritos = async (state, sheet = null, day = null) => {
  const params = { state };
  if (sheet) params.sheet = sheet;
  if (day) params.day = day;
  const response = await api.get('/entidades/estado-distritos', { params });
  return response.data;
};

