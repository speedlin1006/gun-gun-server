import mongoose from "mongoose";

const gunSchema = new mongoose.Schema({
  guildName: { type: String, required: true },   // 幫會名稱
  memberName: { type: String, required: true },  // 借用人員名稱
  gunName: { type: String, required: true },     // 槍枝名稱
  status: { type: String, enum: ["borrowed", "returned"], default: "borrowed" },
  borrowTime: { type: Date, default: () => new Date() },
  returnTime: { type: Date, default: null },
}, { timestamps: true });

// 明確指定 collection 為 "gun"（跟你 Compass 裡看到的一致）
export default mongoose.model("Gun", gunSchema, "gun");
