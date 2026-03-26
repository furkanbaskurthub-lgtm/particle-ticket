/**
 * ParticleCloud — Encoder
 *
 * Algoritma:
 *  1. encryptedPayload (Base64 string) → UTF-8 byte dizisine çevrilir
 *  2. Her byte 8 bit → her bit 1 parçacık
 *  3. Parçacık özellikleri:
 *       ring    = byte index  (iç → dış halka)
 *       angle   = bit index içindeki açı (0-2π), hafif spiral offset
 *       radius  = BASE_R + ring * RING_GAP
 *       size    = bit===1 → BIG_SIZE, bit===0 → SMALL_SIZE
 *  4. Animasyon: her parçacık kendi ekseninde yavaşça döner (farklı hız)
 *     + merkeze doğru hafif nefes (scale) efekti
 *  5. Decoder bu boyut farkını okuyarak biti geri çözer
 */

import React, { useEffect, useRef, useMemo } from 'react';

interface Props {
  encryptedPayload: string; // AES-256 Base64 string
  size?: number;            // canvas boyutu (px)
}

interface Particle {
  baseAngle: number;
  radius: number;
  size: number;
  bit: 0 | 1;
  ring: number;
  speed: number;   // dönüş hızı (rad/frame)
  phase: number;   // başlangıç faz offset
  color: [number, number, number]; // RGB
}

const BASE_R = 45;
const RING_GAP = 9;
const BIG_SIZE = 3.5;
const SMALL_SIZE = 1.2;

/** Seeded pseudo-random (Mulberry32) — aynı seed → aynı sonuç */
function seededRand(seed: number) {
  let s = seed;
  return () => {
    s |= 0; s = s + 0x6d2b79f5 | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildParticles(payload: string): Particle[] {
  // Base64 → byte array
  const binary = atob(payload.replace(/[^A-Za-z0-9+/=]/g, ''));
  const bytes: number[] = [];
  for (let i = 0; i < binary.length; i++) bytes.push(binary.charCodeAt(i));

  const particles: Particle[] = [];

  bytes.forEach((byte, ring) => {
    for (let bitIdx = 0; bitIdx < 8; bitIdx++) {
      const bit = ((byte >> (7 - bitIdx)) & 1) as 0 | 1;
      const rand = seededRand(ring * 8 + bitIdx);

      const baseAngle = (bitIdx / 8) * Math.PI * 2 + ring * 0.18; // spiral
      const radius = BASE_R + ring * RING_GAP + rand() * 4 - 2;
      const size = bit === 1
        ? BIG_SIZE + rand() * 1.2
        : SMALL_SIZE + rand() * 0.6;

      // Mavi-beyaz renk paleti (Apple Quick Start tarzı)
      const blue = Math.floor(180 + rand() * 75);
      const green = Math.floor(160 + rand() * 60);
      const color: [number, number, number] = [
        Math.floor(80 + rand() * 60),
        green,
        blue,
      ];

      particles.push({
        baseAngle,
        radius,
        size,
        bit,
        ring,
        speed: (0.002 + rand() * 0.003) * (rand() > 0.5 ? 1 : -1),
        phase: rand() * Math.PI * 2,
        color,
      });
    }
  });

  return particles;
}

export default function ParticleCloud({ encryptedPayload, size = 320 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  const particles = useMemo(() => {
    try { return buildParticles(encryptedPayload); }
    catch { return []; }
  }, [encryptedPayload]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || particles.length === 0) return;
    const ctx = canvas.getContext('2d')!;
    const cx = size / 2;
    const cy = size / 2;

    const draw = (t: number) => {
      timeRef.current = t;
      ctx.clearRect(0, 0, size, size);

      // Arka plan gradient (derin uzay hissi)
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
      bg.addColorStop(0, 'rgba(20,20,40,0.95)');
      bg.addColorStop(1, 'rgba(8,8,18,0.98)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, size, size);

      // Merkez parıltısı
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60);
      glow.addColorStop(0, 'rgba(100,160,255,0.12)');
      glow.addColorStop(1, 'rgba(100,160,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);

      // Nefes efekti (0.97 - 1.03 arası scale)
      const breath = 1 + Math.sin(t * 0.0008) * 0.03;

      particles.forEach((p) => {
        const angle = p.baseAngle + p.speed * t + p.phase;
        const r = p.radius * breath;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;

        // Parçacık parıltısı (büyük parçacıklar daha parlak)
        if (p.bit === 1) {
          const glowR = ctx.createRadialGradient(x, y, 0, x, y, p.size * 3);
          glowR.addColorStop(0, `rgba(${p.color[0]},${p.color[1]},${p.color[2]},0.4)`);
          glowR.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = glowR;
          ctx.beginPath();
          ctx.arc(x, y, p.size * 3, 0, Math.PI * 2);
          ctx.fill();
        }

        // Parçacık kendisi
        const opacity = 0.65 + Math.sin(t * 0.001 + p.phase) * 0.25;
        ctx.fillStyle = `rgba(${p.color[0]},${p.color[1]},${p.color[2]},${opacity})`;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [particles, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ borderRadius: '50%', display: 'block' }}
    />
  );
}
