import mongoose from "mongoose";

const poolResultSchema = new mongoose.Schema({
  month: { type: String, required: true },         // 抽獎月份，例如 2025-01
  amount: { type: Number, required: true },        // 抽獎金額
  winner: { type: String, required: true },        // 中奖人
  drawTime: { type: Date, default: Date.now }      // 抽獎時間
});

export default mongoose.model("PoolResult", poolResultSchema, "pool_results");
