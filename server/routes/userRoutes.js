import express from "express"
import User from "../models/userModel.js"

const router = express.Router()

// ✅ 取得所有使用者
router.get("/", async (req, res) => {
  try {
    const users = await User.find().sort({ guild: 1 }) // 幫會順序
    res.json(users)
  } catch (err) {
    console.error("❌ 取得使用者失敗：", err)
    res.status(500).json({ success: false })
  }
})

// ✅ 新增使用者
router.post("/", async (req, res) => {
  try {
    const { account, password, name, guild, role } = req.body
    if (!account || !password || !name || !guild)
      return res.json({ success: false, message: "資料不完整" })

    const exist = await User.findOne({ account })
    if (exist) return res.json({ success: false, message: "帳號已存在" })

    await User.create({ account, password, name, guild, role })
    res.json({ success: true })
  } catch (err) {
    console.error("❌ 新增使用者錯誤：", err)
    res.status(500).json({ success: false })
  }
})

// ✅ 更新使用者（可改名稱、幫會、角色）
router.put("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) return res.json({ success: false, message: "找不到使用者" })

    user.name = req.body.name || user.name
    user.guild = req.body.guild || user.guild
    user.role = req.body.role || user.role // ✅ 加這行！

    await user.save()
    res.json({ success: true })
  } catch (err) {
    console.error("❌ 更新使用者錯誤：", err)
    res.status(500).json({ success: false })
  }
})

// ✅ 刪除使用者
router.delete("/:id", async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id)
    res.json({ success: true })
  } catch (err) {
    console.error("❌ 刪除使用者錯誤：", err)
    res.status(500).json({ success: false })
  }
})

// ✅ 查詢帳號密碼（原本功能保留）
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
