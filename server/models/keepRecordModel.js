import mongoose from "mongoose"

const keepRecordSchema = new mongoose.Schema(
  {
    player: { type: String, required: true },
    gunName: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    startDate: { type: Date, default: Date.now },
    active: { type: Boolean, default: true },
    locked: { type: Boolean, default: false },

    // ✅ 鎖定資訊
    lockedBy: { type: String, default: "" },
    lockReason: { type: String, default: "" },
    lockTime: { type: Date },

    // ✅ 解鎖資訊
    unlockBy: { type: String, default: "" },
    unlockReason: { type: String, default: "" },
    unlockTime: { type: Date },

    reason: { type: String, default: "" },
    note: { type: String, default: "" },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
)

export default mongoose.model("KeepRecord", keepRecordSchema)
