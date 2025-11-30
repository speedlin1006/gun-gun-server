import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import { User } from "../server.js";
import KillRecord from "../models/killRecordModel.js";
import Pool from "../models/Pool.js";

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
   🔍 名稱清理
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

const isSamePlayer = (a, b) => cleanName(a) === cleanName(b);

/* ===============================
   🔍 抓模式（括號最後）
================================ */
function extractMode(line) {
  const match = line.match(/\((.*?)\)\s*$/);
  return match ? match[1].trim() : "";
}

/* ===============================
   🔍 擷取 (#123) → name
================================ */
function parseKillRow(row) {
  const matches = [...row.matchAll(/(.+?)\(#\d+\)/g)];
  if (matches.length < 2) return null;

  return {
    attacker: cleanName(matches[0][1]),
    victim: cleanName(matches[1][1])
  };
}

const ALLOWED_MODES = ["搶旗", "槍戰", "警匪", "PK"];

/* ===============================
   🧠 analyze API
================================ */
router.post("/analyze", async (req, res) => {
  try {
    const { imageUrl, uploaderName, bankAccount, guildNameText } = req.body;

    if (!imageUrl || !uploaderName || !bankAccount)
      return res.status(400).json({ error: "缺少必要參數" });

    if (!/^\d{5}$/.test(bankAccount))
      return res.status(400).json({ error: "匯款帳號需為 5 位數字" });

    /* 找玩家 */
    const uploader = await User.findOne({ name: uploaderName });
    if (!uploader) return res.status(400).json({ error: "找不到成員" });

    /* 下載圖片 */
    const downloadUrl = imageUrl.replace(".webp", ".png");
    const imgRes = await fetch(downloadUrl);
    if (!imgRes.ok) return res.status(400).json({ error: "無法下載圖片" });

    const base64Image = Buffer.from(await imgRes.arrayBuffer()).toString("base64");

    /* OCR */
    const [ocrResult] = await client.textDetection({
      image: { content: base64Image }
    });

    const raw = ocrResult.fullTextAnnotation?.text || "";
    console.log("🔍 OCR RAW:\n", raw);

    const lines = raw.split("\n").map(l => l.trim()).filter(l => l);

    /* ===============================
       🔒 檢查 OCR 是否含玩家名稱 + 幫會名稱
    ================================ */
    const mergedOCR = raw.replace(/\s+/g, ""); // 去掉所有空白
    
    const cleanUploader = cleanName(uploaderName);
    const cleanGuild = cleanName(guildNameText || "");

    if (!mergedOCR.includes(cleanUploader)) {
      return res.status(400).json({
        error: "截圖中未找到玩家名稱，請確認是否截到自己的擊殺紀錄。"
      });
    }

    if (cleanGuild && !mergedOCR.includes(cleanGuild)) {
      return res.status(400).json({
        error: "截圖中未找到幫會名稱，請確認是否截到正確畫面。"
      });
    }

    /* ===============================
      🔎 日期確認（修正兩位數日期）
    ================================ */
    const dateLines = lines.filter(l => /\d{4}\/\d{1,2}\/\d{1,2}/.test(l));

    if (dateLines.length === 0)
      return res.status(400).json({ error: "截圖缺少日期" });

    // 產生兩位數日期：2025/12/01
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const todayTW = `${yyyy}/${mm}/${dd}`; 

    // 比對 OCR 中是否包含今日
    if (!dateLines.some(l => l.includes(todayTW)))
      return res.status(400).json({ error: "截圖不是今日紀錄" });


    /* ===============================
       🔫 擊殺行
    ================================ */
    const killLines = lines.filter(l => {
      const hasHash = /#\d+/.test(l);
      const hasUse = l.includes("使用");
      const hasKill = /(擊殺|杀)/.test(l);
      const hasMode = /\(.*?\)\s*$/.test(l);
      return hasHash && hasUse && hasKill && hasMode;
    });

    console.log("🔍 killLines:", killLines);

    let kills = 0, deaths = 0, mistakes = 0;
    let recordMode = "";

    const allUsers = await User.find({}, "name");

    for (let row of killLines) {
      row = row.replace(/\s+/g, " ").trim();

      const mode = extractMode(row);
      if (!ALLOWED_MODES.some(m => mode.includes(m))) continue;

      if (!recordMode) recordMode = mode;

      const parsed = parseKillRow(row);
      if (!parsed) continue;

      const { attacker, victim } = parsed;

      const isSelfAttacker = isSamePlayer(attacker, cleanUploader);
      const isVictimInDB = allUsers.some(u => isSamePlayer(u.name, victim));

      if (isSelfAttacker) {
        if (isVictimInDB) mistakes++;
        else kills++;
        continue;
      }

      deaths++;
    }

    /* ===============================
       💰 計算金額
    ================================ */
    const totalMoney =
      kills * 100000 +
      deaths * 50000 +
      0;

    /* ===============================
       🏆 當月獎池更新
    ================================ */
    const now2 = new Date();
    const monthKey =
      `${now2.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    let pool = await Pool.findOne({ month: monthKey });
    if (!pool) {
      pool = await Pool.create({
        month: monthKey,
        amount: 0,
        contributors: []
      });
    }

    pool.amount += kills * 20000;
    if (!pool.contributors.includes(uploaderName))
      pool.contributors.push(uploaderName);
    await pool.save();

    /* ===============================
       🗃 寫入 DB
    ================================ */
    await KillRecord.create({
      uploader: uploaderName,
      guild: uploader.guild,
      kills,
      deaths,
      mistakes,
      money: totalMoney,
      mode: recordMode,
      bankAccount,
      imageUrl
    });

    /* ===============================
       📢 Discord Webhook
    ================================ */
    try {
      if (process.env.DISCORD_KILL_WEBHOOK) {
        await fetch(process.env.DISCORD_KILL_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `🔫 **擊殺結算**
玩家：${uploaderName}
幫會：${uploader.guild}

擊殺：${kills}
死亡：${deaths}
誤殺：${mistakes}

💰 金額：${totalMoney} 元
📨 匯款帳號：${bankAccount}`
          })
        });
      }
    } catch (err) {
      console.error("❌ Webhook 傳送失敗", err);
    }

    /* ===============================
       📤 回傳前端
    ================================ */
    return res.json({
      success: true,
      ocrRaw: raw,
      uploader: uploaderName,
      guild: uploader.guild,
      kills,
      deaths,
      mistakes,
      money: totalMoney,
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
