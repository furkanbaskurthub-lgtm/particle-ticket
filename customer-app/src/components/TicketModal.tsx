import React from 'react';
import ParticleQR from './ParticleQR';

interface Ticket {
  _id: string;
  ticketId: string;
  encryptedPayload: string;
  eventName: string;
  purchaseDate: string;
  isUsed: boolean;
}

interface Props {
  ticket: Ticket;
  onClose: () => void;
}

export default function TicketModal({ ticket, onClose }: Props) {
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.eventName}>{ticket.eventName}</span>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.cloudWrap}>
          <ParticleQR ticketId={ticket.ticketId} size={280} isUsed={ticket.isUsed} />
          <p style={styles.hint}>
            {ticket.isUsed ? 'Bu bilet kullanılmış' : 'Görevliye bu ekranı gösterin'}
          </p>
        </div>

        <div style={styles.info}>
          <Row label="Bilet ID" value={ticket.ticketId.slice(0, 18) + '…'} />
          <Row label="Tarih" value={new Date(ticket.purchaseDate).toLocaleDateString('tr-TR')} />
          <Row label="Durum" value={ticket.isUsed ? '✗ Kullanıldı' : '✓ Geçerli'} used={ticket.isUsed} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, used }: { label: string; value: string; used?: boolean }) {
  return (
    <div style={styles.row}>
      <span style={styles.label}>{label}</span>
      <span style={{ ...styles.value, color: used === true ? '#ef4444' : used === false ? '#22c55e' : '#e8e8f0' }}>
        {value}
      </span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.75)',
    backdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#12121a',
    border: '1px solid #2a2a3a',
    borderRadius: 24,
    padding: '28px 24px',
    width: 340,
    maxWidth: '95vw',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20,
  },
  eventName: { fontSize: 17, fontWeight: 600, color: '#e8e8f0' },
  closeBtn: {
    background: '#1a1a26', border: '1px solid #2a2a3a',
    color: '#8888aa', borderRadius: 8, padding: '4px 10px', fontSize: 14,
  },
  cloudWrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    marginBottom: 24,
  },
  hint: { fontSize: 12, color: '#8888aa', letterSpacing: 0.3 },
  info: { display: 'flex', flexDirection: 'column', gap: 10 },
  row: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 14px',
    background: '#1a1a26', borderRadius: 10,
  },
  label: { fontSize: 13, color: '#8888aa' },
  value: { fontSize: 13, fontWeight: 500 },
};
