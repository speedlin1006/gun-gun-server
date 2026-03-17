import express from "express";
import Pool from "../models/Pool.js";
import PoolResult from "../models/PoolResult.js";

const router = express.Router();

/* ================================
   🎰 萬無一失：補抽函式（全系統共用）
   - 只抽「還沒抽過」的月份
   - kills 加權
================================ */
async function drawMonthlyPoolIfNeeded(monthKey) {
  const exists = await PoolResult.findOne({ month: monthKey });
  if (exists) {
    console.log(`⏭️ ${monthKey} 已抽過，跳過`);
    return;
  }

  const pool = await Pool.findOne({ month: monthKey });
  if (!pool || pool.contributors.length === 0) {
    console.log(`❌ ${monthKey} 無獎池或無貢獻者`);
    return;
  }

  // 🎟️ kills 加權
  const tickets = [];
  pool.contributors.forEach(c => {
    const k = c.kills || 1;
    for (let i = 0; i < k; i++) tickets.push(c.name);
  });

  const winner = tickets[Math.floor(Math.random() * tickets.length)];

  await PoolResult.create({
    month: monthKey,
    amount: pool.amount,
    winner,              // ✅ 一定是字串
    time: new Date()
  });

  // 重置獎池
  pool.amount = 0;
  pool.contributors = [];
  await pool.save();

  console.log(`🎉 ${monthKey} 補抽完成：${winner}`);
}

/* ======================================================
   📌 取得本月獎池資訊
   GET /api/pool/status
====================================================== */
router.get("/status", async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) {
      return res.json({ success: false, error: "缺少月份" });
    }

    const pool = await Pool.findOne({ month });

    if (!pool) {
      return res.json({
        success: true,
        amount: 0,
        contributors: []
      });
    }

    // 確保 contributors 格式正確
    let updated = false;
    const contributors = pool.contributors.map(c => {
      if (typeof c === "string") {
        updated = true;
        return { name: c, kills: 0 };
      }
      return c;
    });

    if (updated) {
      pool.contributors = contributors;
      await pool.save();
      console.log(`🔧 修復 contributors 格式（${month}）`);
    }

    res.json({
      success: true,
      amount: pool.amount,
      contributors
    });
  } catch (err) {
    console.error("獎池查詢錯誤:", err);
    res.status(500).json({ success: false, error: "伺服器錯誤" });
  }
});

/* ======================================================
   🎰 手動抽獎（立刻抽）
   GET /api/pool/draw?month=YYYY-MM
   - 不看 cron
   - 直接抽
====================================================== */
router.get("/draw", async (req, res) => {
  try {
    const monthKey =
      req.query.month ||
      (() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(
          now.getMonth() + 1
        ).padStart(2, "0")}`;
      })();

    const pool = await Pool.findOne({ month: monthKey });

    if (!pool) {
      return res.json({ error: `${monthKey} 尚無獎池資料` });
    }

    if (pool.contributors.length === 0) {
      return res.json({ error: `${monthKey} 沒有貢獻者` });
    }

    // ⭐ 關鍵修正：只取 name
    const picked =
      pool.contributors[
        Math.floor(Math.random() * pool.contributors.length)
      ];
    const winner = picked.name;
    const drawTime = new Date().toLocaleString("zh-TW");

    await PoolResult.findOneAndUpdate(
      { month: monthKey },
      {
        month: monthKey,
        winner,          // ✅ 一定是字串
        amount: pool.amount,
        time: drawTime
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: `${monthKey} 抽獎完成`,
      winner,
      amount: pool.amount,
      time: drawTime
    });
  } catch (err) {
    res.status(500).json({
      error: "抽獎發生錯誤",
      detail: err.message
    });
  }
});

/* ======================================================
   📜 抽獎歷史
   GET /api/pool/history
====================================================== */
router.get("/history", async (req, res) => {
  try {
    const results = await PoolResult.find().sort({ createdAt: -1 });
    res.json({ success: true, history: results });
  } catch (err) {
    res.status(500).json({ error: "無法取得歷史資料" });
  }
});

/* ======================================================
   🏆 查詢某月中獎者
   GET /api/pool/winner?month=YYYY-MM
====================================================== */
router.get("/winner", async (req, res) => {
  try {
    const monthKey =
      req.query.month ||
      (() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(
          now.getMonth() + 1
        ).padStart(2, "0")}`;
      })();

    const result = await PoolResult.findOne({ month: monthKey });

    if (!result) {
      return res.json({
        success: true,
        winner: "",
        time: "",
        message: "此月份尚未抽獎"
      });
    }

    res.json({
      success: true,
      winner: result.winner,
      time: result.time
    });
  } catch (err) {
    res.status(500).json({ error: "無法取得中獎者資料" });
  }
});

export default router;
