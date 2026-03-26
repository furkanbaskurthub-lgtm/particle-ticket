import mongoose, { Document, Schema } from 'mongoose';

export interface ITicket extends Document {
  userId: mongoose.Types.ObjectId;
  ticketId: string;         // UUID - benzersiz bilet kimliği
  encryptedPayload: string; // AES-256 ile şifrelenmiş ticketId → parçacıklara gömülür
  eventName: string;
  purchaseDate: Date;
  isUsed: boolean;
  usedAt?: Date;
  lastTokenWindow: number;  // Anti-replay: son kabul edilen rolling token penceresi
}

const TicketSchema = new Schema<ITicket>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    ticketId: { type: String, required: true, unique: true },
    encryptedPayload: { type: String, required: true },
    eventName: { type: String, required: true, default: 'Particle Fest 2024' },
    purchaseDate: { type: Date, default: Date.now },
    isUsed: { type: Boolean, default: false },
    usedAt: { type: Date },
    lastTokenWindow: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// userId + isUsed üzerinde index → tarayıcı sorguları hızlanır
TicketSchema.index({ userId: 1, isUsed: 1 });

export default mongoose.model<ITicket>('Ticket', TicketSchema);
