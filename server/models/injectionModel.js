import mongoose from "mongoose";

const injectionSchema = new mongoose.Schema({
  name: { type: String, required: true },        // 領取者
  phoneLast5: { type: String, required: true },  // 電話後五碼
  count: { type: Number, required: true },       // 領取數量
  amount: { type: Number, required: true },      // 金額

  // 📌 新增：強心針截圖圖片網址（Cloudinary）
  imageUrl: { type: String, required: false },

  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("InjectionRecord", injectionSchema);
