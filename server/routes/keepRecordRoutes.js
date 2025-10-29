import express from "express"
import KeepRecord from "../models/keepRecordModel.js"

const router = express.Router()

// ✅ 取得所有冷卻紀錄
router.get("/", async (req, res) => {
  try {
    const records = await KeepRecord.find().sort({ startDate: -1 })
    res.json(records)
  } catch (err) {
    console.error("❌ 取得冷卻紀錄錯誤：", err)
    res.status(500).json({ message: "伺服器錯誤" })
  }
})

// ✅ 新增或延長冷卻紀錄
router.post("/", async (req, res) => {
  try {
    let { player, gunName, quantity } = req.body
    if (!player || !gunName)
      return res.status(400).json({ message: "缺少欄位" })

    quantity = Number(quantity)
    if (isNaN(quantity) || quantity <= 0)
      return res.status(400).json({ message: "數量格式錯誤" })

    const cooldownPerGun = 7 // 每支槍 7 天
    const now = new Date()
    const addedDays = quantity * cooldownPerGun
    const addedMs = addedDays * 24 * 60 * 60 * 1000

    // ✅ 找出同玩家同槍枝（忽略空白與大小寫）
    const sameRecords = await KeepRecord.find({
      player: { $regex: new RegExp(`^${player.trim()}$`, "i") },
      gunName: { $regex: new RegExp(`^${gunName.trim()}$`, "i") }
    }).sort({ expireDate: -1 })

    let existing = sameRecords.find(r => r.active)
    if (sameRecords.length > 1) {
      // 有多筆 → 只保留最新 active，其餘關閉
      const others = sameRecords.filter(r => r._id.toString() !== (existing?._id?.toString() || ""))
      if (others.length) {
        await KeepRecord.updateMany(
          { _id: { $in: others.map(r => r._id) } },
          { $set: { active: false } }
        )
      }
    }

    // ✅ 若找到現有紀錄且尚未過期 → 延長
    if (existing && new Date(existing.expireDate) > now) {
      const newExpire = new Date(new Date(existing.expireDate).getTime() + addedMs)
      existing.expireDate = newExpire
      await existing.save()

      console.log(
        `🔁 [延長冷卻] ${player} 的 ${gunName} +${addedDays} 天 → 新結束日期：${newExpire.toLocaleDateString("zh-TW")}`
      )

      return res.json({
        success: true,
        action: "extend",
        message: `${gunName} 冷卻延長 ${addedDays} 天（新結束日期：${newExpire.toLocaleDateString("zh-TW")}）`,
        record: existing
      })
    }

    // ✅ 若沒找到 or 已過期 → 新建一筆冷卻
    const startDate = now
    const expireDate = new Date(now.getTime() + addedMs)

    const record = await KeepRecord.create({
      player: player.trim(),
      gunName: gunName.trim(),
      quantity,
      startDate,
      expireDate,
      active: true,
      reason: ""
    })

    console.log(
      `🆕 [新冷卻] ${player} 的 ${gunName} 冷卻 ${addedDays} 天 → ${expireDate.toLocaleDateString("zh-TW")}`
    )

    res.json({ success: true, action: "new", record })
  } catch (err) {
    console.error("❌ 建立冷卻紀錄錯誤：", err)
    res.status(500).json({ message: "伺服器錯誤" })
  }
})

// ✅ 管理者解除冷卻
router.put("/:id/unlock", async (req, res) => {
  try {
    const { id } = req.params
    const { reason } = req.body

    const record = await KeepRecord.findById(id)
    if (!record)
      return res.status(404).json({ message: "找不到冷卻紀錄" })

    record.active = false
    record.reason = reason || "管理者手動解除"
    record.updatedAt = new Date()
    await record.save()

    console.log(`🗝️ [解除冷卻] ${record.player} 的 ${record.gunName} (${record.reason})`)

    res.json({ success: true, message: "已解除冷卻", record })
  } catch (err) {
    console.error("❌ 解除冷卻錯誤：", err)
    res.status(500).json({ message: "伺服器錯誤" })
  }
})

export default router
