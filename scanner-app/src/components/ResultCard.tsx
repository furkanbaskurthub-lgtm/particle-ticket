import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ValidateResponse } from '../api/client';

interface Props {
  result: ValidateResponse;
  onReset: () => void;
}

export default function ResultCard({ result, onReset }: Props) {
  const isValid = result.valid;

  return (
    <View style={styles.overlay}>
      <View style={[styles.card, { borderColor: isValid ? '#22c55e' : '#ef4444' }]}>
        {/* İkon */}
        <View style={[styles.iconCircle, { backgroundColor: isValid ? '#0f2a1a' : '#2a0f0f' }]}>
          <Text style={[styles.icon, { color: isValid ? '#22c55e' : '#ef4444' }]}>
            {isValid ? '✓' : '✗'}
          </Text>
        </View>

        {/* Başlık */}
        <Text style={[styles.title, { color: isValid ? '#22c55e' : '#ef4444' }]}>
          {result.message}
        </Text>

        {/* Detaylar (sadece geçerli biletlerde) */}
        {isValid && (
          <View style={styles.details}>
            <DetailRow label="Müşteri" value={result.customerName ?? '-'} />
            <DetailRow label="E-posta" value={result.customerEmail ?? '-'} />
            <DetailRow label="Etkinlik" value={result.eventName ?? '-'} />
            <DetailRow
              label="Alım Tarihi"
              value={result.purchaseDate
                ? new Date(result.purchaseDate).toLocaleDateString('tr-TR', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })
                : '-'}
            />
          </View>
        )}

        {/* Kullanılmış bilet için ek bilgi */}
        {!isValid && result.usedAt && (
          <Text style={styles.usedAt}>
            Kullanım tarihi:{' '}
            {new Date(result.usedAt).toLocaleString('tr-TR')}
          </Text>
        )}

        {/* Tekrar Tara butonu */}
        <TouchableOpacity style={styles.resetBtn} onPress={onReset} activeOpacity={0.8}>
          <Text style={styles.resetText}>Yeni Bilet Tara</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#12121a',
    borderRadius: 24,
    borderWidth: 1,
    padding: 28,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: 16,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 36, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  details: { width: '100%', gap: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a26',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rowLabel: { fontSize: 13, color: '#8888aa' },
  rowValue: { fontSize: 13, color: '#e8e8f0', fontWeight: '500', maxWidth: 180, textAlign: 'right' },
  usedAt: { fontSize: 13, color: '#8888aa', textAlign: 'center' },
  resetBtn: {
    backgroundColor: '#1a1a26',
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#2a2a3a',
    marginTop: 4,
  },
  resetText: { color: '#4f8ef7', fontSize: 15, fontWeight: '600' },
});
