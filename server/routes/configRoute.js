import express from "express"
import GuildConfig from "../models/configModel.js"

const router = express.Router()

// ✅ 取得目前版本（若無資料則建立一筆預設）
router.get("/", async (req, res) => {
  try {
    let config = await GuildConfig.findOne()
    if (!config) {
      config = await GuildConfig.create({ level: "" })
    }
    res.json(config)
  } catch (err) {
    console.error("❌ 取得幫會版本設定錯誤：", err)
    res.status(500).json({ message: "伺服器錯誤" })
  }
})

// ✅ 設定幫會版本（leader 用）
router.post("/", async (req, res) => {
  try {
    const { level } = req.body
    if (!level) return res.status(400).json({ message: "缺少版本欄位" })

    let config = await GuildConfig.findOne()
    if (!config) {
      config = await GuildConfig.create({ level })
    } else {
      config.level = level
      await config.save()
    }

    res.json({ message: "版本已更新", level: config.level })
  } catch (err) {
    console.error("❌ 更新幫會版本錯誤：", err)
    res.status(500).json({ message: "伺服器錯誤" })
  }
})

export default router
