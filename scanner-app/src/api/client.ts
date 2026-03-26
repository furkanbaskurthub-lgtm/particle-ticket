import axios from 'axios';

// Geliştirme ortamında backend IP'nizi buraya yazın
// Android emülatör için: http://10.0.2.2:5000
// Gerçek cihaz için: http://<bilgisayar-ip>:5000
const BASE_URL = 'http://192.168.1.16:5000/api';

const api = axios.create({ baseURL: BASE_URL, timeout: 8000 });

export interface ValidateResponse {
  valid: boolean;
  message: string;
  customerName?: string;
  customerEmail?: string;
  eventName?: string;
  purchaseDate?: string;
  usedAt?: string;
}

export async function validateTicket(encryptedPayload: string): Promise<ValidateResponse> {
  const { data } = await api.post<ValidateResponse>('/tickets/validate', { encryptedPayload });
  return data;
}

export async function validateToken(token: string): Promise<ValidateResponse> {
  const { data } = await api.post<ValidateResponse>('/tickets/validate-token', { token });
  return data;
}
