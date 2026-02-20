// js/app.js
// Main application logic: state, entry form, confluences, edit/delete

/**********************
 * App State
 **********************/
const APP = loadState(); // from storage.js
let selectedConfluences = [];
let selectedDateKey = null;
let selectedTradeId = null;
let viewYear, viewMonth;
let editTradeId = null;
let editTradeOriginalDateKey = null;

const state = {
  get viewYear()  { return viewYear; },
  set viewYear(v) { viewYear = v; },
  get viewMonth()  { return viewMonth; },
  set viewMonth(v) { viewMonth = v; },
  get selectedDateKey()  { return selectedDateKey; },
  set selectedDateKey(v) { selectedDateKey = v; },
};

document.getElementById("refreshInsightsBtn").addEventListener("click", () => renderInsights(APP));

/**********************
 * Time selectors
 **********************/
(function initTimeSelectors() {
  const hourSelect   = document.getElementById("hourSelect");
  const minuteSelect = document.getElementById("minuteSelect");
  for (let h = 1; h <= 12; h++) {
    const opt = document.createElement("option");
    opt.value = String(h);
    opt.textContent = String(h);
    hourSelect.appendChild(opt);
  }
  for (let m = 0; m <= 59; m++) {
    const mm = String(m).padStart(2, "0");
    const opt = document.createElement("option");
    opt.value = mm;
    opt.textContent = mm;
    minuteSelect.appendChild(opt);
  }
  updateTimePreview();
})();

function updateTimePreview() {
  const t = getTimeText();
  document.getElementById("timePreview").textContent = `Selected time: ${t || "—"}`;
  renderPreview();
}

["hourSelect", "minuteSelect", "ampmSelect"].forEach(id =>
  document.getElementById(id).addEventListener("change", updateTimePreview)
);

["tickerSelect", "dirSelect", "rrInput", "pnlInput"].forEach(id => {
  const el = document.getElementById(id);
  el.addEventListener("input",  renderPreview);
  el.addEventListener("change", renderPreview);
});

/**********************
 * Entry helpers
 **********************/
function getTimeText() {
  const h  = document.getElementById("hourSelect").value;
  const m  = document.getElementById("minuteSelect").value;
  const ap = document.getElementById("ampmSelect").value;
  return (h && m) ? `${h}:${m} ${ap}` : "";
}

function setTimeFromText(t) {
  if (!t) {
    document.getElementById("hourSelect").value   = "";
    document.getElementById("minuteSelect").value = "";
    document.getElementById("ampmSelect").value   = "AM";
    updateTimePreview();
    return;
  }
  const parts = t.split(" ");
  const [h, m] = (parts[0] || "").split(":");
  document.getElementById("hourSelect").value   = h || "";
  document.getElementById("minuteSelect").value = m || "";
  document.getElementById("ampmSelect").value   = (parts[1] === "PM") ? "PM" : "AM";
  updateTimePreview();
}

function parsePnL() {
  const n = Number(document.getElementById("pnlInput").value);
  return Number.isFinite(n) ? n : 0;
}

function parseRR() {
  const n = Number(document.getElementById("rrInput").value);
  return Number.isFinite(n) ? n : null;
}

function renderPreview() {
  const parts = [
    `Date: ${selectedDateKey ? keyToPretty(selectedDateKey) : "—"}`,
    `Ticker: ${document.getElementById("tickerSelect").value || "—"}`,
    `Time: ${getTimeText() || "—"}`,
    `Direction: ${document.getElementById("dirSelect").value || "—"}`,
    `Target RR: ${parseRR() !== null ? parseRR() : "—"}`,
    `PnL: ${document.getElementById("pnlInput").value ? formatMoney(parsePnL()) : "—"}`,
    `Confluences: ${selectedConfluences.length ? selectedConfluences.join(" + ") : "—"}`,
  ];
  document.getElementById("previewText").textContent = parts.join(" | ");
}

function clearEntry() {
  document.getElementById("tickerSelect").value = "";
  setTimeFromText("");
  document.getElementById("dirSelect").value  = "";
  document.getElementById("rrInput").value    = "";
  document.getElementById("pnlInput").value   = "";
  document.getElementById("notesInput").value = "";
  selectedConfluences = [];
  document.getElementById("confluenceInput").value = "";
  hideDropdown();
  renderChips();
  renderPreview();
}

document.getElementById("clearBtn").addEventListener("click", () => {
  if (editTradeId) return;
  clearEntry();
});

/**********************
 * Confluence typeahead
 **********************/
function normalize(s) { return s.toLowerCase().trim(); }

function getMatches(query) {
  const q = normalize(query);
  if (!q) return [];
  return CONFLUENCES
    .filter(c => !selectedConfluences.includes(c))
    .map(label => {
      const n = normalize(label);
      let score = -1;
      if (n.startsWith(q)) score = 2;
      else if (n.includes(q)) score = 1;
      return score >= 0 ? { label, score } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (b.score - a.score) || (a.label.length - b.label.length) || a.label.localeCompare(b.label))
    .slice(0, 4);
}

function showDropdown(items) {
  const dropdown = document.getElementById("dropdown");
  if (!items.length) { hideDropdown(); return; }
  dropdown.innerHTML = items.map(item => `
    <div class="option" role="option">
      <span>${escapeHtml(item.label)}</span>
      <span class="match">${item.score === 2 ? "starts with" : "contains"}</span>
    </div>
  `).join("");
  dropdown.style.display = "block";
}

function hideDropdown() {
  const dropdown = document.getElementById("dropdown");
  dropdown.style.display = "none";
  dropdown.innerHTML = "";
}

function addConfluence(label) {
  if (!label || selectedConfluences.includes(label)) return;
  selectedConfluences.push(label);
  document.getElementById("confluenceInput").value = "";
  hideDropdown();
  renderChips();
  renderPreview();
  document.getElementById("confluenceInput").focus();
}

function renderChips() {
  const chipsEl = document.getElementById("chips");
  if (!selectedConfluences.length) {
    chipsEl.innerHTML = `<span class="hint">No confluences selected yet.</span>`;
    return;
  }
  chipsEl.innerHTML = selectedConfluences.map((c, idx) => `
    <span class="chip">
      ${escapeHtml(c)}
      <button type="button" aria-label="Remove ${escapeHtml(c)}" data-remove="${idx}">×</button>
    </span>
  `).join("");
}

document.getElementById("confluenceInput").addEventListener("input", e => showDropdown(getMatches(e.target.value)));
document.getElementById("confluenceInput").addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); const items = getMatches(e.target.value); if (items.length) addConfluence(items[0].label); }
  if (e.key === "Escape") { hideDropdown(); e.target.blur(); }
});
document.getElementById("dropdown").addEventListener("click", e => {
  const opt = e.target.closest(".option");
  if (opt) addConfluence(opt.querySelector("span")?.textContent);
});
document.getElementById("chips").addEventListener("click", e => {
  const btn = e.target.closest("button[data-remove]");
  if (!btn) return;
  const idx = Number(btn.getAttribute("data-remove"));
  if (Number.isFinite(idx)) { selectedConfluences.splice(idx, 1); renderChips(); renderPreview(); }
});
document.addEventListener("click", e => { if (!e.target.closest(".search")) hideDropdown(); });

/**********************
 * Submit
 **********************/
function submitTrade() {
  if (editTradeId) { alert("You're in edit mode. Click 'Save Changes' or 'Cancel Edit'."); return; }
  if (!selectedDateKey) { alert("Select a day on the calendar first."); return; }
  if (!selectedConfluences.length) { alert("Add at least 1 confluence before submitting."); return; }

  const trade = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + "_" + Math.random().toString(16).slice(2),
    dateKey: selectedDateKey,
    ticker:    document.getElementById("tickerSelect").value || "",
    time:      getTimeText(),
    direction: document.getElementById("dirSelect").value || "",
    targetRR:  parseRR(),
    pnl:       parsePnL(),
    confluences: [...selectedConfluences],
    notes:     document.getElementById("notesInput").value.trim(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  upsertTrade(APP, selectedDateKey, trade);
  saveState(APP);
  selectedTradeId = trade.id;
  renderCalendar(APP, state, onDayClick);
  renderDayDetails(selectedDateKey);
  clearEntry();
  renderInsights(APP);
}

document.getElementById("submitBtn").addEventListener("click", submitTrade);

/**********************
 * Edit mode
 **********************/
function enterEditMode(tradeId) {
  const found = findTradeById(APP, tradeId);
  if (!found) return;
  editTradeId = tradeId;
  editTradeOriginalDateKey = found.dateKey;

  document.getElementById("entryActions").style.display = "none";
  document.getElementById("editActions").style.display  = "flex";
  document.getElementById("modeHint").innerHTML = `<strong>Editing:</strong> make changes below, then click <strong>Save Changes</strong>.`;

  const t = found.trade;
  selectedDateKey = t.dateKey;
  document.getElementById("selectedDayText").textContent = keyToPretty(selectedDateKey);
  selectedTradeId = tradeId;

  document.getElementById("tickerSelect").value = t.ticker || "";
  setTimeFromText(t.time || "");
  document.getElementById("dirSelect").value   = t.direction || "";
  document.getElementById("rrInput").value     = (t.targetRR == null) ? "" : String(t.targetRR);
  document.getElementById("pnlInput").value    = (t.pnl == null) ? "" : String(t.pnl);
  document.getElementById("notesInput").value  = t.notes || "";

  selectedConfluences = Array.isArray(t.confluences) ? [...t.confluences] : [];
  renderChips();
  renderPreview();
  renderCalendar(APP, state, onDayClick);
  renderDayDetails(selectedDateKey);
}

function exitEditMode() {
  editTradeId = null;
  editTradeOriginalDateKey = null;
  document.getElementById("entryActions").style.display = "flex";
  document.getElementById("editActions").style.display  = "none";
  document.getElementById("modeHint").innerHTML = `<strong>Submit rules:</strong> must select a calendar day and at least 1 confluence.`;
}

function saveEdit() {
  if (!editTradeId) return;
  if (!selectedDateKey) { alert("Select a day first."); return; }
  if (!selectedConfluences.length) { alert("Add at least 1 confluence."); return; }

  const existing = findTradeById(APP, editTradeId);
  if (!existing) { alert("Could not find that trade anymore."); exitEditMode(); return; }

  const updated = {
    ...existing.trade,
    dateKey:    selectedDateKey,
    ticker:     document.getElementById("tickerSelect").value || "",
    time:       getTimeText(),
    direction:  document.getElementById("dirSelect").value || "",
    targetRR:   parseRR(),
    pnl:        parsePnL(),
    confluences: [...selectedConfluences],
    notes:      document.getElementById("notesInput").value.trim(),
    updatedAt:  Date.now(),
  };

  if (editTradeOriginalDateKey && editTradeOriginalDateKey !== selectedDateKey) {
    removeTrade(APP, editTradeOriginalDateKey, editTradeId);
  }
  upsertTrade(APP, selectedDateKey, updated);
  saveState(APP);

  selectedTradeId = editTradeId;
  const dayKeyToShow = selectedDateKey;
  exitEditMode();
  clearEntry();
  renderCalendar(APP, state, onDayClick);
  renderDayDetails(dayKeyToShow);
  renderInsights(APP);
}

function cancelEdit() {
  if (!editTradeId) return;
  exitEditMode();
  clearEntry();
  renderPreview();
  renderCalendar(APP, state, onDayClick);
  renderDayDetails(selectedDateKey);
}

document.getElementById("saveEditBtn").addEventListener("click",   saveEdit);
document.getElementById("cancelEditBtn").addEventListener("click", cancelEdit);

/**********************
 * Delete
 **********************/
function deleteSelectedTrade() {
  if (!selectedTradeId) return;
  const found = findTradeById(APP, selectedTradeId);
  if (!found) return;
  if (!confirm("Delete this trade? This cannot be undone.")) return;
  if (editTradeId === selectedTradeId) { exitEditMode(); clearEntry(); }
  removeTrade(APP, found.dateKey, selectedTradeId);
  saveState(APP);
  selectedTradeId = null;
  renderCalendar(APP, state, onDayClick);
  renderDayDetails(selectedDateKey);
  renderInsights(APP);
}

document.getElementById("editTradeBtn").addEventListener("click",   () => { if (selectedTradeId) enterEditMode(selectedTradeId); });
document.getElementById("deleteTradeBtn").addEventListener("click", deleteSelectedTrade);

/**********************
 * Day Details (middle card)
 **********************/
function renderDayDetails(dateKey) {
  const trades = dateKey
    ? getDayTrades(APP, dateKey).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    : [];

  const dayDetailsCard = document.getElementById("dayDetailsCard");
  if (!dateKey || !trades.length) {
    dayDetailsCard.style.display = "none";
    document.getElementById("tradeList").innerHTML = "";
    document.getElementById("tradeDetailsBox").innerHTML = `<div class="k">Select a trade to view details.</div>`;
    document.getElementById("tradeDetailActions").style.display = "none";
    return;
  }

  dayDetailsCard.style.display = "block";
  document.getElementById("dayDetailsDate").textContent = keyToPretty(dateKey);

  const { count, pnl } = dayTotals(APP, dateKey);
  document.getElementById("dayTradeCount").textContent = String(count);
  document.getElementById("dayTotalPnL").textContent   = formatMoney(pnl);

  const tradeList = document.getElementById("tradeList");
  tradeList.innerHTML = "";

  for (const t of trades) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tradeBtn" + (t.id === selectedTradeId ? " active" : "");
    btn.innerHTML = `
      <span>${escapeHtml(`${t.ticker || "—"} • ${t.direction || "—"}`)}</span>
      <span class="meta">${escapeHtml(`${t.time || "—"} • ${formatMoney(Number(t.pnl) || 0)}`)}</span>
    `;
    btn.addEventListener("click", () => {
      selectedTradeId = t.id;
      renderDayDetails(dateKey);
      renderTradeDetails(t);
    });
    tradeList.appendChild(btn);
  }

  const picked = trades.find(x => x.id === selectedTradeId) || trades[0];
  selectedTradeId = picked.id;
  renderTradeDetails(picked);
}

function renderTradeDetails(t) {
  const rr     = (t.targetRR == null) ? "—" : String(t.targetRR);
  const conf   = (t.confluences && t.confluences.length) ? t.confluences.join(" + ") : "—";
  document.getElementById("tradeDetailsBox").innerHTML = `
    <div class="k">Ticker</div><div class="v">${escapeHtml(t.ticker || "—")}</div>
    <div class="k">Time</div><div class="v">${escapeHtml(t.time || "—")}</div>
    <div class="k">Direction</div><div class="v">${escapeHtml(t.direction || "—")}</div>
    <div class="k">Target RR</div><div class="v">${escapeHtml(rr)}</div>
    <div class="k">PnL</div><div class="v">${escapeHtml(formatMoney(Number(t.pnl) || 0))}</div>
    <div class="k">Confluences</div><div class="v">${escapeHtml(conf)}</div>
    <div class="k">Notes</div><div class="v">${escapeHtml(t.notes || "—")}</div>
  `;
  document.getElementById("tradeDetailActions").style.display = "flex";
}

/**********************
 * Calendar nav
 **********************/
function onDayClick(key) {
  selectedDateKey = key;
  document.getElementById("selectedDayText").textContent = keyToPretty(selectedDateKey);
  if (!editTradeId) selectedTradeId = null;
  renderCalendar(APP, state, onDayClick);
  renderDayDetails(selectedDateKey);
  renderPreview();
}

document.getElementById("prevMonthBtn").addEventListener("click", () => {
  viewMonth -= 1;
  if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
  renderCalendar(APP, state, onDayClick);
  renderDayDetails(selectedDateKey);
});

document.getElementById("nextMonthBtn").addEventListener("click", () => {
  viewMonth += 1;
  if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
  renderCalendar(APP, state, onDayClick);
  renderDayDetails(selectedDateKey);
});

document.getElementById("todayBtn").addEventListener("click", () => {
  const now = new Date();
  viewYear  = now.getFullYear();
  viewMonth = now.getMonth();
  selectedDateKey = toDateKey(now);
  document.getElementById("selectedDayText").textContent = keyToPretty(selectedDateKey);
  if (!editTradeId) selectedTradeId = null;
  renderCalendar(APP, state, onDayClick);
  renderDayDetails(selectedDateKey);
  renderPreview();
});

document.getElementById("clearDataBtn").addEventListener("click", () => {
  if (!confirm("Clear all saved trades on this device? This cannot be undone.")) return;
  APP.tradesByDate = {};
  saveState(APP);
  selectedTradeId = null;
  exitEditMode();
  renderCalendar(APP, state, onDayClick);
  renderDayDetails(selectedDateKey);
  renderPreview();
  renderInsights(APP);
});

/**********************
 * Boot
 **********************/
initCalendarToToday(state);
renderCalendar(APP, state, onDayClick);
renderDayDetails(selectedDateKey);
renderPreview();
renderChips();
renderInsights(APP);
