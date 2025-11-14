import mongoose from "mongoose";

const killRecordSchema = new mongoose.Schema({
  uploader: { type: String, required: true },     // 上傳者名字
  guild: { type: String, required: true },        // 幫會 ID/名稱
  kills: { type: Number, default: 0 },
  mistakes: { type: Number, default: 0 },
  deaths: { type: Number, default: 0 },
  money: { type: Number, default: 0 },            // 例如 10（前端顯示時加 W）
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("KillRecord", killRecordSchema, "killrecords");
