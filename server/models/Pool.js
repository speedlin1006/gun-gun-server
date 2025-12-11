import mongoose from "mongoose";

const poolSchema = new mongoose.Schema({
  month: { type: String, required: true },       // 2025-11
  amount: { type: Number, default: 0 },          // 當月累積金額
  contributors: [
    {
      name: { type: String, required: true },
      kills: { type: Number, default: 0 }        // 當月有效擊殺（抽獎票數）
    }
  ]
});

export default mongoose.model("Pool", poolSchema, "pools");
