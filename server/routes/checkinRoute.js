import express from "express";
import CheckinRecord from "../models/checkinModel.js";
import fetch from "node-fetch";
import mongoose from "mongoose";

const router = express.Router();
const CHECKIN_WEBHOOK = process.env.CHECKIN_WEBHOOK;

/* -----------------------------------
    取得當月天數
----------------------------------- */
function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/* -----------------------------------
    發送 Discord（僅達成 90% 時）
----------------------------------- */
async function sendDiscordCompleted({ name, month, checked, total }) {
  if (!CHECKIN_WEBHOOK) return;

  const body = {
    content:
      `🎉【本月簽到達成】🎉\n\n` +
      `👤 成員：${name}\n` +
      `📆 月份：${month}\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `✔ 累積天數：${checked} / ${total} 天\n` +
      `✔ 完成度：${Math.round((checked / total) * 100)}%\n` +
      `✔ 達成條件：≥ 90%\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `📣 請管理員發放本月獎勵`
  };

  await fetch(CHECKIN_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

/* -----------------------------------
    ① 今日簽到
----------------------------------- */
router.post("/today", async (req, res) => {
  try {
    const user = req.user;
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = String(today.getDate()).padStart(2, "0");

    const yearMonth = `${year}-${String(month).padStart(2, "0")}`;
    const todayString = `${yearMonth}-${day}`;
    const totalDays = getDaysInMonth(year, month);

    let record = await CheckinRecord.findOne({
      account: user.account,
      yearMonth
    });

    if (!record) {
      record = await CheckinRecord.create({
        account: user.account,
        name: user.name,
        yearMonth,
        totalDays,
        checkedDays: 0,
        dates: [],
        completed: false,
        rewardSent: false
      });
    }

    if (record.dates.includes(todayString)) {
      return res.json({
        success: false,
        message: "今日已簽到"
      });
    }

    record.dates.push(todayString);
    record.checkedDays = record.dates.length;

    const progress = record.checkedDays / record.totalDays;

    if (progress >= 0.9 && !record.rewardSent) {
      record.completed = true;
      record.rewardSent = true;

      await sendDiscordCompleted({
        name: user.name,
        month: yearMonth,
        checked: record.checkedDays,
        total: record.totalDays
      });
    }

    await record.save();

    res.json({
      success: true,
      message: "簽到成功",
      record
    });
  } catch (err) {
    console.error("checkin error:", err);
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

/* -----------------------------------
    ② 個人本月簽到狀態
----------------------------------- */
router.get("/me", async (req, res) => {
  try {
    const user = req.user;

    const today = new Date();
    const yearMonth = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}`;

    const record = await CheckinRecord.findOne({
      account: user.account,
      yearMonth
    });

    res.json({
      success: true,
      record
    });
  } catch (err) {
    console.error("checkin /me error:", err);
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

/* -----------------------------------
    ③ 管理者：顯示所有成員當月狀態（未簽到也顯示）
----------------------------------- */
router.get("/all", async (req, res) => {
  try {
    const month = req.query.month;

    if (!month) {
      return res.status(400).json({
        success: false,
        message: "請提供月份 (格式：YYYY-MM)"
      });
    }

    // ⭐ 取得所有 User
    const User = mongoose.model("User");
    const users = await User.find({}, "account name guild role");

    // ⭐ 該月的所有簽到紀錄
    const records = await CheckinRecord.find({ yearMonth: month });

    // map 方便查詢
    const recordMap = {};
    records.forEach((r) => {
      recordMap[r.account] = r;
    });

    // ⭐ 計算該月天數
    const [y, m] = month.split("-");
    const totalDays = new Date(Number(y), Number(m), 0).getDate();

    // ⭐ 每位成員都回傳完整資訊
    const list = users.map((u) => {
      const rec = recordMap[u.account];

      return {
        _id: u._id,
        account: u.account,
        name: u.name,
        guild: u.guild,
        role: u.role,

        // 有紀錄才帶入，沒有就顯示 0
        checkedDays: rec ? rec.checkedDays : 0,
        totalDays: totalDays,
        dates: rec ? rec.dates : []
      };
    });

    // ⭐ 依階級排序
    const rank = { leader: 1, officer: 2, member: 3 };
    list.sort((a, b) => {
      const diff = rank[a.role] - rank[b.role];
      return diff !== 0 ? diff : Number(a.guild) - Number(b.guild);
    });

    res.json({
      success: true,
      list
    });

  } catch (err) {
    console.error("checkin /all error:", err);
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});


/* -----------------------------------
    ④ 個人本月簽到狀態（前端 calendar 用）
----------------------------------- */
router.get("/month", async (req, res) => {
  try {
    const user = req.user;

    const today = new Date();
    const yearMonth = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}`;

    const record = await CheckinRecord.findOne({
      account: user.account,
      yearMonth
    });

    res.json({
      success: true,
      record
    });
  } catch (err) {
    console.error("checkin /month error:", err);
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

export default router;
