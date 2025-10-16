// importUsers.js
import mongoose from "mongoose"
import dotenv from "dotenv"
import fs from "fs"
import User from "./models/userModel.js" // 你的使用者模型

dotenv.config()

// 1. 連線資料庫
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("✅ 成功連線 MongoDB")

    // 2. 讀取 JSON 檔案
    const data = JSON.parse(fs.readFileSync("./data/users.json", "utf-8"))

    // 3. 一次匯入所有資料
    await User.insertMany(data)
    console.log("🎉 匯入完成，共新增", data.length, "筆資料")

    mongoose.connection.close()
  })
  .catch(err => console.error("❌ 匯入失敗：", err))
