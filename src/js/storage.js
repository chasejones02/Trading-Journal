// js/storage.js
// Handles reading/writing trade data to localStorage

const STORAGE_KEY = "tradeJournal_v1";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { tradesByDate: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { tradesByDate: {} };
    if (!parsed.tradesByDate || typeof parsed.tradesByDate !== "object") return { tradesByDate: {} };
    return parsed;
  } catch {
    return { tradesByDate: {} };
  }
}

function saveState(app) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(app));
}

function upsertTrade(app, dateKey, trade) {
  if (!app.tradesByDate[dateKey]) app.tradesByDate[dateKey] = [];
  const arr = app.tradesByDate[dateKey];
  const idx = arr.findIndex(t => t.id === trade.id);
  if (idx >= 0) arr[idx] = trade;
  else arr.push(trade);
}

function removeTrade(app, dateKey, tradeId) {
  const arr = app.tradesByDate[dateKey] || [];
  const next = arr.filter(t => t.id !== tradeId);
  if (next.length === 0) delete app.tradesByDate[dateKey];
  else app.tradesByDate[dateKey] = next;
}

function findTradeById(app, tradeId) {
  for (const [dateKey, trades] of Object.entries(app.tradesByDate)) {
    const t = trades.find(x => x.id === tradeId);
    if (t) return { dateKey, trade: t };
  }
  return null;
}

function getAllTrades(app) {
  const out = [];
  for (const [dateKey, arr] of Object.entries(app.tradesByDate)) {
    for (const t of (arr || [])) {
      out.push({ ...t, dateKey: t.dateKey || dateKey });
    }
  }
  return out;
}
