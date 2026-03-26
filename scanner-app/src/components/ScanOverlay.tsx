import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, ViewStyle } from 'react-native';

type CornerKey = 'tl' | 'tr' | 'bl' | 'br';

const CORNER_STYLES: Record<CornerKey, ViewStyle> = {
  tl: { top: 16, left: 16, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  tr: { top: 16, right: 16, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  bl: { bottom: 16, left: 16, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  br: { bottom: 16, right: 16, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
};

interface Props {
  status: 'scanning' | 'processing' | 'success' | 'error' | 'used';
  message?: string;
}

export default function ScanOverlay({ status, message }: Props) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status === 'scanning') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ])
      ).start();

      Animated.loop(
        Animated.timing(rotateAnim, { toValue: 1, duration: 3000, useNativeDriver: true, easing: Easing.linear })
      ).start();
    } else {
      pulseAnim.stopAnimation();
      rotateAnim.stopAnimation();
    }
  }, [status, pulseAnim, rotateAnim]);

  const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const frameColor =
    status === 'success' ? '#22c55e' :
    status === 'error' || status === 'used' ? '#ef4444' :
    status === 'processing' ? '#f59e0b' :
    '#4f8ef7';

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Tarama çerçevesi */}
      <Animated.View style={[
        styles.frame,
        { borderColor: frameColor, transform: [{ scale: pulseAnim }] }
      ]}>
        {/* Köşe işaretleri */}
        {(['tl', 'tr', 'bl', 'br'] as CornerKey[]).map((corner) => (
          <View key={corner} style={[styles.corner, CORNER_STYLES[corner], { borderColor: frameColor }]} />
        ))}

        {/* Dönen tarama çizgisi (sadece scanning modunda) */}
        {status === 'scanning' && (
          <Animated.View style={[styles.scanLine, { borderColor: frameColor, transform: [{ rotate }] }]} />
        )}
      </Animated.View>

      {/* Durum mesajı */}
      <View style={[styles.statusBadge, { backgroundColor: frameColor + '22', borderColor: frameColor }]}>
        <Text style={[styles.statusText, { color: frameColor }]}>
          {status === 'scanning' && '⬡  Parçacık bulutu aranıyor…'}
          {status === 'processing' && '⟳  Çözümleniyor…'}
          {status === 'success' && '✓  GEÇEBİLİR'}
          {status === 'error' && '✗  Geçersiz Bilet'}
          {status === 'used' && '✗  Daha Önce Kullanıldı'}
        </Text>
      </View>

      {message && (
        <View style={styles.messageBadge}>
          <Text style={styles.messageText}>{message}</Text>
        </View>
      )}
    </View>
  );
}

const FRAME_SIZE = 260;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    borderRadius: FRAME_SIZE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderWidth: 3,
  },
  scanLine: {
    width: FRAME_SIZE * 0.7,
    height: 1.5,
    borderTopWidth: 1.5,
    opacity: 0.6,
  },
  statusBadge: {
    marginTop: 28,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  messageBadge: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    maxWidth: 280,
  },
  messageText: {
    color: '#e8e8f0',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
