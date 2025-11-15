import mongoose from "mongoose";

const killRecordSchema = new mongoose.Schema({
  uploader: { type: String, required: true },     // 上傳者名字
  guild: { type: String, required: true },        // 幫會 ID/名稱
  kills: { type: Number, default: 0 },
  mistakes: { type: Number, default: 0 },
  deaths: { type: Number, default: 0 },
  money: { type: Number, default: 0 },

  // ⭐ 新增這個欄位（存圖片 URL）
  imageUrl: { type: String, default: "" },

  createdAt: { type: Date, default: Date.now }
});

// 若你想確保 collection 名稱固定為 killrecords
export default mongoose.model("KillRecord", killRecordSchema, "killrecords");
