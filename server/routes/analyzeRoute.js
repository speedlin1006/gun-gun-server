import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import { User } from "../server.js";
import KillRecord from "../models/killRecordModel.js";
import Pool from "../models/Pool.js";   // ⭐ 新增：獎池模型

dotenv.config();

const router = express.Router();

/* ===============================
    🔑 Google Vision 初始化
================================ */
const client = new ImageAnnotatorClient({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY
  },
  projectId: "sharp-effort-353719"
});

/* ===============================
    🔍 移除搶旗亂碼
================================ */
function trimModeTag(text) {
  return text.replace(
    /[\(\[\{〈【『「][^)\]\}〉】』」]{0,20}搶旗生存戰[^)\]\}〉】』」]{0,20}[\)\]\}〉】』」]?/g,
    ""
  );
}

/* ===============================
    🔍 名稱乾淨化
================================ */
function cleanName(name) {
  if (!name) return "";
  return name
    .replace(/（.*?）/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/#\d+/g, "")
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "")
    .trim();
}

function isSamePlayer(a, b) {
  return cleanName(a) === cleanName(b);
}

/* ===============================
    🔫 武器名單
================================ */
const GUN_LIST = [
  "手槍","戰鬥手槍","重型手槍","小型衝鋒槍","削短型霰彈槍",
  "衝鋒槍","突擊步槍","卡賓步槍","射手步槍","雙管霰彈霰彈槍",
  "重型左輪手槍","突擊衝鋒槍","高階步槍","狙擊槍","煙火發射器",
  "0.5口徑手槍","戰鬥自衛衝鋒槍","衝鋒手槍","射手手槍","泵動式霰彈槍",
  "迷你衝鋒槍","古森柏衝鋒槍","衝鋒霰彈槍","射手步槍MKII","重型狙擊槍",
  "戰鬥機關槍MKII","戰鬥機關槍MkII","戰鬥機關槍Mkii","戰鬥機關槍MKIl","戰鬥機關槍MkIl",
  "特製卡賓步槍", "穿甲手槍"
];

/* ===============================
    🧹 全形轉半形 + 日期修正
================================ */
function toHalfWidth(str) {
  return str.replace(/[\uff01-\uff5e]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  ).replace(/\u3000/g, " ");
}

function normalizeDateString(str) {
  if (!str) return "";
  str = toHalfWidth(str);
  str = str.replace(/[^0-9\/: ]/g, "");
  str = str.replace(/\/+/g, "/");
  return str.trim();
}

/* ===============================
    🧠 analyze API
================================ */
router.post("/analyze", async (req, res) => {
  try {
    const { imageUrl, uploaderName, bankAccount } = req.body;

    if (!imageUrl || !uploaderName || !bankAccount) {
      return res.status(400).json({ error: "缺少必要參數" });
    }

    if (!/^\d{5}$/.test(bankAccount)) {
      return res.status(400).json({ error: "匯款帳號需為 5 位數字" });
    }

    /* 找玩家 */
    const uploader = await User.findOne({ name: uploaderName });
    if (!uploader) {
      return res.status(400).json({ error: "找不到成員" });
    }

    /* 下載圖片 */
    const downloadUrl = imageUrl.replace(".webp", ".png");
    const imgRes = await fetch(downloadUrl);
    if (!imgRes.ok) {
      return res.status(400).json({ error: "無法下載圖片" });
    }

    const base64Image = Buffer.from(await imgRes.arrayBuffer()).toString("base64");

    /* OCR */
    const [ocrResult] = await client.textDetection({
      image: { content: base64Image }
    });

    const raw = ocrResult.fullTextAnnotation?.text || "";
    const lines = raw.split("\n");

    /* ===== 日期確認 ===== */
    const dateLines = lines
      .map(normalizeDateString)
      .filter(l => /\d{4}\/\d{1,2}\/\d{1,2}/.test(l));

    if (dateLines.length === 0) {
      return res.status(400).json({ error: "截圖缺少日期" });
    }

    const todayTW = new Date().toLocaleDateString("zh-TW", {
      timeZone: "Asia/Taipei"
    });

    if (!dateLines.some(l => l.includes(todayTW))) {
      return res.status(400).json({ error: "截圖不是今日紀錄" });
    }

    /* ===== 擊殺分析 ===== */
    const allUsers = await User.find({}, "name");

    const killLines = raw.split("\n").filter(l =>
      l.includes("使用") &&
      (l.includes("擊") || l.includes("杀") || l.includes("㑆") || l.includes("㓥") || l.includes("㯜"))
    );

    let kills = 0, deaths = 0, mistakes = 0;
    const cleanUploader = cleanName(uploaderName);

    for (let line of killLines) {
      let row = trimModeTag(line.replace(/\s/g, ""));
      const gunHit = GUN_LIST.find(g => row.includes(g));
      if (!gunHit) continue;

      const killIndex = Math.max(
        row.indexOf("擊殺"), row.indexOf("杀"), row.indexOf("㑆"),
        row.indexOf("㓥"), row.indexOf("㯜")
      );

      const useIndex = row.indexOf("使用");
      if (useIndex === -1 || killIndex === -1) continue;

      const attacker = cleanName(row.substring(0, useIndex));
      const victim = cleanName(row.substring(killIndex + 2));

      const atk = isSamePlayer(attacker, cleanUploader);
      const vic = isSamePlayer(victim, cleanUploader);

      if (!atk && !vic) continue;

      const friendly = allUsers.some(u => isSamePlayer(u.name, victim));

      if (atk) {
        if (friendly) mistakes++;
        else kills++;
      }

      if (vic) deaths++;
    }

    /* 💰 金額 */
    const PRICE_KILL = 100000;
    const totalMoney = kills * PRICE_KILL;
    const moneyText = totalMoney >= 10000 ? `${totalMoney / 10000}W` : `${totalMoney}`;

    /* ======================================================
       🎁 累積獎池：每 kill +50,000，並記錄貢獻者
    ====================================================== */
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    let pool = await Pool.findOne({ month: monthKey });

    if (!pool) {
      pool = await Pool.create({
        month: monthKey,
        amount: 0,
        contributors: []
      });
    }

    const POOL_ADD_PER_KILL = 50000;
    pool.amount += kills * POOL_ADD_PER_KILL;

    if (!pool.contributors.includes(uploaderName)) {
      pool.contributors.push(uploaderName);
    }

    await pool.save();  // ⭐ 寫入資料庫

    /* 🗃 寫入擊殺紀錄 */
    const record = await KillRecord.create({
      uploader: uploaderName,
      guild: uploader.guild,
      kills,
      deaths,
      mistakes,
      money: totalMoney,
      bankAccount,
      imageUrl
    });

    /* 📢 Discord Webhook */
    try {
      const webhookUrl = process.env.DISCORD_KILL_WEBHOOK;

      const dcPayload = {
        username: "Killshot Bot",
        embeds: [
          {
            title: "💸 玩家擊殺結算通知",
            color: 0x00d1ff,
            fields: [
              { name: "👤 玩家", value: uploaderName, inline: true },
              { name: "💰 本次獎勵", value: moneyText, inline: true },
              { name: "🏦 匯款帳號（5碼）", value: bankAccount, inline: true }
            ],
            timestamp: new Date()
          }
        ]
      };

      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dcPayload)
      });
    } catch (err) {
      console.error("❌ Discord Webhook 發送錯誤：", err);
    }

    return res.json({
      success: true,
      savedId: record._id,
      uploader: uploaderName,
      guild: uploader.guild,
      kills,
      deaths,
      mistakes,
      money: totalMoney,
      moneyText,
      bankAccount
    });

  } catch (err) {
    console.error("❌ analyze API 錯誤：", err);
    return res.status(500).json({
      error: "系統分析失敗",
      detail: err.message
    });
  }
});

export default router;
