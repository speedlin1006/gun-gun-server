import mongoose from "mongoose"

const loginLocationSchema = new mongoose.Schema({
  account: String,
  latitude: Number,
  longitude: Number,
  name: String,
  recordTime: { type: Date, default: Date.now }
})

export default mongoose.model("LoginLocation", loginLocationSchema)
