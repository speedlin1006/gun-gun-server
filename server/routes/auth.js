// routes/auth.js
import express from "express"
const router = express.Router()

// 這裡只做最簡單的密碼比對（同步版）
// 建議：把 ADMIN_PASSWORD 放在後端的 .env 裡
router.post("/check", (req, res) => {
  try {
    const { password } = req.body || {}
    if (!password) return res.status(400).json({ success: false, message: "缺少密碼" })

    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "fallback_admin_password"

    if (password === ADMIN_PASSWORD) {
      return res.json({ success: true })
    } else {
      return res.json({ success: false, message: "密碼錯誤" })
    }
  } catch (err) {
    console.error("Auth check error:", err)
    return res.status(500).json({ success: false, message: "伺服器錯誤" })
  }
})

export default router
