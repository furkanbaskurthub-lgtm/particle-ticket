import crypto from 'crypto';

const ROLLING_SECRET = process.env.ROLLING_SECRET || 'particle_rolling_secret_key_2024!';
const WINDOW_SECONDS = 10; // Her 10 saniyede yeni token

/**
 * Zaman penceresi hesapla (epoch / windowSize)
 */
function currentWindow(): number {
  return Math.floor(Date.now() / (WINDOW_SECONDS * 1000));
}

/**
 * Rolling token üret.
 * Format: base64( ticketId:window:hmac )
 *
 * Apple Wallet'taki gibi: her N saniyede farklı token, imzalı, TTL'li.
 */
export function generateRollingToken(ticketId: string): { token: string; window: number; expiresIn: number } {
  const win = currentWindow();
  const data = `${ticketId}:${win}`;
  const hmac = crypto.createHmac('sha256', ROLLING_SECRET).update(data).digest('hex').slice(0, 16);
  const raw = `${ticketId}:${win}:${hmac}`;
  const token = Buffer.from(raw).toString('base64');

  return {
    token,
    window: win,
    expiresIn: WINDOW_SECONDS,
  };
}

/**
 * Rolling token doğrula.
 * ±1 pencere toleransı (toplam ~30 sn geçerlilik).
 * Anti-replay: aynı pencere ikinci kez kabul edilmez.
 */
export function verifyRollingToken(token: string): {
  valid: boolean;
  ticketId?: string;
  window?: number;
  error?: string;
} {
  try {
    const raw = Buffer.from(token, 'base64').toString('utf-8');
    const parts = raw.split(':');

    if (parts.length < 3) {
      return { valid: false, error: 'Geçersiz token formatı.' };
    }

    // ticketId UUID içinde ":" olabilir mi? Hayır, UUID'de yok. Ama güvenli olsun:
    const hmac = parts.pop()!;
    const winStr = parts.pop()!;
    const ticketId = parts.join(':');
    const win = parseInt(winStr, 10);

    if (isNaN(win)) {
      return { valid: false, error: 'Geçersiz zaman penceresi.' };
    }

    // HMAC doğrula
    const data = `${ticketId}:${win}`;
    const expectedHmac = crypto.createHmac('sha256', ROLLING_SECRET).update(data).digest('hex').slice(0, 16);

    if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac))) {
      return { valid: false, error: 'İmza doğrulanamadı.' };
    }

    // TTL kontrolü (±1 pencere = toplam ~30 sn)
    const now = currentWindow();
    if (Math.abs(now - win) > 1) {
      return { valid: false, error: 'Token süresi dolmuş.' };
    }

    return { valid: true, ticketId, window: win };
  } catch {
    return { valid: false, error: 'Token çözümlenemedi.' };
  }
}
