# Particle Ticket — MVP

QR kod yerine dinamik **Parçacık Bulutu** kullanan, ekran görüntüsüne karşı dayanıklı biletleme sistemi.

---

## Proje Yapısı

```
particle-ticket/
├── backend/          Node.js + Express + MongoDB
├── customer-app/     React Web (Vite) — Bilet satın alma + Encoder
└── scanner-app/      React Native — Kamera + Decoder
```

---

## 1. Backend

```bash
cd backend
# .env dosyasını kontrol et (MongoDB URI, JWT_SECRET, AES_SECRET)
npm install
npm run dev
# → http://localhost:5000
```

### Endpoint'ler
| Method | URL | Açıklama |
|--------|-----|----------|
| POST | /api/auth/register | Kayıt |
| POST | /api/auth/login | Giriş → JWT |
| POST | /api/tickets/purchase | Bilet satın al (JWT) |
| GET  | /api/tickets/my | Biletlerimi listele (JWT) |
| POST | /api/tickets/validate | Tarayıcı doğrulama |
| GET  | /health | Sunucu durumu |

---

## 2. Customer App (Web)

```bash
cd customer-app
npm install
npm run dev
# → http://localhost:3000
```

---

## 3. Scanner App (React Native)

```bash
cd scanner-app
npm install

# Android
npx react-native run-android

# iOS
cd ios && pod install && cd ..
npx react-native run-ios
```

> **Önemli:** `src/api/client.ts` içindeki `BASE_URL`'i kendi bilgisayarınızın IP'siyle güncelleyin.
> Android emülatör için `http://10.0.2.2:5000` kullanın.

---

## Encoder / Decoder Algoritması

```
encryptedPayload (AES-256 Base64)
  → atob() → byte array
  → byte[ring=0..N], bit[bitIdx=0..7]
  → Parçacık:
      angle  = (bitIdx/8)*2π + ring*0.18   (spiral)
      radius = 45 + ring*9 + noise
      size   = bit===1 ? ~4px : ~1.5px     ← DECODER BUNU OKUR
  → Canvas animasyonu (dönen, nefes alan bulut)

Decoder (kamera):
  → Frame → blob detection (BFS, luminance > 155)
  → Her blob: (angle, radius) → ring + bitIdx
  → size > 2.5px → bit=1, aksi → bit=0
  → bits → bytes → Base64 → /api/tickets/validate
```

---

## Güvenlik Özellikleri

- AES-256 şifreleme (payload sadece backend'de çözülür)
- JWT kimlik doğrulama
- Bilet tek kullanımlık (`isUsed` flag)
- Dinamik animasyon → ekran görüntüsü geçersiz
- Seeded random → her render aynı parçacık düzeni (tutarlı decode)
