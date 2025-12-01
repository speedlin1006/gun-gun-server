import mongoose from "mongoose";

const LuckyStatusSchema = new mongoose.Schema({
  round: { type: Number, default: 1 },      // 當前第幾輪
  totalTickets: { type: Number, default: 0 }, // 目前總號碼數
  totalAmount: { type: Number, default: 0 }   // 累積金額
});

export default mongoose.model("LuckyStatus", LuckyStatusSchema);
