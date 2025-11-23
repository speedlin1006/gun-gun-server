// routes/locationRoutes.js
import express from "express";
import fetch from "node-fetch";

const router = express.Router();

/* ======================================================
   ⭐ 白名單（account / 純名字 都可判斷）
====================================================== */
const skipGPSList = [
  "阿極",
  "ajie",
  "阿峰",
  "afeng",
  "純測試帳號 不要刪",
  "不曾想不曾想"
];

/* ======================================================
   📌 工具：清理遊戲名稱
   例如：休閒小築｜阿極 → 阿極
====================================================== */
function cleanName(rawName) {
  if (!rawName) return "";
  return rawName.replace(/^.*\｜/, "").trim();
}

/* ======================================================
   📍 判斷是否需要定位
====================================================== */
router.post("/shouldLocate", (req, res) => {
  const { account, name } = req.body;

  if (!account && !name) {
    return res.status(400).json({ message: "缺少 account 或 name" });
  }

  const clean = cleanName(name);

  const isWhiteList =
    skipGPSList.includes(account) || skipGPSList.includes(clean);

  return res.json({ needLocate: !isWhiteList });
});



/* ======================================================
   🛰 紀錄定位 + 推送 Discord Webhook（美化版 Embed）
====================================================== */
router.post("/", async (req, res) => {
  try {
    const { account, name, latitude, longitude } = req.body;

    if (!account && !name) {
      return res.status(400).json({ message: "缺少 account 或 name" });
    }

    const webhook = process.env.DISCORD_WEBHOOK_GPS;

    if (!webhook) {
      console.warn("⚠ DISCORD_WEBHOOK_GPS 未設定");
    } else {
      const isLocated = latitude && longitude;
      const timestamp = new Date().toISOString();

      // === 準備 embed ===
      const embed = {
        title: isLocated ? "📍 定位成功" : "⚠ 使用者拒絕定位",
        color: isLocated ? 0x3b82f6 : 0xef4444, // 藍 / 紅
        fields: [
          { name: "👤 使用者名稱", value: name, inline: true },
          { name: "🆔 帳號", value: account, inline: true }
        ],
        timestamp
      };

      if (isLocated) {
        embed.fields.push(
          { name: "🌏 緯度", value: String(latitude), inline: true },
          { name: "🌍 經度", value: String(longitude), inline: true },
          {
            name: "🗺 Google Maps",
            value: `[點我查看](https://www.google.com/maps?q=${latitude},${longitude})`,
            inline: false
          }
        );
      } else {
        embed.fields.push({
          name: "📌 詳細說明",
          value: "使用者拒絕了定位權限。",
          inline: false
        });
      }

      // === 發送到 Discord ===
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [embed] })
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("定位 API 錯誤：", err);
    return res.status(500).json({ message: "伺服器錯誤" });
  }
});


export default router;
