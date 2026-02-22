// js/insights.js
// Aggregation and rendering logic for the Insights section

function isWin(t)  { return (Number(t.pnl) || 0) > 0; }
function isLoss(t) { return (Number(t.pnl) || 0) < 0; }
function isBE(t)   { return (Number(t.pnl) || 0) === 0; }
function pct(wins, total) { if (total <= 0) return null; return (wins / total) * 100; }
function fmtPct(x) { if (x === null || x === undefined) return "—"; return `${x.toFixed(1)}%`; }
function safeText(el, text) { if (el) el.textContent = text; }

function tradeLabel(t) {
  const pnlTxt = formatMoney(Number(t.pnl) || 0);
  const when   = `${keyToPretty(t.dateKey)} • ${t.time || "—"}`;
  const meta   = `${t.ticker || "—"} • ${t.direction || "—"} • ${pnlTxt}`;
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

/* ── Helpers ───────────────────────────────────────────── */
function sortedByDate(trades) {
  return [...trades].sort((a, b) => {
    const d = a.dateKey.localeCompare(b.dateKey);
    return d !== 0 ? d : (a.createdAt || 0) - (b.createdAt || 0);
  });
}

function computeStreaks(trades) {
  const sorted = sortedByDate(trades);
  let maxWin = 0, maxLoss = 0, curWin = 0, curLoss = 0;
  for (const t of sorted) {
    if (isWin(t))       { curWin++; curLoss = 0; maxWin  = Math.max(maxWin, curWin); }
    else if (isLoss(t)) { curLoss++; curWin = 0; maxLoss = Math.max(maxLoss, curLoss); }
    else                { curWin = 0; curLoss = 0; }
  }
  let currentStreak = 0, currentType = null;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const t = sorted[i];
    if (currentType === null) {
      if (isWin(t))       { currentType = "W"; currentStreak = 1; }
      else if (isLoss(t)) { currentType = "L"; currentStreak = 1; }
      else                { break; }
    } else if (currentType === "W" && isWin(t))   { currentStreak++; }
    else if (currentType === "L" && isLoss(t))     { currentStreak++; }
    else                                           { break; }
  }
  return { maxWin, maxLoss, currentStreak, currentType };
}

function computeDrawdown(trades) {
  const sorted = sortedByDate(trades);
  let peak = 0, maxDD = 0, running = 0;
  for (const t of sorted) {
    running += Number(t.pnl) || 0;
    if (running > peak) peak = running;
    maxDD = Math.max(maxDD, peak - running);
  }
  return { maxDD, currentDD: Math.max(0, peak - running), peak };
}

/* ── Equity curve (SVG) ────────────────────────────────── */
function renderEquityCurve(trades) {
  const el = document.getElementById("equityCurveWrap");
  if (!el) return;
  if (!trades.length) {
    el.innerHTML = `<div class="warn" style="padding:24px 0 8px;">Add trades to see your equity curve.</div>`;
    return;
  }
  const sorted = sortedByDate(trades);
  const pts = [0];
  let running = 0;
  for (const t of sorted) { running += Number(t.pnl) || 0; pts.push(running); }

  const W = 900, H = 160, PX = 6, PY = 12;
  const iW = W - PX * 2, iH = H - PY * 2;
  const minY = Math.min(0, ...pts), maxY = Math.max(0, ...pts);
  const range = maxY - minY || 1;
  const toX = i => PX + (i / Math.max(pts.length - 1, 1)) * iW;
  const toY = v => PY + (1 - (v - minY) / range) * iH;
  const zY  = toY(0);

  const isPos   = running >= 0;
  const col     = isPos ? "#34d399" : "#fb7185";
  const gStop   = isPos ? "rgba(52,211,153,0.28)" : "rgba(251,113,133,0.28)";
  const ptStr   = pts.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
  const areaStr = `${toX(0).toFixed(1)},${zY.toFixed(1)} ${ptStr} ${toX(pts.length - 1).toFixed(1)},${zY.toFixed(1)}`;
  const peakVal = Math.max(...pts);
  const peakIdx = pts.indexOf(peakVal);

  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none" style="display:block;">
      <defs>
        <linearGradient id="ecGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${gStop}"/>
          <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
        </linearGradient>
      </defs>
      <line x1="${PX}" y1="${zY.toFixed(1)}" x2="${W - PX}" y2="${zY.toFixed(1)}"
            stroke="rgba(255,255,255,0.09)" stroke-width="1" stroke-dasharray="4,4"/>
      <polygon points="${areaStr}" fill="url(#ecGrad)"/>
      <polyline points="${ptStr}" fill="none" stroke="${col}" stroke-width="2"
                stroke-linejoin="round" stroke-linecap="round"/>
      ${peakVal > 0
        ? `<circle cx="${toX(peakIdx).toFixed(1)}" cy="${toY(peakVal).toFixed(1)}"
               r="3" fill="rgba(255,255,255,0.40)" stroke="${col}" stroke-width="1.5"/>`
        : ""}
      <circle cx="${toX(pts.length - 1).toFixed(1)}" cy="${toY(running).toFixed(1)}"
              r="4.5" fill="${col}" opacity="0.9"/>
    </svg>
    <div class="equityMeta">
      <span>${sorted.length} trade${sorted.length !== 1 ? "s" : ""}</span>
      <span>Peak: ${formatMoney(Math.max(0, ...pts))}</span>
      <span style="font-weight:700;color:${col};">Net: ${formatMoney(running)}</span>
    </div>`;
}

/* ── Day of week ───────────────────────────────────────── */
function renderDow(trades) {
  const el = document.getElementById("dowBars");
  if (!el) return;
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const map  = {};
  DAYS.forEach(d => map[d] = { pnl: 0, wins: 0, total: 0 });
  for (const t of trades) {
    if (!t.dateKey) continue;
    const [y, m, d] = t.dateKey.split("-").map(Number);
    const name = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(y, m - 1, d).getDay()];
    map[name].pnl   += Number(t.pnl) || 0;
    map[name].total += 1;
    if (isWin(t)) map[name].wins += 1;
  }
  const active = DAYS.filter(d => map[d].total > 0);
  if (!active.length) { el.innerHTML = `<div class="warn">No trades yet.</div>`; return; }
  const maxAbs = Math.max(...active.map(d => Math.abs(map[d].pnl)), 1);
  el.innerHTML = active.map(day => {
    const { pnl, wins, total } = map[day];
    const wp  = total ? Math.round((wins / total) * 100) : 0;
    const bw  = Math.round((Math.abs(pnl) / maxAbs) * 100);
    const pos = pnl >= 0;
    const col = pos ? "#34d399" : "#fb7185";
    const bg  = pos ? "rgba(52,211,153,0.28)" : "rgba(251,113,133,0.28)";
    return `<div class="dowRow">
      <div class="dowDay">${day}</div>
      <div class="dowBarWrap">
        <div style="width:${bw}%;background:${bg};height:100%;border-radius:3px;"></div>
      </div>
      <div class="dowPnl" style="color:${col}">${formatMoney(pnl)}</div>
      <div class="dowWin">${wp}% · ${total}T</div>
    </div>`;
  }).join("");
}

/* ── Ticker breakdown ──────────────────────────────────── */
function renderTickerBreakdown(trades) {
  const tableEl = document.getElementById("tickerTable");
  if (!tableEl) return;
  const existing = Array.from(tableEl.querySelectorAll(".trow"));
  for (let i = 1; i < existing.length; i++) existing[i].remove();
  const map = {};
  for (const t of trades) {
    const tk = t.ticker || "—";
    if (!map[tk]) map[tk] = { pnl: 0, wins: 0, total: 0 };
    map[tk].pnl   += Number(t.pnl) || 0;
    map[tk].total += 1;
    if (isWin(t)) map[tk].wins += 1;
  }
  const entries = Object.entries(map)
    .map(([tk, v]) => ({ tk, ...v, wp: v.total ? (v.wins / v.total) * 100 : 0 }))
    .sort((a, b) => b.pnl - a.pnl);
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "trow";
    empty.style.gridTemplateColumns = "1fr 80px 100px";
    empty.innerHTML = `<div style="color:var(--muted)">No data</div><div class="badgeMini">—</div><div class="badgeMini">—</div>`;
    tableEl.appendChild(empty);
    return;
  }
  for (const r of entries) {
    const row = document.createElement("div");
    row.className = "trow";
    row.style.gridTemplateColumns = "1fr 80px 100px";
    const pnlCol = r.pnl >= 0 ? "var(--pos-text)" : "var(--neg-text)";
    row.innerHTML = `<div>${escapeHtml(r.tk)}</div>
      <div class="badgeMini">${fmtPct(r.wp)}</div>
      <div class="badgeMini" style="color:${pnlCol}">${escapeHtml(formatMoney(r.pnl))}</div>`;
    tableEl.appendChild(row);
  }
}

/* ── PnL distribution ──────────────────────────────────── */
function renderPnlDist(trades) {
  const el = document.getElementById("pnlDistWrap");
  if (!el) return;
  if (!trades.length) { el.innerHTML = `<div class="warn">No trades yet.</div>`; return; }
  const BUCKETS = [
    { label: "< −$500",     min: -Infinity, max: -500 },
    { label: "−$500–−$200", min: -500,      max: -200 },
    { label: "−$200–−$50",  min: -200,      max: -50  },
    { label: "−$50–$0",     min: -50,       max: 0    },
    { label: "$0–$50",      min: 0,         max: 50   },
    { label: "$50–$200",    min: 50,        max: 200  },
    { label: "$200–$500",   min: 200,       max: 500  },
    { label: "> $500",      min: 500,       max: Infinity },
  ];
  const counts = BUCKETS.map(b => ({
    ...b,
    n: trades.filter(t => { const p = Number(t.pnl) || 0; return p >= b.min && p < b.max; }).length,
  }));
  const maxN = Math.max(...counts.map(b => b.n), 1);
  el.innerHTML = `<div class="pnlDistBars">${counts.map(b => {
    const h   = b.n > 0 ? Math.max(Math.round((b.n / maxN) * 100), 4) : 0;
    const pos = b.min >= 0;
    const neg = b.max <= 0;
    const col = pos ? "rgba(52,211,153,0.65)" : neg ? "rgba(251,113,133,0.65)" : "rgba(251,191,36,0.50)";
    return `<div class="distCol">
      <div class="distCount">${b.n > 0 ? b.n : ""}</div>
      <div class="distBar" style="height:${h}px;background:${col};"></div>
      <div class="distLabel">${escapeHtml(b.label)}</div>
    </div>`;
  }).join("")}</div>`;
}

/* ── Main render ───────────────────────────────────────── */
function renderInsights(app) {
  const trades = getAllTrades(app);
  const g      = id => document.getElementById(id);

  const newStatIds = [
    ["statProfitFactor",  "statProfitFactorSub"],
    ["statExpectancy",    "statExpectancySub"],
    ["statAvgWin",        "statAvgWinSub"],
    ["statAvgLoss",       "statAvgLossSub"],
    ["statWinLossRatio",  "statWinLossRatioSub"],
    ["statMaxWinStreak",  "statMaxWinStreakSub"],
    ["statMaxLossStreak", "statMaxLossStreakSub"],
    ["statCurrentStreak", "statCurrentStreakSub"],
    ["statMaxDrawdown",   "statMaxDrawdownSub"],
  ];

  if (trades.length === 0) {
    safeText(g("statWinPct"),          "—");
    safeText(g("statWinPctSub"),       "Add trades to see stats.");
    safeText(g("statTotalTrades"),     "0");
    safeText(g("statTotalTradesSub"),  "Wins: 0 • Losses: 0 • BE: 0");
    const legacyIds = ["statBestDay","statBestDaySub","statWorstDay","statWorstDaySub",
      "statBestTrade","statBestTradeSub","statWorstTrade","statWorstTradeSub",
      "statBestConf","statBestConfSub","statWorstConf","statWorstConfSub",
      "statBestSetup","statBestSetupSub","statBestTime","statBestTimeSub",
      "statLongWin","statLongWinSub","statShortWin","statShortWinSub"];
    legacyIds.forEach(id => safeText(g(id), id.endsWith("Sub") ? "—" : "—"));
    newStatIds.forEach(([v, s]) => { safeText(g(v), "—"); safeText(g(s), "—"); });
    renderRows(g("confTable"),  []);
    renderRows(g("setupTable"), []);
    renderRows(g("timeTable"),  []);
    renderEquityCurve([]);
    renderDow([]);
    renderTickerBreakdown([]);
    renderPnlDist([]);
    return;
  }

  /* ── Core counts ─────────────────────────────────────── */
  const wins   = trades.filter(isWin).length;
  const losses = trades.filter(isLoss).length;
  const bes    = trades.filter(isBE).length;
  const total  = trades.length;
  const netPnl = trades.reduce((s, t) => s + (Number(t.pnl) || 0), 0);

  safeText(g("statWinPct"),         fmtPct(pct(wins, total)));
  safeText(g("statWinPctSub"),      `Wins: ${wins} • Losses: ${losses} • BE: ${bes}`);
  safeText(g("statTotalTrades"),    String(total));
  safeText(g("statTotalTradesSub"), `Net: ${formatMoney(netPnl)} • Avg/trade: ${formatMoney(netPnl / total)}`);

  /* ── Best / worst individual trade ───────────────────── */
  const bestTrade  = trades.reduce((b, t) => (!b || (Number(t.pnl)||0) > (Number(b.pnl)||0)) ? t : b, null);
  const worstTrade = trades.reduce((w, t) => (!w || (Number(t.pnl)||0) < (Number(w.pnl)||0)) ? t : w, null);
  if (bestTrade)  { const l = tradeLabel(bestTrade);  safeText(g("statBestTrade"),  formatMoney(Number(bestTrade.pnl)||0));  safeText(g("statBestTradeSub"),  `${l.when}\n${l.meta}`); }
  if (worstTrade) { const l = tradeLabel(worstTrade); safeText(g("statWorstTrade"), formatMoney(Number(worstTrade.pnl)||0)); safeText(g("statWorstTradeSub"), `${l.when}\n${l.meta}`); }

  /* ── Best / worst day ────────────────────────────────── */
  const dayMap = new Map();
  for (const t of trades) {
    const k = t.dateKey;
    if (!dayMap.has(k)) dayMap.set(k, { pnl: 0, count: 0 });
    dayMap.get(k).pnl   += Number(t.pnl) || 0;
    dayMap.get(k).count += 1;
  }
  let bestDayKey = null, bestDayVal = -Infinity, worstDayKey = null, worstDayVal = Infinity;
  for (const [k, v] of dayMap) {
    if (v.pnl > bestDayVal)  { bestDayVal  = v.pnl; bestDayKey  = k; }
    if (v.pnl < worstDayVal) { worstDayVal = v.pnl; worstDayKey = k; }
  }
  if (bestDayKey)  { safeText(g("statBestDay"),  formatMoney(bestDayVal));  safeText(g("statBestDaySub"),  `${keyToPretty(bestDayKey)}\nTrades: ${dayMap.get(bestDayKey).count}`);  }
  if (worstDayKey) { safeText(g("statWorstDay"), formatMoney(worstDayVal)); safeText(g("statWorstDaySub"), `${keyToPretty(worstDayKey)}\nTrades: ${dayMap.get(worstDayKey).count}`); }

  /* ── Long / short win rate ───────────────────────────── */
  const longT  = trades.filter(t => (t.direction || "").toLowerCase() === "long");
  const shortT = trades.filter(t => (t.direction || "").toLowerCase() === "short");
  safeText(g("statLongWin"),     longT.length  ? fmtPct(pct(longT.filter(isWin).length,  longT.length))  : "—");
  safeText(g("statLongWinSub"),  `Wins: ${longT.filter(isWin).length}/${longT.length}`);
  safeText(g("statShortWin"),    shortT.length ? fmtPct(pct(shortT.filter(isWin).length, shortT.length)) : "—");
  safeText(g("statShortWinSub"), `Wins: ${shortT.filter(isWin).length}/${shortT.length}`);

  /* ── Confluence win rate ─────────────────────────────── */
  const confMap = new Map();
  for (const t of trades) {
    for (const c of (Array.isArray(t.confluences) ? t.confluences : [])) {
      const key = String(c);
      if (!confMap.has(key)) confMap.set(key, { used: 0, wins: 0 });
      confMap.get(key).used += 1;
      if (isWin(t)) confMap.get(key).wins += 1;
    }
  }
  const confStats = Array.from(confMap.entries())
    .map(([conf, v]) => ({ conf, used: v.used, wins: v.wins, winPct: pct(v.wins, v.used) ?? 0 }))
    .sort((a, b) => (b.winPct - a.winPct) || (b.used - a.used));
  renderRows(g("confTable"), confStats.map(x => ({ left: `${x.conf}  (n=${x.used})`, right: fmtPct(x.winPct) })));
  const bestC  = confStats[0] || null;
  const worstC = [...confStats].sort((a, b) => (a.winPct - b.winPct) || (b.used - a.used))[0] || null;
  if (bestC)  { safeText(g("statBestConf"),  fmtPct(bestC.winPct));  safeText(g("statBestConfSub"),  `${bestC.conf}\nWins: ${bestC.wins}/${bestC.used}`);  }
  else        { safeText(g("statBestConf"),  "—"); safeText(g("statBestConfSub"),  "—"); }
  if (worstC) { safeText(g("statWorstConf"), fmtPct(worstC.winPct)); safeText(g("statWorstConfSub"), `${worstC.conf}\nWins: ${worstC.wins}/${worstC.used}`); }
  else        { safeText(g("statWorstConf"), "—"); safeText(g("statWorstConfSub"), "—"); }

  /* ── Setup win rate ──────────────────────────────────── */
  const setupMap = new Map();
  for (const t of trades) {
    const k = normalizeSetupKey(t.confluences);
    if (!k) continue;
    if (!setupMap.has(k)) setupMap.set(k, { used: 0, wins: 0 });
    setupMap.get(k).used += 1;
    if (isWin(t)) setupMap.get(k).wins += 1;
  }
  const setupStats = Array.from(setupMap.entries())
    .map(([setup, v]) => ({ setup, used: v.used, wins: v.wins, winPct: pct(v.wins, v.used) ?? 0 }))
    .sort((a, b) => (b.winPct - a.winPct) || (b.used - a.used));
  const bestS = setupStats[0] || null;
  if (bestS) { safeText(g("statBestSetup"), fmtPct(bestS.winPct)); safeText(g("statBestSetupSub"), `n=${bestS.used} • Wins: ${bestS.wins}/${bestS.used}\n${bestS.setup}`); }
  else       { safeText(g("statBestSetup"), "—"); safeText(g("statBestSetupSub"), "No setups yet (need confluences)."); }
  renderRows(g("setupTable"), setupStats.slice(0, 12).map(x => ({ left: `${x.setup}  (n=${x.used})`, right: fmtPct(x.winPct) })));

  /* ── Best time of day ────────────────────────────────── */
  const timeMap = new Map();
  for (const t of trades) {
    const parsed = parseTimeToHourBucket(t.time || "");
    if (!parsed) continue;
    if (!timeMap.has(parsed.hour24)) timeMap.set(parsed.hour24, { used: 0, wins: 0, label: parsed.label });
    timeMap.get(parsed.hour24).used += 1;
    if (isWin(t)) timeMap.get(parsed.hour24).wins += 1;
  }
  const timeStats = Array.from(timeMap.entries())
    .map(([h, v]) => ({ hour24: h, label: v.label, used: v.used, wins: v.wins, winPct: pct(v.wins, v.used) ?? 0 }))
    .sort((a, b) => (b.winPct - a.winPct) || (b.used - a.used));
  const bestT = timeStats[0] || null;
  if (bestT) { safeText(g("statBestTime"), fmtPct(bestT.winPct)); safeText(g("statBestTimeSub"), `${bestT.label}\nWins: ${bestT.wins}/${bestT.used}`); }
  else       { safeText(g("statBestTime"), "—"); safeText(g("statBestTimeSub"), "Add times to trades to compute this."); }
  renderRows(g("timeTable"), timeStats.map(x => ({ left: `${x.label}  (n=${x.used})`, right: fmtPct(x.winPct) })));

  /* ── Premium stats ───────────────────────────────────── */
  const grossWinAmt  = trades.filter(isWin).reduce((s, t) => s + (Number(t.pnl) || 0), 0);
  const grossLossAmt = Math.abs(trades.filter(isLoss).reduce((s, t) => s + (Number(t.pnl) || 0), 0));
  const pf           = grossLossAmt > 0 ? grossWinAmt / grossLossAmt : null;
  const avgWinAmt    = wins   > 0 ? grossWinAmt  / wins   : null;
  const avgLossAmt   = losses > 0 ? grossLossAmt / losses : null;
  const wlRatio      = avgWinAmt !== null && avgLossAmt ? avgWinAmt / avgLossAmt : null;
  const expectancy   = netPnl / total;

  // Profit factor
  const pfEl = g("statProfitFactor");
  if (pf !== null) {
    safeText(pfEl, pf.toFixed(2));
    pfEl.style.color = pf >= 1 ? "var(--pos-text)" : "var(--neg-text)";
    safeText(g("statProfitFactorSub"), `Gross wins: ${formatMoney(grossWinAmt)} / losses: ${formatMoney(grossLossAmt)}`);
  } else if (losses === 0 && wins > 0) {
    safeText(pfEl, "∞"); pfEl.style.color = "var(--pos-text)";
    safeText(g("statProfitFactorSub"), "No losing trades yet");
  } else {
    safeText(pfEl, "—"); pfEl.style.color = "";
    safeText(g("statProfitFactorSub"), "—");
  }

  // Expectancy
  const expEl = g("statExpectancy");
  safeText(expEl, formatMoney(expectancy));
  expEl.style.color = expectancy >= 0 ? "var(--pos-text)" : "var(--neg-text)";
  safeText(g("statExpectancySub"), "Avg $ earned per trade");

  // Avg win
  const awEl = g("statAvgWin");
  if (avgWinAmt !== null) {
    safeText(awEl, formatMoney(avgWinAmt)); awEl.style.color = "var(--pos-text)";
    safeText(g("statAvgWinSub"), `From ${wins} winning trade${wins !== 1 ? "s" : ""}`);
  } else {
    safeText(awEl, "—"); awEl.style.color = "";
    safeText(g("statAvgWinSub"), "No wins yet");
  }

  // Avg loss
  const alEl = g("statAvgLoss");
  if (avgLossAmt !== null) {
    safeText(alEl, formatMoney(-avgLossAmt)); alEl.style.color = "var(--neg-text)";
    safeText(g("statAvgLossSub"), `From ${losses} losing trade${losses !== 1 ? "s" : ""}`);
  } else {
    safeText(alEl, "—"); alEl.style.color = "";
    safeText(g("statAvgLossSub"), "No losses yet");
  }

  // Win:Loss ratio
  const wlEl = g("statWinLossRatio");
  if (wlRatio !== null) {
    safeText(wlEl, `${wlRatio.toFixed(2)}:1`);
    wlEl.style.color = wlRatio >= 1 ? "var(--pos-text)" : "var(--neg-text)";
    safeText(g("statWinLossRatioSub"), `${formatMoney(avgWinAmt)} avg win vs ${formatMoney(-avgLossAmt)} avg loss`);
  } else {
    safeText(wlEl, "—"); wlEl.style.color = "";
    safeText(g("statWinLossRatioSub"), "Need both wins and losses");
  }

  // Streaks
  const { maxWin: mxW, maxLoss: mxL, currentStreak: curS, currentType: curT } = computeStreaks(trades);
  const mwEl = g("statMaxWinStreak");
  safeText(mwEl, String(mxW)); mwEl.style.color = mxW > 0 ? "var(--pos-text)" : "";
  safeText(g("statMaxWinStreakSub"), mxW > 0 ? `${mxW} consecutive win${mxW !== 1 ? "s" : ""}` : "No win streaks yet");

  const mlEl = g("statMaxLossStreak");
  safeText(mlEl, String(mxL)); mlEl.style.color = mxL > 0 ? "var(--neg-text)" : "";
  safeText(g("statMaxLossStreakSub"), mxL > 0 ? `${mxL} consecutive loss${mxL !== 1 ? "es" : ""}` : "No loss streaks yet");

  const csEl = g("statCurrentStreak");
  if (curT === "W") {
    safeText(csEl, String(curS)); csEl.style.color = "var(--pos-text)";
    safeText(g("statCurrentStreakSub"), `${curS} win${curS !== 1 ? "s" : ""} in a row`);
  } else if (curT === "L") {
    safeText(csEl, String(curS)); csEl.style.color = "var(--neg-text)";
    safeText(g("statCurrentStreakSub"), `${curS} loss${curS !== 1 ? "es" : ""} in a row`);
  } else {
    safeText(csEl, "—"); csEl.style.color = "";
    safeText(g("statCurrentStreakSub"), "Last trade was breakeven");
  }

  // Max drawdown
  const { maxDD, currentDD } = computeDrawdown(trades);
  const ddEl = g("statMaxDrawdown");
  safeText(ddEl, maxDD > 0 ? formatMoney(-maxDD) : "$0.00");
  ddEl.style.color = maxDD > 0 ? "var(--neg-text)" : "var(--pos-text)";
  safeText(g("statMaxDrawdownSub"), `Current DD: ${currentDD > 0 ? formatMoney(-currentDD) : "$0.00"}`);

  /* ── Visual sections ─────────────────────────────────── */
  renderEquityCurve(trades);
  renderDow(trades);
  renderTickerBreakdown(trades);
  renderPnlDist(trades);
}
