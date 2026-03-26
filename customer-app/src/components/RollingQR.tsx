import React, { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getRollingToken } from '../api/client';

interface Props {
  ticketId: string;
  size?: number;
  isUsed?: boolean;
}

export default function RollingQR({ ticketId, size = 180, isUsed }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [fade, setFade] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchToken = async () => {
    try {
      const { data } = await getRollingToken(ticketId);
      setFade(true);
      setTimeout(() => {
        setToken(data.token);
        setError(false);
        setFade(false);
      }, 200);
    } catch {
      setError(true);
    }
  };

  useEffect(() => {
    if (isUsed) return;

    fetchToken();
    timerRef.current = setInterval(fetchToken, 8000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [ticketId, isUsed]);

  if (isUsed) {
    return (
      <div style={{ ...styles.wrap, width: size, height: size }}>
        <div style={styles.usedOverlay}>
          <span style={styles.usedIcon}>✗</span>
          <span style={styles.usedText}>Kullanıldı</span>
        </div>
      </div>
    );
  }

  if (error && !token) {
    return (
      <div style={{ ...styles.wrap, width: size, height: size }}>
        <span style={styles.errorText}>Token alınamadı</span>
      </div>
    );
  }

  if (!token) {
    return (
      <div style={{ ...styles.wrap, width: size, height: size }}>
        <div style={styles.spinner} />
      </div>
    );
  }

  return (
    <div style={{ ...styles.wrap, width: size, height: size, opacity: fade ? 0.4 : 1 }}>
      <QRCodeSVG
        value={token}
        size={size - 24}
        bgColor="transparent"
        fgColor="#ffffff"
        level="M"
        style={{ filter: 'drop-shadow(0 0 8px rgba(79,142,247,0.5))' }}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'opacity 0.2s ease',
  },
  usedOverlay: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  usedIcon: {
    fontSize: 40,
    color: '#ef4444',
  },
  usedText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: 600,
  },
  errorText: {
    fontSize: 12,
    color: '#f59e0b',
  },
  spinner: {
    width: 28,
    height: 28,
    border: '3px solid rgba(255,255,255,0.15)',
    borderTopColor: '#4f8ef7',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};
