import mongoose from "mongoose"

const loginLocationSchema = new mongoose.Schema({
  name: String,
  latitude: Number,
  longitude: Number,
  recordTime: { type: Date, default: Date.now }
})

export default mongoose.model("LoginLocation", loginLocationSchema)
