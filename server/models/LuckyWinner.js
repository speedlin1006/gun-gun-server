import mongoose from "mongoose";

const LuckyWinnerSchema = new mongoose.Schema({
  round: { type: Number, required: true },
  ticketNumber: { type: Number, required: true },
  name: { type: String, required: true },
  guild: { type: String, required: true },
  totalTicketsAtMoment: { type: Number, required: true },
  totalAmountAtMoment: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("LuckyWinner", LuckyWinnerSchema);
