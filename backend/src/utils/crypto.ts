import CryptoJS from 'crypto-js';

const SECRET = process.env.AES_SECRET || 'particle_aes_256_key_must_be_32ch';

/**
 * ticketId'yi AES-256 ile şifreler.
 * Dönen hex string → Encoder'a verilir, parçacıklara gömülür.
 */
export function encryptTicketId(ticketId: string): string {
  const encrypted = CryptoJS.AES.encrypt(ticketId, SECRET);
  return encrypted.toString(); // Base64 string
}

/**
 * Tarayıcı uygulamasının çözdüğü şifreli string'i çözer.
 * Dönen değer orijinal ticketId olmalı.
 */
export function decryptTicketId(encryptedPayload: string): string {
  const bytes = CryptoJS.AES.decrypt(encryptedPayload, SECRET);
  return bytes.toString(CryptoJS.enc.Utf8);
}
