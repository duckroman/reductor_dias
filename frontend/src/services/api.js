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

export const getClusters = async () => {
  const response = await api.get('/clusters');
  return response.data;
};

export const getReductorAnalysis = async (threshold = 0.90, coverage = 0.80) => {
  const response = await api.get('/reductor', { params: { threshold, coverage } });
  return response.data;
};
