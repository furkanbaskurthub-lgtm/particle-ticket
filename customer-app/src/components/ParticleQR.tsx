import React, { useEffect, useRef, useState, useCallback } from 'react';
import QRCode from 'qrcode';
import { getRollingToken } from '../api/client';

interface Props {
  ticketId: string;
  size?: number;
  isUsed?: boolean;
}

interface AmbientParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  hue: number;
  phase: number;
}

function getQRMatrix(text: string): { modules: boolean[][]; size: number } | null {
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const size = qr.modules.size;
    const data = qr.modules.data;
    const modules: boolean[][] = [];
    for (let y = 0; y < size; y++) {
      const row: boolean[] = [];
      for (let x = 0; x < size; x++) {
        row.push(data[y * size + x] === 1);
      }
      modules.push(row);
    }
    return { modules, size };
  } catch {
    return null;
  }
}

function isFinderPattern(x: number, y: number, size: number): boolean {
  // Finder patterns are 7x7 in top-left, top-right, bottom-left corners
  const inTopLeft = x < 7 && y < 7;
  const inTopRight = x >= size - 7 && y < 7;
  const inBottomLeft = x < 7 && y >= size - 7;
  return inTopLeft || inTopRight || inBottomLeft;
}

export default function ParticleQR({ ticketId, size = 280, isUsed }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const tokenRef = useRef<string>('');
  const matrixRef = useRef<{ modules: boolean[][]; size: number } | null>(null);
  const prevMatrixRef = useRef<{ modules: boolean[][]; size: number } | null>(null);
  const transitionRef = useRef(1); // 0→1 transition progress
  const ambientRef = useRef<AmbientParticle[]>([]);
  const startTimeRef = useRef(Date.now());
  const [error, setError] = useState(false);

  // Initialize ambient particles
  useEffect(() => {
    const particles: AmbientParticle[] = [];
    for (let i = 0; i < 35; i++) {
      particles.push({
        x: Math.random() * size,
        y: Math.random() * size,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.4 + 0.1,
        hue: 200 + Math.random() * 60, // blue-cyan range
        phase: Math.random() * Math.PI * 2,
      });
    }
    ambientRef.current = particles;
  }, [size]);

  // Fetch rolling token periodically
  const fetchToken = useCallback(async () => {
    if (isUsed) return;
    try {
      const { data } = await getRollingToken(ticketId);
      const newMatrix = getQRMatrix(data.token);
      if (newMatrix) {
        prevMatrixRef.current = matrixRef.current;
        matrixRef.current = newMatrix;
        transitionRef.current = 0; // start transition
        tokenRef.current = data.token;
        setError(false);
      }
    } catch {
      setError(true);
    }
  }, [ticketId, isUsed]);

  useEffect(() => {
    if (isUsed) return;
    fetchToken();
    const interval = setInterval(fetchToken, 8000);
    return () => clearInterval(interval);
  }, [fetchToken, isUsed]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    startTimeRef.current = Date.now();

    const draw = () => {
      const now = Date.now();
      const elapsed = (now - startTimeRef.current) / 1000;

      ctx.clearRect(0, 0, size, size);

      // Dark background with subtle radial gradient
      const bgGrad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.7);
      bgGrad.addColorStop(0, 'rgba(15, 15, 25, 0.95)');
      bgGrad.addColorStop(1, 'rgba(5, 5, 12, 0.98)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, size, size);

      // Update transition
      if (transitionRef.current < 1) {
        transitionRef.current = Math.min(1, transitionRef.current + 0.03);
      }
      const t = transitionRef.current;

      // Draw QR modules as animated dots
      const matrix = matrixRef.current;
      if (matrix && !isUsed) {
        const padding = size * 0.1;
        const available = size - padding * 2;
        const cellSize = available / matrix.size;
        const dotRadius = cellSize * 0.38;

        // Sweeping light effect — a diagonal glow line
        const sweepAngle = Math.PI / 4;
        const sweepSpeed = 0.4;
        const sweepPos = ((elapsed * sweepSpeed) % 1.6) - 0.3; // -0.3 to 1.3

        for (let row = 0; row < matrix.size; row++) {
          for (let col = 0; col < matrix.size; col++) {
            if (!matrix.modules[row][col]) continue;

            const cx = padding + col * cellSize + cellSize / 2;
            const cy = padding + row * cellSize + cellSize / 2;

            // Normalized position along sweep direction
            const normX = (cx - padding) / available;
            const normY = (cy - padding) / available;
            const sweepDist = Math.abs(
              (normX * Math.cos(sweepAngle) + normY * Math.sin(sweepAngle)) - sweepPos
            );
            const sweepGlow = Math.max(0, 1 - sweepDist * 5); // glow intensity near sweep line

            // Per-dot animation
            const phase = (row * 7 + col * 13) * 0.1;
            const breathe = 0.85 + 0.15 * Math.sin(elapsed * 1.5 + phase);
            const jitterX = Math.sin(elapsed * 0.7 + phase * 2) * 0.6;
            const jitterY = Math.cos(elapsed * 0.9 + phase * 3) * 0.6;

            const isFinder = isFinderPattern(col, row, matrix.size);
            const finderScale = isFinder ? 1.15 : 1;

            // Transition: new dots fade/scale in
            const dotT = Math.min(1, t * 2 + (1 - t) * ((row + col) / (matrix.size * 2)));
            const scale = dotT * breathe * finderScale;
            const r = dotRadius * scale;

            if (r < 0.3) continue;

            const drawX = cx + jitterX;
            const drawY = cy + jitterY;

            // Base color: white-blue, finder patterns slightly brighter
            const baseAlpha = (isFinder ? 0.95 : 0.85) * dotT;
            const glowAlpha = baseAlpha + sweepGlow * 0.3;

            // Outer glow
            const glowRadius = r * (2.5 + sweepGlow * 1.5);
            const glow = ctx.createRadialGradient(drawX, drawY, r * 0.3, drawX, drawY, glowRadius);
            glow.addColorStop(0, `rgba(120, 180, 255, ${glowAlpha * 0.3})`);
            glow.addColorStop(0.5, `rgba(80, 140, 247, ${glowAlpha * 0.1})`);
            glow.addColorStop(1, 'rgba(80, 140, 247, 0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(drawX, drawY, glowRadius, 0, Math.PI * 2);
            ctx.fill();

            // Core dot
            const coreGrad = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, r);
            const coreWhite = Math.min(255, 200 + sweepGlow * 55);
            coreGrad.addColorStop(0, `rgba(${coreWhite}, ${coreWhite}, 255, ${glowAlpha})`);
            coreGrad.addColorStop(0.7, `rgba(140, 190, 255, ${glowAlpha * 0.8})`);
            coreGrad.addColorStop(1, `rgba(80, 142, 247, ${glowAlpha * 0.4})`);
            ctx.fillStyle = coreGrad;
            ctx.beginPath();
            ctx.arc(drawX, drawY, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Sweep line glow overlay
        if (sweepPos > -0.2 && sweepPos < 1.2) {
          ctx.save();
          ctx.translate(size / 2, size / 2);
          ctx.rotate(sweepAngle);
          const lineX = (sweepPos - 0.5) * available * 1.4;
          const lineGrad = ctx.createLinearGradient(lineX - 15, 0, lineX + 15, 0);
          lineGrad.addColorStop(0, 'rgba(100, 180, 255, 0)');
          lineGrad.addColorStop(0.5, 'rgba(100, 180, 255, 0.06)');
          lineGrad.addColorStop(1, 'rgba(100, 180, 255, 0)');
          ctx.fillStyle = lineGrad;
          ctx.fillRect(lineX - 15, -size, 30, size * 2);
          ctx.restore();
        }
      }

      // "Used" overlay
      if (isUsed) {
        ctx.fillStyle = 'rgba(5, 5, 12, 0.7)';
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = '#ef4444';
        ctx.font = `bold ${size * 0.13}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✗', size / 2, size / 2 - size * 0.06);
        ctx.font = `600 ${size * 0.055}px Inter, sans-serif`;
        ctx.fillText('Kullanıldı', size / 2, size / 2 + size * 0.08);
      }

      // Ambient floating particles
      const particles = ambientRef.current;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = size;
        if (p.x > size) p.x = 0;
        if (p.y < 0) p.y = size;
        if (p.y > size) p.y = 0;

        const flickerOpacity = p.opacity * (0.6 + 0.4 * Math.sin(elapsed * 2 + p.phase));
        ctx.fillStyle = `hsla(${p.hue}, 70%, 70%, ${flickerOpacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [size, isUsed]);

  if (error && !matrixRef.current) {
    return (
      <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#f59e0b', fontSize: 12 }}>Token alınamadı</span>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: size,
        height: size,
        borderRadius: 16,
      }}
    />
  );
}
