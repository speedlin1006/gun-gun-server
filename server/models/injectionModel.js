import mongoose from "mongoose";

const injectionSchema = new mongoose.Schema({
  name: { type: String, required: true },       // 新增
  phoneLast5: { type: String, required: true },
  count: { type: Number, required: true },
  amount: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("InjectionRecord", injectionSchema);
