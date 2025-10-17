//上傳users.json哪些資料置資料庫logins
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


const User = mongoose.model("login", userSchema)

export default User
