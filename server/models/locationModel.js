import mongoose from "mongoose"

const locationSchema = new mongoose.Schema({
  account: { type: String, required: true },
  name: { type: String },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
})

export default mongoose.model("Location", locationSchema)
