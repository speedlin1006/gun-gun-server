// importUsers.js
import mongoose from "mongoose"
import dotenv from "dotenv"
import fs from "fs"
import User from "./models/userModel.js"

dotenv.config()

// 1. 連線
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("MongoDB已連線")

    // 2. 讀取
    const data = JSON.parse(fs.readFileSync("./data/users.json", "utf-8"))

    // 3. 一次匯入
    await User.insertMany(data)
    console.log("匯入完成，共新增", data.length, "筆資料")

    mongoose.connection.close()
  })
  .catch(err => console.error("匯入失敗：", err))
