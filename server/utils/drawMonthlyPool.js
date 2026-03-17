import Pool from "../models/Pool.js";
import PoolResult from "../models/PoolResult.js";

/**
 * 🎰 萬無一失補抽
 * - 可重複呼叫
 * - 同月份只會抽一次
 */
export async function drawMonthlyPoolIfNeeded(monthKey) {
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

  // kills 加權抽獎
  const tickets = [];
  pool.contributors.forEach(c => {
    const k = c.kills || 1;
    for (let i = 0; i < k; i++) tickets.push(c.name);
  });

  const winner = tickets[Math.floor(Math.random() * tickets.length)];

  await PoolResult.create({
    month: monthKey,
    amount: pool.amount,
    winner,
    time: new Date()
  });

  // ⭐ 重置獎池，準備新月份
  pool.amount = 0;
  pool.contributors = [];
  await pool.save();

  console.log(`🎉 ${monthKey} 補抽完成：${winner}`);
}
