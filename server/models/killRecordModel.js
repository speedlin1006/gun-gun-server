import mongoose from "mongoose";

const killRecordSchema = new mongoose.Schema({
  uploader: { type: String, required: true },
  guild: { type: String, required: true },

  kills: { type: Number, default: 0 },
  mistakes: { type: Number, default: 0 },
  deaths: { type: Number, default: 0 },

  money: { type: Number, default: 0 },

  /* 🔎 本次模式（搶旗 / 槍戰區 / PK）*/
  mode: { type: String, default: "" },

  /* 💀 死亡 bonus 次數（一天最多 5）*/
  deathBonusCount: { type: Number, default: 0 },

  /* 💀 死亡 bonus 金額 */
  deathBonusMoney: { type: Number, default: 0 },

  /* 五碼匯款帳號 */
  bankAccount: {
    type: String,
    required: true,
    validate: {
      validator: v => /^\d{5}$/.test(v),
      message: "匯款帳號必須是 5 位數字"
    }
  },

  /* 擊殺截圖網址 */
  imageUrl: { type: String, default: "" },

  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("KillRecord", killRecordSchema, "killrecords");
