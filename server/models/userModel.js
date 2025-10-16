// server/models/userModel.js
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
  }
})

// 模型名稱叫 "User"，會對應資料庫的 "users" 集合
const User = mongoose.model("login", userSchema)

export default User
