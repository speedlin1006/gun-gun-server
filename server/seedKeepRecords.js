import mongoose from "mongoose"
import dotenv from "dotenv"
import KeepRecord from "./models/keepRecordModel.js"

dotenv.config()
await mongoose.connect(process.env.MONGODB_URI)

await KeepRecord.create({
  player: "阿峰",
  gunName: "戰鬥自衛衝鋒槍",
  expireDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
  active: true
})

console.log("✅ 測試資料建立成功")
mongoose.connection.close()
