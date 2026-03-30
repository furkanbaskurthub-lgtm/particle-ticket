import React, { useEffect, useRef, useState, useCallback } from 'react';
import QRCode from 'qrcode';
import { getRollingToken } from '../api/client';

interface DotParticle {
  baseX: number;
  baseY: number;
  orbitR: number;      // orbit radius px
  orbitSpd: number;   // orbit speed rad/s
  phase1: number;     // primary orbit phase
  phase2: number;     // secondary Lissajous phase
  spd2: number;       // secondary speed multiplier
  bPhase: number;     // breathe phase
  bSpd: number;       // breathe speed
  isFinder: boolean;
  sphereFade: number; // 1=center bright, 0=edge dim
}

interface AmbientParticle {
  angle: number;      // current angle around center
  radius: number;     // orbital radius from center
  angSpd: number;     // angular speed rad/s
  r: number;          // dot size
  opacity: number;
  hue: number;
  phase: number;
}

interface EnergyRing {
  progress: number;  // 0→1 expanding ring
  speed: number;
  opacity: number;
}

interface Props {
  ticketId: string;
  size?: number;
  isUsed?: boolean;
}

function rnd() { return Math.random(); }
function rndBetween(a: number, b: number) { return a + rnd() * (b - a); }

function getQRMatrix(text: string): { modules: boolean[][]; size: number } | null {
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const sz = qr.modules.size;
    const data = qr.modules.data;
    const modules: boolean[][] = [];
    for (let y = 0; y < sz; y++) {
      const row: boolean[] = [];
      for (let x = 0; x < sz; x++) row.push(data[y * sz + x] === 1);
      modules.push(row);
    }
    return { modules, size: sz };
  } catch { return null; }
}

function isFinderPattern(x: number, y: number, size: number): boolean {
  return (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
}

function buildDots(
  matrix: { modules: boolean[][]; size: number },
  padding: number,
  cellSize: number,
  cx: number,
  cy: number,
  halfGrid: number,
): DotParticle[] {
  const dots: DotParticle[] = [];
  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (!matrix.modules[row][col]) continue;
      const bx = padding + col * cellSize + cellSize / 2;
      const by = padding + row * cellSize + cellSize / 2;
      const dx = bx - cx;
      const dy = by - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const sphereFade = 1 - Math.min(1, dist / halfGrid) * 0.35;
      dots.push({
        baseX: bx, baseY: by,
        orbitR: rndBetween(1.2, 3.8),
        orbitSpd: rndBetween(0.4, 1.1) * (rnd() > 0.5 ? 1 : -1),
        phase1: rnd() * Math.PI * 2,
        phase2: rnd() * Math.PI * 2,
        spd2: rndBetween(0.6, 1.4),
        bPhase: rnd() * Math.PI * 2,
        bSpd: rndBetween(0.7, 1.6),
        isFinder: isFinderPattern(col, row, matrix.size),
        sphereFade,
      });
    }
  }
  return dots;
}

export default function ParticleQR({ ticketId, size = 280, isUsed }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const animRef      = useRef<number>(0);
  const matrixRef    = useRef<{ modules: boolean[][]; size: number } | null>(null);
  const dotsRef      = useRef<DotParticle[]>([]);
  const transRef     = useRef(1);
  const ambientRef   = useRef<AmbientParticle[]>([]);
  const ringsRef     = useRef<EnergyRing[]>([]);
  const startRef     = useRef(Date.now());
  const nextRingRef  = useRef(0);
  const [error, setError] = useState(false);

  // Build ambient particles once
  useEffect(() => {
    const cx = size / 2, cy = size / 2;
    const p: AmbientParticle[] = [];
    for (let i = 0; i < 65; i++) {
      const radiusOrb = rndBetween(size * 0.05, size * 0.52);
      p.push({
        angle:  rnd() * Math.PI * 2,
        radius: radiusOrb,
        angSpd: rndBetween(0.05, 0.25) * (rnd() > 0.5 ? 1 : -1),
        r:      rndBetween(0.4, 2.2),
        opacity: rndBetween(0.08, 0.45),
        hue:    rndBetween(195, 250),
        phase:  rnd() * Math.PI * 2,
      });
    }
    ambientRef.current = p;
  }, [size]);

  // Fetch rolling token
  const fetchToken = useCallback(async () => {
    if (isUsed) return;
    try {
      const { data } = await getRollingToken(ticketId);
      const newMatrix = getQRMatrix(data.token);
      if (!newMatrix) return;
      matrixRef.current = newMatrix;
      transRef.current  = 0;
      const padding  = size * 0.1;
      const available = size - padding * 2;
      const cellSize  = available / newMatrix.size;
      const cx = size / 2, cy = size / 2;
      const halfGrid = (available / 2) * 1.1;
      dotsRef.current = buildDots(newMatrix, padding, cellSize, cx, cy, halfGrid);
      setError(false);
    } catch { setError(true); }
  }, [ticketId, isUsed, size]);

  useEffect(() => {
    if (isUsed) return;
    fetchToken();
    const iv = setInterval(fetchToken, 8000);
    return () => clearInterval(iv);
  }, [fetchToken, isUsed]);

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width  = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    startRef.current = Date.now();

    const cx = size / 2, cy = size / 2;

    const draw = () => {
      const elapsed = (Date.now() - startRef.current) / 1000;

      ctx.clearRect(0, 0, size, size);

      // ── 1. Deep space background ────────────────────────────────────────
      ctx.fillStyle = '#03050f';
      ctx.fillRect(0, 0, size, size);

      // ── 2. Central nebula glow (multi-layer) ────────────────────────────
      const nebulaSize = size * (0.45 + 0.05 * Math.sin(elapsed * 0.4));
      const neb1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, nebulaSize);
      neb1.addColorStop(0,   'rgba(30, 80, 200, 0.18)');
      neb1.addColorStop(0.4, 'rgba(20, 60, 160, 0.10)');
      neb1.addColorStop(0.7, 'rgba(10, 30, 100, 0.05)');
      neb1.addColorStop(1,   'rgba(0,  0,  60,  0)');
      ctx.fillStyle = neb1;
      ctx.fillRect(0, 0, size, size);

      // Outer soft glow halo
      const halo = ctx.createRadialGradient(cx, cy, size * 0.2, cx, cy, size * 0.65);
      halo.addColorStop(0,   'rgba(40, 120, 255, 0.07)');
      halo.addColorStop(0.5, 'rgba(80, 160, 255, 0.04)');
      halo.addColorStop(1,   'rgba(0, 0, 0, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, size, size);

      // ── 3. Energy rings ─────────────────────────────────────────────────
      if (elapsed > nextRingRef.current && !isUsed) {
        ringsRef.current.push({ progress: 0, speed: rndBetween(0.25, 0.45), opacity: rndBetween(0.15, 0.3) });
        nextRingRef.current = elapsed + rndBetween(2.5, 5.0);
      }
      ringsRef.current = ringsRef.current.filter(ring => ring.progress < 1);
      for (const ring of ringsRef.current) {
        ring.progress = Math.min(1, ring.progress + ring.speed * 0.016);
        const ringR   = ring.progress * size * 0.52;
        const ringA   = ring.opacity * (1 - ring.progress);
        ctx.strokeStyle = `rgba(60, 150, 255, ${ringA})`;
        ctx.lineWidth   = 1.5 * (1 - ring.progress);
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        ctx.stroke();
      }

      // ── 4. Transition progress ──────────────────────────────────────────
      if (transRef.current < 1) transRef.current = Math.min(1, transRef.current + 0.025);
      const t = transRef.current;

      // ── 5. QR dots (orbital motion) ─────────────────────────────────────
      const dots = dotsRef.current;
      if (dots.length > 0 && !isUsed) {
        const sweepPos = ((elapsed * 0.35) % 1.8) - 0.4;

        const padding   = size * 0.1;
        const available = size - padding * 2;
        const cellSize  = available / (matrixRef.current?.size ?? 25);
        const dotBase   = cellSize * 0.36;

        for (const dot of dots) {
          // Orbital position — Lissajous-like path
          const angle1 = elapsed * dot.orbitSpd + dot.phase1;
          const angle2 = elapsed * dot.orbitSpd * dot.spd2 + dot.phase2;
          const ox = Math.cos(angle1) * dot.orbitR + Math.sin(angle2) * (dot.orbitR * 0.5);
          const oy = Math.sin(angle1) * dot.orbitR + Math.cos(angle2) * (dot.orbitR * 0.5);

          const drawX = dot.baseX + ox;
          const drawY = dot.baseY + oy;

          // Breathe scale
          const breathe = 0.82 + 0.18 * Math.sin(elapsed * dot.bSpd + dot.bPhase);
          const finderBoost = dot.isFinder ? 1.2 : 1.0;

          // Transition fade-in
          const dotT = Math.min(1, t + (1 - t) * rnd() * 0.5);

          // Sweep glow
          const normAlong = ((drawX - padding) / available) * Math.cos(Math.PI / 5)
                          + ((drawY - padding) / available) * Math.sin(Math.PI / 5);
          const sweepGlow = Math.max(0, 1 - Math.abs(normAlong - sweepPos) * 6);

          const r = dotBase * breathe * finderBoost * dotT;
          if (r < 0.3) continue;

          const alpha = dot.sphereFade * dotT * (dot.isFinder ? 0.97 : 0.88) + sweepGlow * 0.15;

          // Outer glow halo
          const glowR = r * (3.5 + sweepGlow * 2.0);
          const glow  = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, glowR);
          glow.addColorStop(0,   `rgba(100, 175, 255, ${alpha * 0.25})`);
          glow.addColorStop(0.4, `rgba(60,  140, 255, ${alpha * 0.10})`);
          glow.addColorStop(1,   'rgba(30, 80, 200, 0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(drawX, drawY, glowR, 0, Math.PI * 2);
          ctx.fill();

          // Core dot — white-hot center → blue edge
          const coreW = Math.min(255, 215 + sweepGlow * 40);
          const core  = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, r);
          core.addColorStop(0,   `rgba(${coreW}, ${coreW}, 255, ${alpha})`);
          core.addColorStop(0.55,`rgba(130, 190, 255, ${alpha * 0.85})`);
          core.addColorStop(1,   `rgba(60, 130, 240, ${alpha * 0.4})`);
          ctx.fillStyle = core;
          ctx.beginPath();
          ctx.arc(drawX, drawY, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ── 6. Ambient orbital particles ────────────────────────────────────
      for (const p of ambientRef.current) {
        p.angle += p.angSpd * 0.016;
        const px = cx + Math.cos(p.angle) * p.radius;
        const py = cy + Math.sin(p.angle) * p.radius;
        const flicker = p.opacity * (0.55 + 0.45 * Math.sin(elapsed * 1.8 + p.phase));
        ctx.fillStyle = `hsla(${p.hue}, 75%, 72%, ${flicker})`;
        ctx.beginPath();
        ctx.arc(px, py, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── 7. "Used" overlay ───────────────────────────────────────────────
      if (isUsed) {
        ctx.fillStyle = 'rgba(3, 5, 15, 0.78)';
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = '#ef4444';
        ctx.font = `bold ${size * 0.13}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✗', cx, cy - size * 0.06);
        ctx.font = `600 ${size * 0.055}px Inter, sans-serif`;
        ctx.fillText('Kullanıldı', cx, cy + size * 0.08);
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [size, isUsed]);

  if (error && dotsRef.current.length === 0) {
    return (
      <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#f59e0b', fontSize: 12 }}>Token alınamadı</span>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, borderRadius: 20 }}
    />
  );
}
