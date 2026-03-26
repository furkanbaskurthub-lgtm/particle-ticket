# Particle Ticket

Apple Wallet benzeri bir yaklaşımla tasarlanmış, **ekran görüntüsü (screenshot) ve replay** saldırılarına dayanıklı biletleme sistemi.

Bu projede klasik “statik QR” yerine:

- **Rolling Token (10 sn TTL)**: Sürekli değişen, HMAC imzalı doğrulama token’ı
- **ParticleQR**: Token’ı QR formatında ama **kare bloklar yerine animasyonlu/parlayan taneciklerden** oluşan görsel
- **Scanner-app**: React Native + VisionCamera `useCodeScanner` ile standart QR okuma

Amaç: Kullanıcı “Göster” dediğinde bilet ekranı canlı ve dinamik kalsın; görevli de hızlı, sağlam ve profesyonel şekilde okutabilsin.
Demo Video ve görevlinin telefondan qr'ı okuttuktan sonraki ekranı:

---

https://github.com/user-attachments/assets/742f024f-fce9-49b4-bb65-1a84cc6c510b


![görevli](https://github.com/user-attachments/assets/dd04ce88-531d-459b-a120-d28c34b967d2)




## Neden düz QR kullanmıyoruz?

Statik QR ekran görüntüsü alınarak kopyalanabilir. Bu projede hedeflenen “Apple Wallet hissi” için:

- **Token sürekli değişir (rolling)**: Ekran görüntüsü birkaç saniye içinde işe yaramaz.
- **Anti-replay**: Aynı zaman penceresindeki token tekrar kullanılamaz.
- **Görsel olarak QR saklanır**: Düz siyah-beyaz kare QR yerine, tanecik/ışık efektiyle “canlı” bir kod görüntüsü elde edilir.



---

## Proje Yapısı

```
particle-ticket/
├── backend/          Node.js + Express + MongoDB (rolling token + validate)
├── customer-app/     React Web (Vite) — bilet satın al + bilet göster (ParticleQR)
└── scanner-app/      React Native — VisionCamera QR scanner + doğrulama sonucu
```

---

## Sistem Akışı (Uçtan Uca)

1. Kullanıcı `customer-app` üzerinden giriş yapar ve bilet satın alır.
2. Kullanıcı bilet modalını açar.
3. `customer-app` her **8 saniyede** bir backend’den yeni rolling token alır.
4. Token, `ParticleQR` ile **tanecikli/animasyonlu** bir QR olarak çizilir.
5. Görevli `scanner-app` ile QR’ı okur.
6. `scanner-app` token’ı backend’e gönderir (`/validate-token`).
7. Backend:
   - İmza doğrular
   - TTL kontrolü yapar
   - Anti-replay kontrolü yapar
   - Bileti `used` olarak işaretler
8. Scanner ekranda **müşteri adı / etkinlik / durum** gösterir.

---

## Güvenlik Modeli (Özet)

- **HMAC imzalı token**: Token client tarafından uydurulamaz.
- **Kısa TTL**: Token penceresi 10 saniyedir.
- **Anti-replay**: `Ticket.lastTokenWindow` ile aynı pencere 2. kez kabul edilmez.
- **Tek kullanımlık bilet**: `isUsed` + `usedAt` ile tekrar giriş engellenir.

---

## Backend (Express + MongoDB)

### Kurulum

```bash
cd backend
npm install
```

### Ortam Değişkenleri

`backend/.env.example` dosyasını kopyalayıp `backend/.env` oluştur:

```bash
cp .env.example .env
```

Değişkenler:

- **`PORT`**: Varsayılan `5000`
- **`MONGODB_URI`**: MongoDB bağlantı string’i
- **`JWT_SECRET`**: Auth token imzalama anahtarı
- **`AES_SECRET`**: (Projedeki eski payload mekanizması için) AES anahtarı
- **`ROLLING_SECRET`**: Rolling token HMAC anahtarı

### Çalıştırma

```bash
npm run dev
# http://localhost:5000
```

### Önemli Endpoint’ler

| Method | URL | Açıklama |
|---|---|---|
| POST | `/api/auth/register` | Kayıt |
| POST | `/api/auth/login` | Giriş |
| POST | `/api/tickets/purchase` | Bilet oluştur (JWT) |
| GET | `/api/tickets/my` | Biletlerim (JWT) |
| GET | `/api/tickets/rolling-token/:ticketId` | Rolling token üret (JWT) |
| POST | `/api/tickets/validate-token` | Rolling token doğrula (scanner) |
| GET | `/health` | Sağlık kontrolü |

---

## Customer App (Web)

### Kurulum & Çalıştırma

```bash
cd customer-app
npm install
npm run dev
```

Vite çıktı olarak bir port verecek (örn. `http://localhost:3001`).

### ParticleQR

`customer-app/src/components/ParticleQR.tsx`:

- QR matrix `qrcode` paketi ile üretilir.
- Modüller kare yerine **parlayan dairesel noktalar** şeklinde çizilir.
- Hafif **nefes** ve **mikro-jitter** animasyonu vardır.
- Üstünden **ışık süpürme** (sweep glow) efekti geçer.
- Arka planda ambient parçacıklar dolaşır.

---

## Scanner App (React Native)

### Kurulum

```bash
cd scanner-app
npm install
```

### Backend URL ayarı

`scanner-app/src/api/client.ts` içindeki `BASE_URL`:

- Android emülatör: `http://10.0.2.2:5000/api`
- Gerçek cihaz: `http://<bilgisayar-ip>:5000/api`

### Çalıştırma (Android)

```bash
npx react-native run-android
```

Scanner ekranında “Taramayı Başlat” → QR’ı çerçeveye al → sonuç kartı.

---

## Demo (Hızlı Test)

1. MongoDB çalıştır.
2. Backend’i başlat.
3. Customer-app’i başlat.
4. Kayıt ol / giriş yap → bilet satın al → bileti göster.
5. Scanner-app ile okut → backend doğrulasın.

---

## Notlar

- Repo’da `.env` dosyaları commit edilmez; `backend/.env.example` referans içindir.
- `scanner-app/android/app/debug.keystore` repoda var. Bu sadece debug içindir (prod için ayrı süreç gerekir).

---

## Roadmap (İsteğe Bağlı)

- Daha sık token güncelleme (örn. 5 sn)
- Kullanım sonrası “geçti” animasyonu + haptics
- Offline mod (kısa süreli cache + server sync)
- QR görünümünü cihaz parlaklığına göre otomatik optimize etme
