/**
 * Seed script: Register a test user, purchase tickets, and print rolling tokens.
 * Usage: npx ts-node seed.ts
 */
import axios from 'axios';

const BASE = 'http://localhost:5000/api';

async function main() {
  console.log('── Seed başlıyor ──');

  // 1) Register
  let token: string;
  try {
    const reg = await axios.post(`${BASE}/auth/register`, {
      name: 'Test Kullanıcı',
      email: 'test@particle.com',
      password: 'Test1234!',
    });
    token = reg.data.token;
    console.log('✅ Kayıt başarılı');
  } catch (e: any) {
    if (e.response?.status === 409 || e.response?.data?.message?.includes('zaten')) {
      // Already registered, login instead
      const login = await axios.post(`${BASE}/auth/login`, {
        email: 'test@particle.com',
        password: 'Test1234!',
      });
      token = login.data.token;
      console.log('✅ Giriş başarılı (zaten kayıtlı)');
    } else {
      throw e;
    }
  }

  const headers = { Authorization: `Bearer ${token}` };

  // 2) Purchase tickets
  const events = ['Particle Fest 2024', 'Neon Night', 'Quantum Summit'];
  const tickets: any[] = [];

  for (const eventName of events) {
    const res = await axios.post(`${BASE}/tickets/purchase`, { eventName }, { headers });
    tickets.push(res.data.ticket);
    console.log(`🎟️  Bilet: ${eventName} → ${res.data.ticket.ticketId.slice(0, 8)}...`);
  }

  // 3) Get rolling token for first ticket
  const firstTicket = tickets[0];
  const rollingRes = await axios.get(`${BASE}/tickets/rolling-token/${firstTicket.ticketId}`, { headers });
  console.log(`\n🔑 Rolling token (${firstTicket.eventName}):`);
  console.log(`   Token: ${rollingRes.data.token.slice(0, 40)}...`);
  console.log(`   Expires in: ${rollingRes.data.expiresIn}s`);

  // 4) Validate rolling token (simulates scanner)
  const valRes = await axios.post(`${BASE}/tickets/validate-token`, { token: rollingRes.data.token });
  console.log(`\n✅ Doğrulama sonucu:`);
  console.log(`   Geçerli: ${valRes.data.valid}`);
  console.log(`   Müşteri: ${valRes.data.customerName}`);
  console.log(`   Etkinlik: ${valRes.data.eventName}`);
  console.log(`   Mesaj: ${valRes.data.message}`);

  console.log('\n── Seed tamamlandı ──');
  console.log(`\nTest kullanıcı: test@particle.com / Test1234!`);
  console.log(`Toplam ${tickets.length} bilet oluşturuldu.`);
}

main().catch((e) => {
  console.error('❌ Hata:', e.response?.data || e.message);
  process.exit(1);
});
