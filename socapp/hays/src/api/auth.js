import api from './axios';

export const login = (data, config) => api.post('/auth/login', data, config);
export const register = (data) => api.post('/auth/register', data);
export const getCurrentUser = () => api.get('/users/me');
