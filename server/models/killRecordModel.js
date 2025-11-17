import mongoose from "mongoose";

const killRecordSchema = new mongoose.Schema({
  uploader: { type: String, required: true },     // 上傳者名字
  guild: { type: String, required: true },        // 幫會 ID/名稱

  kills: { type: Number, default: 0 },
  mistakes: { type: Number, default: 0 },
  deaths: { type: Number, default: 0 },
  money: { type: Number, default: 0 },

  /* ⭐ 匯款帳號（必須 5 碼純數字） */
  bankAccount: {
    type: String,
    required: true,
    validate: {
      validator: v => /^\d{5}$/.test(v),
      message: "匯款帳號必須是 5 位數字"
    }
  },

  // 擊殺截圖網址
  imageUrl: { type: String, default: "" },

  createdAt: { type: Date, default: Date.now }
});


export default mongoose.model("KillRecord", killRecordSchema, "killrecords");
