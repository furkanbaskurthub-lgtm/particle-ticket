/**
 * Particle Cloud Decoder
 *
 * Encoder ile birebir ters çalışır:
 *
 * Encoder mantığı (customer-app/ParticleCloud.tsx):
 *   - encryptedPayload (Base64) → bytes
 *   - byte[ring], bit[bitIdx] → parçacık
 *   - bit=1 → BIG_SIZE (3.5–4.7px), bit=0 → SMALL_SIZE (1.2–1.8px)
 *   - angle = (bitIdx/8)*2π + ring*0.18 + phase_noise
 *   - radius = BASE_R(45) + ring*RING_GAP(9) + noise(-2,+2)
 *
 * Decoder adımları:
 *   1. Kamera frame'inden parlak noktaları (blob) tespit et
 *   2. Blob kümesinin ağırlık merkezini bul (cx, cy)
 *   3. Her blob için (angle, radius) hesapla
 *   4. ring = round((radius - BASE_R) / RING_GAP)
 *   5. bitIdx = round((normalizedAngle / 2π) * 8)
 *   6. size > SIZE_THRESHOLD → bit=1, aksi → bit=0
 *   7. bits[ring][bitIdx] → byte → Base64 string → encryptedPayload
 *
 * NOT: Bu decoder JavaScript/TypeScript tarafında çalışır.
 * Frame Processor (VisionCamera) ham piksel verisini buraya iletir.
 */

export const BASE_R = 45;
export const RING_GAP = 9;
export const SIZE_THRESHOLD = 2.5; // BIG/SMALL ayrım eşiği (piksel)
export const MAX_RINGS = 64;       // max 64 byte = 512 bit

export interface DetectedBlob {
  x: number;       // frame içindeki piksel koordinatı
  y: number;
  size: number;    // blob yarıçapı (piksel)
  brightness: number; // 0-255
}

export interface DecodedResult {
  success: boolean;
  encryptedPayload?: string;
  error?: string;
  confidence: number; // 0-1 arası güven skoru
}

/**
 * Ham blob listesinden encryptedPayload'ı çözer.
 * Bu fonksiyon JS thread'inde çalışır (Frame Processor'dan gelen veriyle).
 */
export function decodeParticles(
  blobs: DetectedBlob[],
  frameWidth: number,
  frameHeight: number
): DecodedResult {
  if (blobs.length < 8) {
    return { success: false, error: 'Yeterli parçacık bulunamadı.', confidence: 0 };
  }

  // 1. Ağırlık merkezi (yoğunluk ağırlıklı)
  let totalWeight = 0;
  let cx = 0;
  let cy = 0;
  for (const b of blobs) {
    const w = b.brightness;
    cx += b.x * w;
    cy += b.y * w;
    totalWeight += w;
  }
  cx /= totalWeight;
  cy /= totalWeight;

  // 2. Her blob'u ring + bitIdx'e yerleştir
  // bits[ring][bitIdx] = 0 | 1 | undefined
  const bits: (0 | 1 | undefined)[][] = Array.from({ length: MAX_RINGS }, () =>
    new Array(8).fill(undefined)
  );

  let placed = 0;

  for (const blob of blobs) {
    const dx = blob.x - cx;
    const dy = blob.y - cy;
    const radius = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx); // -π to π

    // ring hesapla
    const ring = Math.round((radius - BASE_R) / RING_GAP);
    if (ring < 0 || ring >= MAX_RINGS) continue;

    // açıyı 0-2π'ye normalize et
    const normalizedAngle = angle < 0 ? angle + Math.PI * 2 : angle;

    // ring offset'ini çıkar (encoder'da ring*0.18 eklenmişti)
    const correctedAngle = ((normalizedAngle - ring * 0.18) + Math.PI * 2) % (Math.PI * 2);

    // bitIdx hesapla
    const bitIdx = Math.round((correctedAngle / (Math.PI * 2)) * 8) % 8;

    // Boyuta göre bit değeri
    const bit: 0 | 1 = blob.size >= SIZE_THRESHOLD ? 1 : 0;

    // Çakışma varsa daha parlak olanı tercih et
    if (
      bits[ring][bitIdx] === undefined ||
      blob.brightness > (blobs.find(
        (b2) => {
          const d2 = Math.sqrt((b2.x - cx) ** 2 + (b2.y - cy) ** 2);
          const r2 = Math.round((d2 - BASE_R) / RING_GAP);
          return r2 === ring;
        }
      )?.brightness ?? 0)
    ) {
      bits[ring][bitIdx] = bit;
      placed++;
    }
  }

  // 3. Kaç ring dolu? (en az 1 tam ring gerekli)
  const filledRings: number[] = [];
  for (let r = 0; r < MAX_RINGS; r++) {
    const ringBits = bits[r];
    if (ringBits.every((b) => b !== undefined)) {
      filledRings.push(r);
    }
  }

  if (filledRings.length === 0) {
    return { success: false, error: 'Tam ring okunamadı.', confidence: placed / blobs.length };
  }

  // 4. Bitleri byte'a çevir
  const byteArray: number[] = [];
  for (const r of filledRings) {
    let byte = 0;
    for (let b = 0; b < 8; b++) {
      byte = (byte << 1) | (bits[r][b] ?? 0);
    }
    byteArray.push(byte);
  }

  // 5. Byte array → Base64 string (encryptedPayload)
  try {
    const binaryStr = byteArray.map((b) => String.fromCharCode(b)).join('');
    const base64 = btoa(binaryStr);
    const confidence = filledRings.length / (placed / 8);

    return {
      success: true,
      encryptedPayload: base64,
      confidence: Math.min(confidence, 1),
    };
  } catch {
    return { success: false, error: 'Base64 dönüşüm hatası.', confidence: 0 };
  }
}

/**
 * Frame Processor'dan gelen YUV piksel verisinden blob'ları tespit eder.
 * Worklet olarak çalışır — UI thread'ini bloklamaz.
 *
 * YUV420 formatında Y kanalı (luminance) ilk width*height byte'tadır.
 * Her piksel 1 byte — RGBA'daki gibi 4 byte değil.
 *
 * @param pixels  - Uint8Array (YUV420, Y kanalı ilk width*height byte)
 * @param width   - frame genişliği
 * @param height  - frame yüksekliği
 * @param threshold - parlaklık eşiği (0-255, default 160)
 */
export function detectBlobsFromFrame(
  pixels: Uint8Array,
  width: number,
  height: number,
  threshold = 160
): DetectedBlob[] {
  const blobs: DetectedBlob[] = [];
  const visited = new Uint8Array(width * height);

  const isRGBA = pixels.length >= width * height * 4;

  const getPixelBrightness = (x: number, y: number): number => {
    if (!isRGBA) {
      return pixels[y * width + x];
    }

    const idx = (y * width + x) * 4;
    const r = pixels[idx];
    const g = pixels[idx + 1];
    const b = pixels[idx + 2];
    return (r * 0.2126 + g * 0.7152 + b * 0.0722) | 0;
  };

  // Basit connected-component labeling (4-bağlantılı BFS)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (visited[idx]) continue;

      const brightness = getPixelBrightness(x, y);
      if (brightness < threshold) continue;

      // BFS ile blob'u genişlet
      const queue: [number, number][] = [[x, y]];
      const component: [number, number][] = [];
      let totalBrightness = 0;

      while (queue.length > 0) {
        const [cx2, cy2] = queue.shift()!;
        const cidx = cy2 * width + cx2;
        if (visited[cidx]) continue;
        visited[cidx] = 1;

        const b = getPixelBrightness(cx2, cy2);
        if (b < threshold) continue;

        component.push([cx2, cy2]);
        totalBrightness += b;

        if (cx2 > 0) queue.push([cx2 - 1, cy2]);
        if (cx2 < width - 1) queue.push([cx2 + 1, cy2]);
        if (cy2 > 0) queue.push([cx2, cy2 - 1]);
        if (cy2 < height - 1) queue.push([cx2, cy2 + 1]);
      }

      if (component.length < 1) continue;

      const sumX = component.reduce((s, [px]) => s + px, 0);
      const sumY = component.reduce((s, [, py]) => s + py, 0);
      const blobCx = sumX / component.length;
      const blobCy = sumY / component.length;
      const size = Math.sqrt(component.length / Math.PI);

      blobs.push({
        x: blobCx,
        y: blobCy,
        size,
        brightness: totalBrightness / component.length,
      });
    }
  }

  if (blobs.length >= 8) return blobs;

  // Fallback: Local maxima based bright-spot detector.
  // This helps when blur/glow prevents clean connected components or when thresholding is too strict.
  const maxPoolStep = width * height > 700 * 700 ? 2 : 1;
  let maxB = 0;
  for (let y = 1; y < height - 1; y += maxPoolStep) {
    for (let x = 1; x < width - 1; x += maxPoolStep) {
      const b = getPixelBrightness(x, y);
      if (b > maxB) maxB = b;
    }
  }

  const effectiveThreshold = Math.max(20, Math.min(threshold, Math.round(maxB * 0.55)));
  type Cand = { x: number; y: number; b: number };
  const cands: Cand[] = [];

  for (let y = 2; y < height - 2; y += maxPoolStep) {
    for (let x = 2; x < width - 2; x += maxPoolStep) {
      const b = getPixelBrightness(x, y);
      if (b < effectiveThreshold) continue;

      // 3x3 local maximum check
      let isMax = true;
      for (let dy = -1; dy <= 1 && isMax; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (getPixelBrightness(x + dx, y + dy) > b) {
            isMax = false;
            break;
          }
        }
      }
      if (!isMax) continue;

      cands.push({ x, y, b });
    }
  }

  // Keep top candidates
  cands.sort((a, b) => b.b - a.b);
  const limited = cands.slice(0, 600);

  // Cluster by proximity
  const clustered: DetectedBlob[] = [];
  const used = new Uint8Array(limited.length);
  const dist2 = (ax: number, ay: number, bx: number, by: number) => {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  };

  const radiusPx = Math.max(2, Math.round(3 / maxPoolStep));
  const radius2 = radiusPx * radiusPx;

  for (let i = 0; i < limited.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    let sumX = 0;
    let sumY = 0;
    let sumB = 0;
    let cnt = 0;

    for (let j = i; j < limited.length; j++) {
      if (used[j]) continue;
      if (dist2(limited[i].x, limited[i].y, limited[j].x, limited[j].y) <= radius2) {
        used[j] = 1;
        sumX += limited[j].x * limited[j].b;
        sumY += limited[j].y * limited[j].b;
        sumB += limited[j].b;
        cnt++;
      }
    }

    // Also include the seed point itself
    sumX += limited[i].x * limited[i].b;
    sumY += limited[i].y * limited[i].b;
    sumB += limited[i].b;
    cnt++;

    clustered.push({
      x: sumX / sumB,
      y: sumY / sumB,
      size: Math.sqrt(cnt / Math.PI),
      brightness: sumB / cnt,
    });
  }

  // Return whichever is better (more blobs)
  return clustered.length > blobs.length ? clustered : blobs;
}
