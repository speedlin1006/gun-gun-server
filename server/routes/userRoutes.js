import express from "express"
import User from "../models/userModel.js"

const router = express.Router()

// 查詢帳號密碼
router.get("/:account", async (req, res) => {
  try {
    const { account } = req.params
    const user = await User.findOne({ account })
    if (!user) return res.status(404).json({ message: "找不到該帳號" })
    res.json({ password: user.password })
  } catch (err) {
    console.error("❌ 查詢密碼錯誤：", err)
    res.status(500).json({ message: "伺服器錯誤" })
  }
})

export default router
