import mongoose from "mongoose"

const userSchema = new mongoose.Schema({
  account: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  guild: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ["leader", "officer", "member"], // 只允許這三種
    default: "member",                     // 沒有給就預設為 member
    required: true
  }
})

const User = mongoose.model("login", userSchema)

export default User
