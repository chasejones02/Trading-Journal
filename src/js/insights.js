// js/insights.js
// Aggregation and rendering logic for the Insights tab

function isWin(t)  { return (Number(t.pnl) || 0) > 0; }
function isLoss(t) { return (Number(t.pnl) || 0) < 0; }
function isBE(t)   { return (Number(t.pnl) || 0) === 0; }
function pct(wins, total) { if (total <= 0) return null; return (wins / total) * 100; }
function fmtPct(x) { if (x === null || x === undefined) return "—"; return `${x.toFixed(1)}%`; }
function safeText(el, text) { el.textContent = text; }

function tradeLabel(t) {
  const pnlTxt = formatMoney(Number(t.pnl) || 0);
  const when = `${keyToPretty(t.dateKey)} • ${t.time || "—"}`;
  const meta = `${t.ticker || "—"} • ${t.direction || "—"} • ${pnlTxt}`;
  return { when, meta };
}

function renderRows(tableEl, rows) {
  const all = Array.from(tableEl.querySelectorAll(".trow"));
  for (let i = 1; i < all.length; i++) all[i].remove();

  if (rows.length === 0) {
    const empty = document.createElement("div");
    empty.className = "trow";
    empty.innerHTML = `<div style="color:var(--muted);">No data yet</div><div class="badgeMini">—</div>`;
    tableEl.appendChild(empty);
    return;
  }

  for (const r of rows) {
    const row = document.createElement("div");
    row.className = "trow";
    row.innerHTML = `<div>${escapeHtml(r.left)}</div><div class="badgeMini">${escapeHtml(r.right)}</div>`;
    tableEl.appendChild(row);
  }
}

function renderInsights(app) {
  const trades = getAllTrades(app);

  const ids = {
    winPct: ["statWinPct", "statWinPctSub"],
    total: ["statTotalTrades", "statTotalTradesSub"],
    bestDay: ["statBestDay", "statBestDaySub"],
    worstDay: ["statWorstDay", "statWorstDaySub"],
    bestTrade: ["statBestTrade", "statBestTradeSub"],
    worstTrade: ["statWorstTrade", "statWorstTradeSub"],
    bestConf: ["statBestConf", "statBestConfSub"],
    worstConf: ["statWorstConf", "statWorstConfSub"],
    bestSetup: ["statBestSetup", "statBestSetupSub"],
    bestTime: ["statBestTime", "statBestTimeSub"],
    longWin: ["statLongWin", "statLongWinSub"],
    shortWin: ["statShortWin", "statShortWinSub"],
  };

  const g = id => document.getElementById(id);

  if (trades.length === 0) {
    safeText(g("statWinPct"), "—");
    safeText(g("statWinPctSub"), "Add trades to see stats.");
    safeText(g("statTotalTrades"), "0");
    safeText(g("statTotalTradesSub"), "Wins: 0 • Losses: 0 • BE: 0");
    for (const [, [v, s]] of Object.entries(ids).slice(2)) {
      safeText(g(v), "—"); safeText(g(s), "—");
    }
    renderRows(g("confTable"), []);
    renderRows(g("setupTable"), []);
    renderRows(g("timeTable"), []);
    return;
  }

  const wins   = trades.filter(isWin).length;
  const losses = trades.filter(isLoss).length;
  const bes    = trades.filter(isBE).length;
  const total  = trades.length;

  safeText(g("statWinPct"), fmtPct(pct(wins, total)));
  safeText(g("statWinPctSub"), `Wins: ${wins} • Losses: ${losses} • BE: ${bes}`);
  safeText(g("statTotalTrades"), String(total));

  const netPnl = trades.reduce((s, t) => s + (Number(t.pnl) || 0), 0);
  const avgPnl = netPnl / (total || 1);
  safeText(g("statTotalTradesSub"), `Net: ${formatMoney(netPnl)} • Avg/trade: ${formatMoney(avgPnl)}`);

  // Best/worst individual trade
  const bestTrade  = trades.reduce((b, t) => (b == null || (Number(t.pnl) || 0) > (Number(b.pnl) || 0)) ? t : b, null);
  const worstTrade = trades.reduce((w, t) => (w == null || (Number(t.pnl) || 0) < (Number(w.pnl) || 0)) ? t : w, null);

  if (bestTrade) {
    const lbl = tradeLabel(bestTrade);
    safeText(g("statBestTrade"), formatMoney(Number(bestTrade.pnl) || 0));
    safeText(g("statBestTradeSub"), `${lbl.when}\n${lbl.meta}`);
  }
  if (worstTrade) {
    const lbl = tradeLabel(worstTrade);
    safeText(g("statWorstTrade"), formatMoney(Number(worstTrade.pnl) || 0));
    safeText(g("statWorstTradeSub"), `${lbl.when}\n${lbl.meta}`);
  }

  // Best/worst day
  const dayMap = new Map();
  for (const t of trades) {
    const k = t.dateKey;
    if (!dayMap.has(k)) dayMap.set(k, { pnl: 0, count: 0 });
    const obj = dayMap.get(k);
    obj.pnl += (Number(t.pnl) || 0);
    obj.count += 1;
  }

  let bestDayKey = null, bestDayVal = -Infinity;
  let worstDayKey = null, worstDayVal = Infinity;
  for (const [k, v] of dayMap.entries()) {
    if (v.pnl > bestDayVal)  { bestDayVal = v.pnl;  bestDayKey = k; }
    if (v.pnl < worstDayVal) { worstDayVal = v.pnl; worstDayKey = k; }
  }

  if (bestDayKey) {
    safeText(g("statBestDay"), formatMoney(bestDayVal));
    safeText(g("statBestDaySub"), `${keyToPretty(bestDayKey)}\nTrades: ${dayMap.get(bestDayKey).count}`);
  }
  if (worstDayKey) {
    safeText(g("statWorstDay"), formatMoney(worstDayVal));
    safeText(g("statWorstDaySub"), `${keyToPretty(worstDayKey)}\nTrades: ${dayMap.get(worstDayKey).count}`);
  }

  // Long/short win rate
  const longTrades  = trades.filter(t => (t.direction || "").toLowerCase() === "long");
  const shortTrades = trades.filter(t => (t.direction || "").toLowerCase() === "short");
  safeText(g("statLongWin"),  longTrades.length  ? fmtPct(pct(longTrades.filter(isWin).length, longTrades.length))   : "—");
  safeText(g("statLongWinSub"),  `Wins: ${longTrades.filter(isWin).length}/${longTrades.length || 0}`);
  safeText(g("statShortWin"), shortTrades.length ? fmtPct(pct(shortTrades.filter(isWin).length, shortTrades.length)) : "—");
  safeText(g("statShortWinSub"), `Wins: ${shortTrades.filter(isWin).length}/${shortTrades.length || 0}`);

  // Confluence win rate
  const confMap = new Map();
  for (const t of trades) {
    for (const c of (Array.isArray(t.confluences) ? t.confluences : [])) {
      const key = String(c);
      if (!confMap.has(key)) confMap.set(key, { used: 0, wins: 0 });
      const obj = confMap.get(key);
      obj.used += 1;
      if (isWin(t)) obj.wins += 1;
    }
  }

  const confStats = Array.from(confMap.entries())
    .map(([conf, v]) => ({ conf, used: v.used, wins: v.wins, winPct: pct(v.wins, v.used) ?? 0 }))
    .sort((a, b) => (b.winPct - a.winPct) || (b.used - a.used));

  renderRows(g("confTable"), confStats.map(x => ({ left: `${x.conf}  (n=${x.used})`, right: fmtPct(x.winPct) })));

  const bestConfObj  = confStats[0] || null;
  const worstConfObj = [...confStats].sort((a, b) => (a.winPct - b.winPct) || (b.used - a.used))[0] || null;

  if (bestConfObj)  { safeText(g("statBestConf"),  fmtPct(bestConfObj.winPct));  safeText(g("statBestConfSub"),  `${bestConfObj.conf}\nWins: ${bestConfObj.wins}/${bestConfObj.used}`); }
  else              { safeText(g("statBestConf"),  "—"); safeText(g("statBestConfSub"),  "—"); }
  if (worstConfObj) { safeText(g("statWorstConf"), fmtPct(worstConfObj.winPct)); safeText(g("statWorstConfSub"), `${worstConfObj.conf}\nWins: ${worstConfObj.wins}/${worstConfObj.used}`); }
  else              { safeText(g("statWorstConf"), "—"); safeText(g("statWorstConfSub"), "—"); }

  // Setup (confluence combination) win rate
  const setupMap = new Map();
  for (const t of trades) {
    const k = normalizeSetupKey(t.confluences);
    if (!k) continue;
    if (!setupMap.has(k)) setupMap.set(k, { used: 0, wins: 0 });
    const obj = setupMap.get(k);
    obj.used += 1;
    if (isWin(t)) obj.wins += 1;
  }

  const setupStats = Array.from(setupMap.entries())
    .map(([setup, v]) => ({ setup, used: v.used, wins: v.wins, winPct: pct(v.wins, v.used) ?? 0 }))
    .sort((a, b) => (b.winPct - a.winPct) || (b.used - a.used));

  const bestSetupObj = setupStats[0] || null;
  if (bestSetupObj) {
    safeText(g("statBestSetup"), fmtPct(bestSetupObj.winPct));
    safeText(g("statBestSetupSub"), `n=${bestSetupObj.used} • Wins: ${bestSetupObj.wins}/${bestSetupObj.used}\n${bestSetupObj.setup}`);
  } else {
    safeText(g("statBestSetup"), "—");
    safeText(g("statBestSetupSub"), "No setups yet (need confluences).");
  }

  renderRows(g("setupTable"), setupStats.slice(0, 12).map(x => ({ left: `${x.setup}  (n=${x.used})`, right: fmtPct(x.winPct) })));

  // Best time of day
  const timeMap = new Map();
  for (const t of trades) {
    const parsed = parseTimeToHourBucket(t.time || "");
    if (!parsed) continue;
    if (!timeMap.has(parsed.hour24)) timeMap.set(parsed.hour24, { used: 0, wins: 0, label: parsed.label });
    const obj = timeMap.get(parsed.hour24);
    obj.used += 1;
    if (isWin(t)) obj.wins += 1;
  }

  const timeStats = Array.from(timeMap.entries())
    .map(([hour24, v]) => ({ hour24, label: v.label, used: v.used, wins: v.wins, winPct: pct(v.wins, v.used) ?? 0 }))
    .sort((a, b) => (b.winPct - a.winPct) || (b.used - a.used));

  const bestTimeObj = timeStats[0] || null;
  if (bestTimeObj) {
    safeText(g("statBestTime"), fmtPct(bestTimeObj.winPct));
    safeText(g("statBestTimeSub"), `${bestTimeObj.label}\nWins: ${bestTimeObj.wins}/${bestTimeObj.used}`);
  } else {
    safeText(g("statBestTime"), "—");
    safeText(g("statBestTimeSub"), "Add times to trades to compute this.");
  }

  renderRows(g("timeTable"), timeStats.map(x => ({ left: `${x.label}  (n=${x.used})`, right: fmtPct(x.winPct) })));
}
