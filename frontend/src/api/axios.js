import axios from "axios";
import { clearStoredAuth } from "../utils/storage";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token && !config.skipAuth) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const hasStoredAuth = Boolean(
      localStorage.getItem("token") || localStorage.getItem("refreshToken")
    );

    if (
      error.response?.status !== 401 ||
      originalRequest?.url === "/auth/refresh"
    ) {
      return Promise.reject(error);
    }

    if (!hasStoredAuth || originalRequest?.url === "/auth/login") {
      return Promise.reject(error);
    }

    if (originalRequest?._retry) {
      clearStoredAuth();
      return Promise.reject(error);
    }

    const refreshToken = localStorage.getItem("refreshToken");

    if (!refreshToken) {
      clearStoredAuth();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
        refreshToken,
      });

      localStorage.setItem("token", res.data.token);

      if (res.data.refreshToken) {
        localStorage.setItem("refreshToken", res.data.refreshToken);
      }

      if (res.data.user) {
        localStorage.setItem("user", JSON.stringify(res.data.user));
      }

      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${res.data.token}`;
      return api(originalRequest);
    } catch (refreshError) {
      clearStoredAuth();
      return Promise.reject(refreshError);
    }
  }
);

export default api;
