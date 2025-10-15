import express from "express"
import mongoose from "mongoose"
import cors from "cors"
import dotenv from "dotenv"
import Gun from "./models/gunModel.js"

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// 中介層
app.use(cors())
app.use(express.json())

//  連線資料庫
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ 成功連線至 MongoDB Atlas"))
  .catch((err) => console.error("❌ MongoDB 連線失敗：", err))

// 取得所有紀錄
app.get("/api/guns", async (req, res) => {
  try {
    const guns = await Gun.find().sort({ borrowTime: -1 })
    res.json(guns)
  } catch (err) {
    res.status(500).json({ error: "無法取得資料" })
  }
})

// 借出槍枝（新增一筆）
app.post("/api/borrow", async (req, res) => {
  try {
    const { guildName, memberName, gunName } = req.body
    if (!guildName || !memberName || !gunName) {
      return res.status(400).json({ error: "缺少必要欄位" })
    }

    const newRecord = await Gun.create({
      guildName,
      memberName,
      gunName,
      status: "borrowed",
      borrowTime: new Date(),
    })

    res.json(newRecord)
  } catch (err) {
    console.error("❌ 借槍失敗：", err)
    res.status(500).json({ error: "借槍失敗" })
  }
})

// 歸還槍枝（更新現有紀錄）
app.post("/api/return/:id", async (req, res) => {
  try {
    const record = await Gun.findById(req.params.id)
    if (!record) return res.status(404).json({ error: "找不到紀錄" })

    record.status = "returned"
    record.returnTime = new Date()
    await record.save()

    res.json(record)
  } catch (err) {
    console.error("❌ 歸還失敗：", err)
    res.status(500).json({ error: "歸還失敗" })
  }
})

// 🚀 啟動伺服器
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`))
