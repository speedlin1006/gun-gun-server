import express from "express";
import LuckyTicket from "../models/LuckyTicket.js";
import LuckyStatus from "../models/LuckyStatus.js";
import LuckyWinner from "../models/LuckyWinner.js";

const router = express.Router();

/* ================================
   初始化 LuckyStatus（如果沒有）
================================ */
async function getStatus() {
  let status = await LuckyStatus.findOne();
  if (!status) {
    status = await LuckyStatus.create({
      round: 1,
      totalTickets: 0,
      totalAmount: 0
    });
  }
  return status;
}

/* ================================
   POST /api/lucky/add
   發號碼 + 丟金額 + 自動抽獎
================================ */
router.post("/add", async (req, res) => {
  try {
    const { guild, name, amountWan } = req.body;

    if (!guild || !name || !amountWan) {
      return res.status(400).json({ success: false, msg: "缺少資料" });
    }

    const amount = Number(amountWan) * 10000;   // 轉換成元
    const ticketsToGive = Math.floor(amount / 500000); // 每 50 萬一張票

    let status = await getStatus();

    const startNumber = status.totalTickets + 1;
    const endNumber = status.totalTickets + ticketsToGive;

    let ticketNumbers = [];

    // 建立票券（有幾張就建立幾張）
    for (let n = startNumber; n <= endNumber; n++) {
      ticketNumbers.push(n);

      await LuckyTicket.create({
        ticketNumber: n,
        name,
        guild,
        amount,
        round: status.round
      });
    }

    // 更新累積
    status.totalTickets += ticketsToGive;
    status.totalAmount += amount;
    await status.save();

    let winner = null;

    /* --------------------------
       ⚠ 如果 crossing 100 → 抽獎
    --------------------------- */
    if (status.totalTickets >= 100) {

      const tickets = await LuckyTicket.find({ round: status.round });

      if (tickets.length > 0) {
        const randomIndex = Math.floor(Math.random() * tickets.length);
        const lucky = tickets[randomIndex];

        // 記錄得獎紀錄
        winner = await LuckyWinner.create({
          round: status.round,
          ticketNumber: lucky.ticketNumber,
          name: lucky.name,
          guild: lucky.guild,
          totalTicketsAtMoment: status.totalTickets,
          totalAmountAtMoment: status.totalAmount
        });

        // 清空票券、重置資料
        await LuckyTicket.deleteMany({ round: status.round });

        status.round += 1;
        status.totalTickets = 0;
        status.totalAmount = 0;
        await status.save();
      }
    }

    return res.json({
      success: true,
      tickets: ticketNumbers,
      totalTickets: status.totalTickets,
      round: status.round,
      winner
    });

  } catch (err) {
    console.error("Lucky add error:", err);
    res.status(500).json({ success: false, msg: "系統錯誤" });
  }
});

/* ================================
   GET /api/lucky/get
================================ */
router.get("/get", async (req, res) => {
  const status = await getStatus();
  res.json(status);
});

/* ================================
   GET /api/lucky/winners
================================ */
router.get("/winners", async (req, res) => {
  const winners = await LuckyWinner.find().sort({ round: -1 });
  res.json(winners);
});

export default router;
