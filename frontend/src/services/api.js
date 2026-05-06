import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getFullData = async () => {
  const response = await api.get('/data');
  return response.data;
};

export const getStats = async () => {
  const response = await api.get('/stats');
  return response.data;
};

export const getDistributions = async (day) => {
  const response = await api.get(`/distributions/${day}`);
  return response.data;
};

export const getCorrelation = async () => {
  const response = await api.get('/correlation');
  return response.data;
};

export const getBoxplot = async () => {
  const response = await api.get('/boxplot');
  return response.data;
};

export const getClusters = async (k = null) => {
  const url = k ? `/clusters?k=${k}` : '/clusters';
  const response = await api.get(url);
  return response.data;
};

export const getReductorAnalysis = async (threshold = 0.90, coverage = 0.80, manualDay = null) => {
  let url = `/reductor?threshold=${threshold}&coverage=${coverage}`;
  if (manualDay) {
    url += `&manual_day=${manualDay}`;
  }
  const response = await api.get(url);
  return response.data;
};

export const uploadDataFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};
