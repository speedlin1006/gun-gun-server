import express from "express"
import KeepRecord from "../models/keepRecordModel.js"

const router = express.Router()

// ✅ 取得所有冷卻紀錄（最新在前）
router.get("/", async (req, res) => {
  try {
    const records = await KeepRecord.find().sort({ startDate: -1 })
    res.json(records)
  } catch (err) {
    console.error("❌ 取得冷卻紀錄錯誤：", err)
    res.status(500).json({ message: "伺服器錯誤" })
  }
})

// ✅ 新增冷卻紀錄（不記 expire，locked 預設打開）
router.post("/", async (req, res) => {
  try {
    let { player, gunName, quantity, locked } = req.body
    if (!player || !gunName)
      return res.status(400).json({ message: "缺少欄位" })

    quantity = Number(quantity) || 1

    const record = await KeepRecord.create({
      player: player.trim(),
      gunName: gunName.trim(),
      quantity,
      startDate: new Date(),
      active: true,
      locked: typeof locked === "boolean" ? locked : undefined,
      reason: ""
    })

    console.log(`🆕 [新冷卻] ${player} 的 ${gunName} 已建立（locked: ${record.locked}）`)
    res.json({ success: true, record })
  } catch (err) {
    console.error("❌ 建立冷卻紀錄錯誤：", err)
    res.status(500).json({ message: "伺服器錯誤" })
  }
})

// ✅ 管理者／前端解鎖「留一」
router.put("/:id/unlock-keep", async (req, res) => {
  try {
    const { id } = req.params
    const { reason } = req.body
    if (!reason) return res.status(400).json({ message: "請輸入解鎖原因" })

    const record = await KeepRecord.findById(id)
    if (!record) return res.status(404).json({ message: "找不到紀錄" })

    record.locked = false
    record.reason = reason
    record.updatedAt = new Date()
    await record.save()

    console.log(`🔓 [解鎖留一] ${record.player} 的 ${record.gunName}（原因：${reason}）`)
    res.json({ success: true, message: "留一功能已解鎖", record })
  } catch (err) {
    console.error("❌ 解鎖留一錯誤：", err)
    res.status(500).json({ message: "伺服器錯誤" })
  }
})

// ✅ 管理者解除整體冷卻（單筆解除）
router.put("/:id/unlock", async (req, res) => {
  try {
    const { id } = req.params
    const { reason, staff } = req.body

    const record = await KeepRecord.findById(id)
    if (!record) return res.status(404).json({ message: "找不到冷卻紀錄" })

    record.active = false
    record.reason = reason || "管理者手動解除"
    record.unlockBy = staff || "未知管理者"
    record.unlockReason = reason || "無原因"
    record.unlockTime = new Date()
    record.updatedAt = new Date()

    await record.save()

    console.log(`🗝️ [解除單筆冷卻] ${staff || "管理者"} 已解除 ${record.player} 的 ${record.gunName}（原因：${reason || "無原因"}）`)
    res.json({ success: true, message: "已解除冷卻", record })
  } catch (err) {
    console.error("❌ 解除冷卻錯誤：", err)
    res.status(500).json({ message: "伺服器錯誤" })
  }
})

// ✅ 管理者解除某玩家該槍所有冷卻紀錄
router.put("/unlock-by-player", async (req, res) => {
  try {
    const { player, gunName, reason, staff } = req.body
    if (!player) return res.status(400).json({ message: "缺少玩家名稱" })

    const result = await KeepRecord.updateMany(
      { player, gunName, active: true },
      {
        $set: {
          active: false,
          unlockBy: staff || "未知管理者",
          unlockReason: reason || "無原因",
          unlockTime: new Date()
        }
      }
    )

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: "找不到該玩家的有效冷卻紀錄" })
    }

    console.log(`🗝️ [解除冷卻] ${staff || "管理者"} 已解除 ${player} 的 ${gunName}（原因：${reason || "無原因"}）`)
    res.json({ success: true, message: "解除成功" })
  } catch (err) {
    console.error("❌ 解除購買鎖定錯誤：", err)
    res.status(500).json({ message: "伺服器錯誤" })
  }
})

export default router
