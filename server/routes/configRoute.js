import express from "express"
const router = express.Router()

// ✅ 暫時存在伺服器記憶體中（若之後要永久保存再接 MongoDB）
let guildConfig = { level: "" }

// 取得目前版本
router.get("/", (req, res) => {
  res.json(guildConfig)
})

// 設定幫會版本（leader 用）
router.post("/", (req, res) => {
  const { level } = req.body
  if (!level) return res.status(400).json({ message: "缺少版本欄位" })
  guildConfig.level = level
  res.json({ message: "版本已更新", level })
})

export default router
