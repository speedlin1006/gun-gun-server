import express from "express";
import InjectionRecord from "../models/injectionModel.js";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();
const router = express.Router();

const WEBHOOK = process.env.INJECTION_WEBHOOK;

router.post("/", async (req, res) => {
  try {
    // 取 token 使用者
    const user = req.user; 
    if (!user || !user.name) {
      return res.status(401).json({ success: false, message: "未登入或 token 無效" });
    }

    const { phoneLast5, count } = req.body;
    const name = user.name; // 🔥 領取者 = 登入者名稱

    if (!phoneLast5 || !count) {
      return res.status(400).json({ success: false, message: "缺少必要欄位" });
    }

    /* =============================
       🔥 檢查今日已領取幾支
       每天 00:00 自動刷新
    ============================== */

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // 查今天的紀錄（用 name 查）
    const todayUsed = await InjectionRecord.aggregate([
      { $match: { name, createdAt: { $gte: todayStart } } },
      { $group: { _id: null, total: { $sum: "$count" } } }
    ]);

    const used = todayUsed.length ? todayUsed[0].total : 0;

    if (used + count > 2) {
      return res.status(400).json({
        success: false,
        message: `今日已領取 ${used} 支，最多只能領取 2 支`
      });
    }

    /* =============================
       🔥 進行寫入
    ============================== */

    const amount = count * 300000;

    const record = await InjectionRecord.create({
      name,
      phoneLast5,
      count,
      amount
    });

    /* =============================
       🔥 Discord Webhook
    ============================== */

    if (WEBHOOK) {
      await fetch(WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content:
            `強心針領取通知\n` +
            `領取者：${name}\n` +
            `電話後五碼：${phoneLast5}\n` +
            `領取數量：${count}\n` +
            `今日累積：${used + count} / 2\n` +
            `總金額：${amount.toLocaleString()}`
        })
      });
    }

    return res.json({ success: true, record });

  } catch (err) {
    console.error("injection error:", err);
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

export default router;
