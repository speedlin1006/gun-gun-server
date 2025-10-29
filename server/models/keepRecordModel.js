import mongoose from "mongoose"

const keepRecordSchema = new mongoose.Schema({
  player: { type: String, required: true },
  gunName: { type: String, required: true },
  startDate: { type: Date, default: Date.now },
  expireDate: { type: Date, required: true },
  active: { type: Boolean, default: true },
  reason: { type: String, default: "" },
  updatedAt: { type: Date, default: Date.now }
})

export default mongoose.model("KeepRecord", keepRecordSchema)
