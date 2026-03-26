import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { purchaseTicket, getMyTickets } from '../api/client';
import TicketModal from '../components/TicketModal';

interface Ticket {
  _id: string;
  ticketId: string;
  encryptedPayload: string;
  eventName: string;
  purchaseDate: string;
  isUsed: boolean;
}

type ConfirmState = 'idle' | 'confirm' | 'loading';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState>('idle');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [fetchError, setFetchError] = useState('');

  const fetchTickets = useCallback(async () => {
    try {
      const { data } = await getMyTickets();
      setTickets(data.tickets);
    } catch {
      setFetchError('Biletler yüklenemedi.');
    }
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const handlePurchaseClick = () => setConfirmState('confirm');

  const handleConfirm = async (yes: boolean) => {
    if (!yes) { setConfirmState('idle'); return; }
    setConfirmState('loading');
    try {
      await purchaseTicket();
      await fetchTickets();
    } catch {
      // hata sessizce geçilir, kullanıcı tekrar deneyebilir
    } finally {
      setConfirmState('idle');
    }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.brand}>⬡ Particle Ticket</div>
        <div style={styles.headerRight}>
          <span style={styles.userName}>{user?.name}</span>
          <button style={styles.logoutBtn} onClick={handleLogout}>Çıkış</button>
        </div>
      </header>

      <main style={styles.main}>
        {/* Hero */}
        <div style={styles.hero}>
          <h2 style={styles.heroTitle}>Hoş geldin, {user?.name?.split(' ')[0]} 👋</h2>
          <p style={styles.heroSub}>Etkinlik biletlerini parçacık bulutu teknolojisiyle güvende tut.</p>
        </div>

        {/* Purchase Button */}
        <div style={styles.purchaseSection}>
          {confirmState === 'idle' && (
            <button style={styles.purchaseBtn} onClick={handlePurchaseClick}>
              + Bilet Satın Al
            </button>
          )}

          {confirmState === 'confirm' && (
            <div style={styles.confirmBox}>
              <p style={styles.confirmText}>
                "Particle Fest 2024" için bilet satın almak istediğinize emin misiniz?
              </p>
              <div style={styles.confirmBtns}>
                <button style={styles.yesBtn} onClick={() => handleConfirm(true)}>Evet, Satın Al</button>
                <button style={styles.noBtn} onClick={() => handleConfirm(false)}>Hayır</button>
              </div>
            </div>
          )}

          {confirmState === 'loading' && (
            <div style={styles.loadingBox}>
              <div style={styles.spinner} />
              <span style={{ color: '#8888aa', fontSize: 14 }}>Bilet oluşturuluyor…</span>
            </div>
          )}
        </div>

        {/* Tickets */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>
            Biletlerim
            <span style={styles.badge}>{tickets.length}</span>
          </h3>

          {fetchError && <p style={styles.error}>{fetchError}</p>}

          {tickets.length === 0 && !fetchError && (
            <div style={styles.empty}>
              <span style={{ fontSize: 40 }}>🎫</span>
              <p>Henüz biletiniz yok.</p>
            </div>
          )}

          <div style={styles.grid}>
            {tickets.map((t) => (
              <div
                key={t._id}
                style={{ ...styles.ticketCard, opacity: t.isUsed ? 0.5 : 1 }}
                onClick={() => !t.isUsed && setSelectedTicket(t)}
              >
                <div style={styles.ticketTop}>
                  <span style={styles.ticketEvent}>{t.eventName}</span>
                  <span style={{
                    ...styles.ticketStatus,
                    background: t.isUsed ? '#2a1a1a' : '#0f2a1a',
                    color: t.isUsed ? '#ef4444' : '#22c55e',
                  }}>
                    {t.isUsed ? 'Kullanıldı' : 'Geçerli'}
                  </span>
                </div>
                <p style={styles.ticketDate}>
                  {new Date(t.purchaseDate).toLocaleDateString('tr-TR', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </p>
                {!t.isUsed && (
                  <p style={styles.ticketHint}>Görüntülemek için tıkla →</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      {selectedTicket && (
        <TicketModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0a0a0f' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '1px solid #1a1a26',
    background: '#0d0d18',
    position: 'sticky', top: 0, zIndex: 100,
  },
  brand: { fontSize: 18, fontWeight: 700, color: '#e8e8f0', letterSpacing: -0.3 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  userName: { fontSize: 14, color: '#8888aa' },
  logoutBtn: {
    background: '#1a1a26', border: '1px solid #2a2a3a',
    color: '#8888aa', borderRadius: 8, padding: '6px 14px', fontSize: 13,
  },
  main: { maxWidth: 680, margin: '0 auto', padding: '32px 20px' },
  hero: { marginBottom: 32 },
  heroTitle: { fontSize: 26, fontWeight: 700, color: '#e8e8f0', marginBottom: 6 },
  heroSub: { fontSize: 15, color: '#8888aa' },
  purchaseSection: { marginBottom: 36 },
  purchaseBtn: {
    background: 'linear-gradient(135deg, #4f8ef7, #7c5cfc)',
    color: '#fff', borderRadius: 14, padding: '15px 32px',
    fontSize: 16, fontWeight: 600,
    boxShadow: '0 4px 24px rgba(79,142,247,0.3)',
    transition: 'transform 0.15s',
  },
  confirmBox: {
    background: '#12121a', border: '1px solid #2a2a3a',
    borderRadius: 16, padding: '20px 24px',
  },
  confirmText: { fontSize: 15, color: '#e8e8f0', marginBottom: 16, lineHeight: 1.5 },
  confirmBtns: { display: 'flex', gap: 10 },
  yesBtn: {
    background: 'linear-gradient(135deg, #4f8ef7, #7c5cfc)',
    color: '#fff', borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 600,
  },
  noBtn: {
    background: '#1a1a26', border: '1px solid #2a2a3a',
    color: '#8888aa', borderRadius: 10, padding: '11px 24px', fontSize: 14,
  },
  loadingBox: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '16px 0',
  },
  spinner: {
    width: 20, height: 20,
    border: '2px solid #2a2a3a',
    borderTop: '2px solid #4f8ef7',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  section: {},
  sectionTitle: {
    fontSize: 18, fontWeight: 600, color: '#e8e8f0',
    marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
  },
  badge: {
    background: '#1a1a26', border: '1px solid #2a2a3a',
    color: '#8888aa', borderRadius: 20, padding: '2px 10px', fontSize: 13,
  },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 10, padding: '48px 0', color: '#8888aa', fontSize: 15,
  },
  grid: { display: 'flex', flexDirection: 'column', gap: 12 },
  ticketCard: {
    background: '#12121a', border: '1px solid #2a2a3a',
    borderRadius: 16, padding: '18px 20px',
    cursor: 'pointer', transition: 'border-color 0.2s',
  },
  ticketTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  ticketEvent: { fontSize: 15, fontWeight: 600, color: '#e8e8f0' },
  ticketStatus: { fontSize: 12, fontWeight: 500, borderRadius: 20, padding: '3px 10px' },
  ticketDate: { fontSize: 13, color: '#8888aa' },
  ticketHint: { fontSize: 12, color: '#4f8ef7', marginTop: 6 },
  error: { color: '#ef4444', fontSize: 14 },
};
