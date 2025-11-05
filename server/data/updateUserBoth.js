import fs from "fs"
import mongoose from "mongoose"
import dotenv from "dotenv"
import Login from "../models/loginModel.js" 


dotenv.config({ path: "../.env" })

console.log("👉 MONGODB_URI:", process.env.MONGODB_URI)

//執行碼
//cd server/data
//node updateUserBoth.js

// ==================== 資料庫重點 
// 原名稱
const OLD_NAME = "問號的巨蟹"
//要改的樣子 建議不改的也打上來 真的不知道可以找user.json或是不打
const NEW_DATA =   
  {
    "account": "C168505859",
    "password": "DokiDoki~5819",
    "name": "問號的巨蟹",
    "guild": "13",
    "role": "member"
  }
// ===================

// === 更新本地 JSON（只改指定欄位） ===
const filePath = "./users.json"
const data = JSON.parse(fs.readFileSync(filePath, "utf8"))
const index = data.findIndex(user => user.name === OLD_NAME)

if (index !== -1) {
  Object.assign(data[index], NEW_DATA)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8")
  console.log("✅ 本地 JSON 已更新（部分欄位）")
} else {
  console.log("⚠️ 本地 JSON 找不到該使用者")
}

// === 更新 MongoDB ===
try {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log("✅ 已連線 MongoDB")

  const result = await Login.updateOne({ name: OLD_NAME }, { $set: NEW_DATA })

  if (result.modifiedCount > 0) {
    console.log("✅ MongoDB 資料已更新（部分欄位）")
  } else {
    console.log("⚠️ MongoDB 找不到該使用者")
  }
} catch (err) {
  console.error("❌ MongoDB 更新失敗：", err)
} finally {
  await mongoose.connection.close()
  console.log("✅ 作業完成，已關閉連線")
}
