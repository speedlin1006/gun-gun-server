import mongoose from "mongoose";

const poolSchema = new mongoose.Schema({
  month: { type: String, required: true },        // 例如 "2025-01"
  amount: { type: Number, default: 0 },           // 當前獎池金額
  contributors: { type: [String], default: [] }   // 有貢獻的玩家名字
});

export default mongoose.model("Pool", poolSchema, "pools");
