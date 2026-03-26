import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import Ticket from '../models/Ticket';
import User from '../models/User';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { encryptTicketId, decryptTicketId } from '../utils/crypto';
import { generateRollingToken, verifyRollingToken } from '../utils/rollingToken';

const router = Router();

// POST /api/tickets/purchase  → Bilet satın al
router.post('/purchase', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { eventName } = req.body;
    const ticketId = uuidv4();
    const encryptedPayload = encryptTicketId(ticketId);

    const ticket = await Ticket.create({
      userId: req.userId,
      ticketId,
      encryptedPayload,
      eventName: eventName || 'Particle Fest 2024',
    });

    res.status(201).json({
      message: 'Bilet başarıyla oluşturuldu.',
      ticket: {
        id: ticket._id,
        ticketId: ticket.ticketId,
        encryptedPayload: ticket.encryptedPayload, // → Encoder'a gönderilecek
        eventName: ticket.eventName,
        purchaseDate: ticket.purchaseDate,
        isUsed: ticket.isUsed,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Bilet oluşturulamadı.', error: err });
  }
});

// GET /api/tickets/my  → Kullanıcının biletlerini listele
router.get('/my', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tickets = await Ticket.find({ userId: req.userId }).sort({ purchaseDate: -1 });
    res.json({ tickets });
  } catch (err) {
    res.status(500).json({ message: 'Biletler alınamadı.', error: err });
  }
});

// POST /api/tickets/validate  → Tarayıcı uygulaması bu endpoint'i çağırır
router.post('/validate', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { encryptedPayload } = req.body;

    if (!encryptedPayload) {
      res.status(400).json({ message: 'Şifreli payload gerekli.' });
      return;
    }

    // Şifreyi çöz → ticketId'yi al
    let ticketId: string;
    try {
      ticketId = decryptTicketId(encryptedPayload);
      if (!ticketId) throw new Error('Boş sonuç');
    } catch {
      res.status(400).json({ valid: false, message: 'Geçersiz kod. Çözümleme başarısız.' });
      return;
    }

    // Veritabanında ara
    const ticket = await Ticket.findOne({ ticketId }).populate<{ userId: { name: string; email: string } }>('userId', 'name email');

    if (!ticket) {
      res.status(404).json({ valid: false, message: 'Bilet bulunamadı.' });
      return;
    }

    if (ticket.isUsed) {
      res.status(409).json({
        valid: false,
        message: 'Bu bilet daha önce kullanılmış.',
        usedAt: ticket.usedAt,
      });
      return;
    }

    // Bileti kullanıldı olarak işaretle
    ticket.isUsed = true;
    ticket.usedAt = new Date();
    await ticket.save();

    const owner = ticket.userId as unknown as { name: string; email: string };

    res.json({
      valid: true,
      message: 'GEÇEBİLİR ✓',
      customerName: owner.name,
      customerEmail: owner.email,
      eventName: ticket.eventName,
      purchaseDate: ticket.purchaseDate,
    });
  } catch (err) {
    res.status(500).json({ message: 'Doğrulama hatası.', error: err });
  }
});

// GET /api/tickets/rolling-token/:ticketId  → Customer-app bu endpoint'i her 8-10 sn'de çağırır
router.get('/rolling-token/:ticketId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { ticketId } = req.params;

    const ticket = await Ticket.findOne({ ticketId, userId: req.userId });
    if (!ticket) {
      res.status(404).json({ message: 'Bilet bulunamadı.' });
      return;
    }

    if (ticket.isUsed) {
      res.status(409).json({ message: 'Bu bilet kullanılmış.', usedAt: ticket.usedAt });
      return;
    }

    const { token, expiresIn } = generateRollingToken(ticketId);

    res.json({ token, expiresIn });
  } catch (err) {
    res.status(500).json({ message: 'Token üretilemedi.', error: err });
  }
});

// POST /api/tickets/validate-token  → Scanner uygulaması bu endpoint'i çağırır (Apple-like)
router.post('/validate-token', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({ valid: false, message: 'Token gerekli.' });
      return;
    }

    // 1) Token imzasını ve TTL'ini doğrula
    const verification = verifyRollingToken(token);
    if (!verification.valid || !verification.ticketId) {
      res.status(400).json({ valid: false, message: verification.error || 'Geçersiz token.' });
      return;
    }

    // 2) Veritabanında bileti bul
    const ticket = await Ticket.findOne({ ticketId: verification.ticketId })
      .populate<{ userId: { name: string; email: string } }>('userId', 'name email');

    if (!ticket) {
      res.status(404).json({ valid: false, message: 'Bilet bulunamadı.' });
      return;
    }

    // 3) Kullanılmış mı?
    if (ticket.isUsed) {
      res.status(409).json({
        valid: false,
        message: 'Bu bilet daha önce kullanılmış.',
        usedAt: ticket.usedAt,
      });
      return;
    }

    // 4) Anti-replay: aynı pencere tekrar kabul edilmez
    if (verification.window && ticket.lastTokenWindow >= verification.window) {
      res.status(409).json({ valid: false, message: 'Token zaten kullanıldı (replay).' });
      return;
    }

    // 5) Bileti kullanıldı olarak işaretle
    ticket.isUsed = true;
    ticket.usedAt = new Date();
    ticket.lastTokenWindow = verification.window || 0;
    await ticket.save();

    const owner = ticket.userId as unknown as { name: string; email: string };

    res.json({
      valid: true,
      message: 'GEÇEBİLİR ✓',
      customerName: owner.name,
      customerEmail: owner.email,
      eventName: ticket.eventName,
      purchaseDate: ticket.purchaseDate,
    });
  } catch (err) {
    res.status(500).json({ valid: false, message: 'Doğrulama hatası.', error: err });
  }
});

export default router;
