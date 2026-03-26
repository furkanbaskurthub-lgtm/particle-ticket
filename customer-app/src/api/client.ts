import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// Her istekte localStorage'dan token ekle
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;

// ── Auth ──────────────────────────────────────────────────────────────────────
export const register = (name: string, email: string, password: string) =>
  api.post('/auth/register', { name, email, password });

export const login = (email: string, password: string) =>
  api.post('/auth/login', { email, password });

// ── Tickets ───────────────────────────────────────────────────────────────────
export const purchaseTicket = (eventName?: string) =>
  api.post('/tickets/purchase', { eventName });

export const getMyTickets = () =>
  api.get('/tickets/my');

export const getRollingToken = (ticketId: string) =>
  api.get<{ token: string; expiresIn: number }>(`/tickets/rolling-token/${ticketId}`);
