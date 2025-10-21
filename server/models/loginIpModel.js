import mongoose from "mongoose"

const loginIpSchema = new mongoose.Schema({
  account: String,
  ip: String,
  loginTime: { type: Date, default: Date.now }
})

export default mongoose.model("LoginIp", loginIpSchema)
