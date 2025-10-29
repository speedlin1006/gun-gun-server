import mongoose from "mongoose"

const keepRecordSchema = new mongoose.Schema({
  player: { type: String, required: true },
  gunName: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  startDate: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
  locked: { type: Boolean, default: false },
  reason: { type: String, default: "" },

  // ✅ 新增以下欄位紀錄解除資訊
  unlockBy: { type: String, default: "" },         // 誰解除的
  unlockReason: { type: String, default: "" },     // 解除原因
  unlockTime: { type: Date }                       // 解除時間
}, { timestamps: true })

export default mongoose.model("KeepRecord", keepRecordSchema)
