import express from "express"
import Location from "../models/locationModel.js"

const router = express.Router()

// ✅ 新增登入位置紀錄
router.post("/", async (req, res) => {
  try {
    const { account, name, latitude, longitude } = req.body
    if (!account || !latitude || !longitude)
      return res.status(400).json({ message: "缺少欄位" })

    const record = await Location.create({
      account,
      name,
      latitude,
      longitude,
      createdAt: new Date()
    })
    res.json({ success: true, record })
  } catch (err) {
    console.error("❌ 新增位置紀錄錯誤：", err)
    res.status(500).json({ message: "伺服器錯誤" })
  }
})

// ✅ 取得所有登入紀錄（選擇性）
router.get("/", async (req, res) => {
  try {
    const records = await Location.find().sort({ createdAt: -1 })
    res.json(records)
  } catch (err) {
    console.error("❌ 取得登入位置紀錄錯誤：", err)
    res.status(500).json({ message: "伺服器錯誤" })
  }
})

export default router
