import mongoose from "mongoose";

const poolSchema = new mongoose.Schema({
  month: { type: String, required: true },        // "2025-11"
  amount: { type: Number, default: 0 },           // 當月累積金額
  contributors: { type: [String], default: [] }   // 當月貢獻者
});

export default mongoose.model("Pool", poolSchema, "pools");
