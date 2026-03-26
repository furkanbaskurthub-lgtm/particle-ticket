import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCodeScanner,
} from 'react-native-vision-camera';

import { validateToken, ValidateResponse } from '../api/client';
import ScanOverlay from '../components/ScanOverlay';
import ResultCard from '../components/ResultCard';

type ScanStatus = 'scanning' | 'processing' | 'success' | 'error' | 'used';

export default function ScanScreen() {
  const [hasPermission, setHasPermission] = useState(false);
  const device = useCameraDevice('back');

  const [status, setStatus] = useState<ScanStatus>('scanning');
  const [result, setResult] = useState<ValidateResponse | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [scanEnabled, setScanEnabled] = useState(false);

  const isProcessing = useRef(false);
  const lastToken = useRef<string>('');

  // ── Kamera izni ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await Camera.getCameraPermissionStatus();
        if (!cancelled) setHasPermission(s === 'granted');
      } catch {
        if (!cancelled) setHasPermission(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const requestPermission = useCallback(async () => {
    try {
      const s = await Camera.requestCameraPermission();
      setHasPermission(s === 'granted');
    } catch {
      setHasPermission(false);
    }
  }, []);

  // ── QR okunduğunda backend'e doğrulama ───────────────────────────────────
  const handleScanned = useCallback(async (token: string) => {
    if (isProcessing.current) return;
    if (token === lastToken.current) return;

    isProcessing.current = true;
    lastToken.current = token;
    setStatus('processing');
    setStatusMessage('Backend ile doğrulanıyor…');

    console.log('[scan] QR okundu, token uzunluk=', token.length);

    try {
      const response = await validateToken(token);

      if (response.valid) {
        setStatus('success');
        setResult(response);
        console.log('[scan] bilet geçerli', response.customerName);
      } else if (response.usedAt) {
        setStatus('used');
        setResult(response);
        console.log('[scan] bilet kullanılmış', response.usedAt);
      } else {
        setStatus('error');
        setStatusMessage(response.message);
        console.log('[scan] bilet geçersiz', response.message);
        setTimeout(() => {
          setStatus('scanning');
          setStatusMessage('');
          lastToken.current = '';
          isProcessing.current = false;
        }, 3000);
      }
    } catch (e: any) {
      setStatus('error');
      const msg = e?.response?.data?.message || 'Sunucuya bağlanılamadı.';
      setStatusMessage(msg);
      console.log('[scan] doğrulama hatası', msg);
      setTimeout(() => {
        setStatus('scanning');
        setStatusMessage('');
        lastToken.current = '';
        isProcessing.current = false;
      }, 3000);
    }
  }, []);

  // ── VisionCamera useCodeScanner — anında QR okuma ────────────────────────
  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      if (!scanEnabled || status !== 'scanning') return;
      const value = codes[0]?.value;
      if (value) {
        console.log('[scan] kod algılandı');
        handleScanned(value);
      }
    },
  });

  // ── Butonlar ─────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setStatus('scanning');
    setResult(null);
    setStatusMessage('');
    lastToken.current = '';
    isProcessing.current = false;
    setScanEnabled(false);
  }, []);

  const handleStartScan = useCallback(() => {
    setResult(null);
    setStatus('scanning');
    setStatusMessage('');
    lastToken.current = '';
    isProcessing.current = false;
    setScanEnabled(true);
    console.log('[scan] tarama başlatıldı');
  }, []);

  // ── İzin yok ─────────────────────────────────────────────────────────────
  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>Kamera izni gerekli.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>İzin Ver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>Kamera bulunamadı.</Text>
      </View>
    );
  }

  // ── Ana ekran ────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={scanEnabled && (status === 'scanning' || status === 'processing')}
        codeScanner={codeScanner}
      />

      <View style={styles.dimOverlay} pointerEvents="none" />

      {!result && scanEnabled && (
        <ScanOverlay status={status} message={statusMessage || undefined} />
      )}

      {result && (
        <ResultCard result={result} onReset={handleReset} />
      )}

      {!scanEnabled && !result && (
        <View style={styles.startOverlay}>
          <Text style={styles.startTitle}>Tarama hazır</Text>
          <Text style={styles.startSub}>
            Müşterinin bilet ekranındaki QR kodunu çerçeveye alın
          </Text>
          <TouchableOpacity style={styles.startBtn} onPress={handleStartScan} activeOpacity={0.85}>
            <Text style={styles.startBtnText}>Taramayı Başlat</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.topBar}>
        <Text style={styles.topTitle}>Bilet Tarayıcı</Text>
        <Text style={styles.topSub}>QR kodu çerçeveye alın</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1, backgroundColor: '#0a0a0f',
    alignItems: 'center', justifyContent: 'center', gap: 16,
  },
  permText: { color: '#e8e8f0', fontSize: 16 },
  permBtn: {
    backgroundColor: '#4f8ef7', borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  permBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 24,
    left: 0, right: 0,
    alignItems: 'center',
    gap: 4,
  },
  topTitle: {
    color: '#e8e8f0', fontSize: 18, fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  topSub: {
    color: 'rgba(255,255,255,0.6)', fontSize: 13,
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  startOverlay: {
    position: 'absolute',
    left: 20, right: 20, bottom: 28,
    backgroundColor: 'rgba(10,10,15,0.85)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    padding: 20,
    gap: 10,
  },
  startTitle: { color: '#e8e8f0', fontSize: 17, fontWeight: '700' },
  startSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 19 },
  startBtn: {
    marginTop: 6,
    backgroundColor: '#4f8ef7',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  startBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
