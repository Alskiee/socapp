import api from "./axios";

// ✅ These match your FastAPI backend exactly
export const getComments = (postId) => api.get(`/posts/${postId}/comments`);
export const addComment = (postId, data) => api.post(`/posts/${postId}/comments`, data);
export const updateComment = (commentId, data) => api.put(`/posts/comments/${commentId}`, data);
export const deleteComment = (commentId) => api.delete(`/posts/comments/${commentId}`);
