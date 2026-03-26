import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { setAuth } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await login(form.email, form.password);
      setAuth(data.token, data.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Giriş başarısız.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>⬡</div>
        <h1 style={styles.title}>Giriş Yap</h1>
        <p style={styles.sub}>Particle Ticket sistemine hoş geldiniz</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            style={styles.input}
            type="email"
            placeholder="E-posta"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Şifre"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
          </button>
        </form>

        <p style={styles.link}>
          Hesabın yok mu?{' '}
          <Link to="/register" style={{ color: '#4f8ef7' }}>Kayıt Ol</Link>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    background: 'radial-gradient(ellipse at 50% 0%, #1a1a40 0%, #0a0a0f 60%)',
  },
  card: {
    background: '#12121a', border: '1px solid #2a2a3a',
    borderRadius: 24, padding: '40px 36px',
    width: 380, maxWidth: '95vw',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
  },
  logo: { fontSize: 40, marginBottom: 4 },
  title: { fontSize: 24, fontWeight: 700, color: '#e8e8f0' },
  sub: { fontSize: 14, color: '#8888aa', marginBottom: 16 },
  form: { width: '100%', display: 'flex', flexDirection: 'column', gap: 12 },
  input: {
    background: '#1a1a26', border: '1px solid #2a2a3a',
    borderRadius: 12, padding: '13px 16px',
    color: '#e8e8f0', fontSize: 15, width: '100%',
  },
  btn: {
    background: 'linear-gradient(135deg, #4f8ef7, #7c5cfc)',
    color: '#fff', borderRadius: 12, padding: '14px',
    fontSize: 15, fontWeight: 600, marginTop: 4,
    transition: 'opacity 0.2s',
  },
  error: { color: '#ef4444', fontSize: 13, textAlign: 'center' },
  link: { fontSize: 14, color: '#8888aa', marginTop: 8 },
};
