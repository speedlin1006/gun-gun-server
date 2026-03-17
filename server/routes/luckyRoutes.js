import express from "express";
import LuckyTicket from "../models/LuckyTicket.js";
import LuckyStatus from "../models/LuckyStatus.js";
import LuckyWinner from "../models/LuckyWinner.js";

const router = express.Router();

/* ================================
   🎯 規則設定（之後改這裡就好）
================================ */
const TICKET_PRICE = 1000000;    // 100萬一張
const POOL_PER_TICKET = 200000;  // 每張 +10萬
const DRAW_THRESHOLD = 50;       // 50張抽一次

/* ================================
   初始化 LuckyStatus
================================ */
async function getStatus() {
  let status = await LuckyStatus.findOne();
  if (!status) {
    status = await LuckyStatus.create({
      round: 1,
      totalTickets: 0,
      totalAmount: 0,
      drawing: false
    });
  }
  return status;
}

/* ================================
   POST /api/lucky/add
================================ */
router.post("/add", async (req, res) => {
  try {
    const { guild, name, amountWan } = req.body;

    if (!guild || !name || isNaN(amountWan)) {
      return res.status(400).json({ success: false, msg: "資料錯誤" });
    }

    const amount = Number(amountWan) * 10000;
    const ticketsToGive = Math.floor(amount / TICKET_PRICE);

    if (ticketsToGive <= 0) {
      return res.status(400).json({ success: false, msg: "金額不足100萬" });
    }

    /* ============================
       ⭐ 原子更新（避免重號）
    ============================ */
    const status = await LuckyStatus.findOneAndUpdate(
      {},
      {
        $inc: {
          totalTickets: ticketsToGive,
          totalAmount: ticketsToGive * POOL_PER_TICKET
        }
      },
      { new: true, upsert: true }
    );

    const endNumber = status.totalTickets;
    const startNumber = endNumber - ticketsToGive + 1;

    /* ============================
       ⭐ 批次建立票券
    ============================ */
    const ticketsData = [];
    const ticketNumbers = [];

    for (let n = startNumber; n <= endNumber; n++) {
      ticketNumbers.push(n);

      ticketsData.push({
        ticketNumber: n,
        name,
        guild,
        amount,
        round: status.round
      });
    }

    await LuckyTicket.insertMany(ticketsData);

    let winner = null;

    /* ============================
       ⭐ 抽獎鎖（避免重複抽）
    ============================ */
    if (status.totalTickets >= DRAW_THRESHOLD) {

      const lock = await LuckyStatus.findOneAndUpdate(
        {
          drawing: { $ne: true },
          totalTickets: { $gte: DRAW_THRESHOLD }
        },
        { $set: { drawing: true } },
        { new: true }
      );

      if (lock) {
        const currentRound = lock.round;

        const count = await LuckyTicket.countDocuments({ round: currentRound });

        if (count > 0) {
          const randomIndex = Math.floor(Math.random() * count);

          const lucky = await LuckyTicket.findOne({ round: currentRound })
            .skip(randomIndex);

          winner = await LuckyWinner.create({
            round: currentRound,
            ticketNumber: lucky.ticketNumber,
            name: lucky.name,
            guild: lucky.guild,
            totalTicketsAtMoment: lock.totalTickets,
            totalAmountAtMoment: lock.totalAmount
          });

          // 清空當前回合票券
          await LuckyTicket.deleteMany({ round: currentRound });

          // 重置狀態
          await LuckyStatus.updateOne(
            { _id: lock._id },
            {
              $set: {
                totalTickets: 0,
                totalAmount: 0,
                drawing: false
              },
              $inc: { round: 1 }
            }
          );
        }
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


/* ================================
   GET /api/lucky/grouped
   ⭐ 每人每輪擁有的號碼
================================ */
router.get("/grouped", async (req, res) => {
  try {
    const { round } = req.query;

    const match = {};
    if (round) {
      match.round = Number(round);
    }

    const data = await LuckyTicket.aggregate([
      { $match: match },

      {
        $group: {
          _id: {
            name: "$name",
            guild: "$guild",
            round: "$round"
          },
          tickets: { $push: "$ticketNumber" }
        }
      },

      {
        $project: {
          _id: 0,
          name: "$_id.name",
          guild: "$_id.guild",
          round: "$_id.round",
          tickets: 1,
          count: { $size: "$tickets" } // ⭐ 幫你多做一個數量
        }
      },

      {
        $sort: { round: -1, count: -1 } // ⭐ 同輪誰最多排前面
      }
    ]);

    res.json({ success: true, data });

  } catch (err) {
    console.error("Grouped error:", err);
    res.status(500).json({ success: false, msg: "系統錯誤" });
  }
});
export default router;