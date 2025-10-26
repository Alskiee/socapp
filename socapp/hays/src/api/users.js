import api from './axios';

export const getUser = (id, me) => api.get(`/users/${id}`, { params: me ? { me } : {} });
export const getMe = () => api.get('/users/me');
export const updateMe = (data) => api.put('/users/me', data);
export const followUser = (id) => api.post(`/users/${id}/follow`);
export const unfollowUser = (id) => api.post(`/users/${id}/unfollow`);
export const searchUsers = (query) => api.get(`/users/search/${encodeURIComponent(query)}`);
