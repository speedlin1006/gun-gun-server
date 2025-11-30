import mongoose from "mongoose";

const poolResultSchema = new mongoose.Schema({
  month: { type: String, required: true },   // 例如 2025-12
  amount: { type: Number, required: true },  // 當月抽出時的獎池金額
  winner: { type: String, required: true },  // 中獎人
  time: { type: String, required: true }     // 抽獎時間（字串，方便前端顯示）
}, { timestamps: true });

export default mongoose.model("PoolResult", poolResultSchema, "pool_results");
