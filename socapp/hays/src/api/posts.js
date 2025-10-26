import api from './axios';

export const getFeed = () => api.get('/users/me/feed');
export const createPost = (data) => api.post('/posts/', data);
export const likePost = (id) => api.post(`/posts/${id}/like`);
export const getPost = (id) => api.get(`/posts/${id}`);
export const updatePost = (id, data) => api.put(`/posts/${id}`, data);
export const deletePost = (id) => api.delete(`/posts/${id}`);
