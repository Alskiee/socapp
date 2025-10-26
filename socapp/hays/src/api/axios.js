import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const api = axios.create({
  // Prefer env base URL; fall back to typical local default
  baseURL: API_BASE_URL,
  withCredentials: true, // important for cookies & auth
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

// Friendly network error interceptor (non-intrusive)
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (!error.response) {
      // Network error (backend down or wrong URL)
      console.warn("Cannot connect to server at", API_BASE_URL);
    }
    return Promise.reject(error);
  }
);
