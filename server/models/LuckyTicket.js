import mongoose from "mongoose";

const LuckyTicketSchema = new mongoose.Schema({
  ticketNumber: { type: Number, required: true },   // 流水號
  name: { type: String, required: true },          // 玩家名
  guild: { type: String, required: true },         // 幫會名
  amount: { type: Number, required: true },        // 這次輸入的實際金額(元)
  round: { type: Number, required: true },         // 第幾輪
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("LuckyTicket", LuckyTicketSchema);
