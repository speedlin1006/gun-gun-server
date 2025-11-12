import express from "express"
import User from "../models/userModel.js"
import mongoose from "mongoose"

const router = express.Router()

/* ------------------ 💾 密碼修改紀錄表 ------------------ */
const passwordLogSchema = new mongoose.Schema({
  name: String,
  oldPassword: String,
  newPassword: String,
  actionTime: { type: Date, default: Date.now }
})
const PasswordLog = mongoose.model("PasswordLog", passwordLogSchema, "password_logs")

/* ------------------ 🟢 使用者自行修改密碼 ------------------ */
router.put("/password", async (req, res) => {
  try {
    const { account, oldPassword, newPassword } = req.body
    if (!account || !oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "請輸入完整資料" })
    }

    const user = await User.findOne({ account })
    if (!user) {
      return res.status(404).json({ success: false, message: "找不到使用者" })
    }

    if (user.password !== oldPassword) {
      return res.status(400).json({ success: false, message: "舊密碼錯誤" })
    }

    // ✅ 紀錄修改前後密碼
    await PasswordLog.create({
      name: user.name,
      oldPassword,
      newPassword
    })

    // ✅ 更新密碼
    user.password = newPassword
    await user.save()

    res.json({ success: true, message: "✅ 密碼修改成功，下次登入請使用新密碼" })
  } catch (err) {
    console.error("❌ 修改密碼錯誤：", err)
    res.status(500).json({ success: false, message: "伺服器錯誤" })
  }
})

/* ------------------ 👑 管理層查詢密碼修改紀錄 ------------------ */
router.get("/password/logs", async (req, res) => {
  try {
    const logs = await PasswordLog.find().sort({ actionTime: -1 })
    res.json(logs)
  } catch (err) {
    console.error("❌ 取得密碼修改紀錄錯誤：", err)
    res.status(500).json({ message: "伺服器錯誤" })
  }
})

export default router
