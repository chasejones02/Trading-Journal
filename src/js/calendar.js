// js/calendar.js
// Calendar rendering and navigation

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function initCalendarToToday(state) {
  const now = new Date();
  state.viewYear = now.getFullYear();
  state.viewMonth = now.getMonth();
  state.selectedDateKey = toDateKey(now);
  document.getElementById("selectedDayText").textContent = keyToPretty(state.selectedDateKey);
}

function getDayTrades(app, dateKey) {
  return app.tradesByDate[dateKey] ? [...app.tradesByDate[dateKey]] : [];
}

function dayTotals(app, dateKey) {
  const trades = getDayTrades(app, dateKey);
  const count = trades.length;
  const pnl = trades.reduce((s, t) => s + (Number(t.pnl) || 0), 0);
  return { count, pnl };
}

function monthTotals(app, y, m0) {
  const prefix = `${y}-${pad2(m0 + 1)}-`;
  let pnl = 0;
  for (const [dateKey, trades] of Object.entries(app.tradesByDate)) {
    if (!dateKey.startsWith(prefix)) continue;
    for (const t of trades) pnl += (Number(t.pnl) || 0);
  }
  return { pnl };
}

function renderCalendar(app, state, onDayClick) {
  const { viewYear, viewMonth, selectedDateKey } = state;

  document.getElementById("monthLabel").textContent = monthName(viewYear, viewMonth);
  const mt = monthTotals(app, viewYear, viewMonth);
  document.getElementById("monthTotalPnL").textContent = formatMoney(mt.pnl);

  const calGrid = document.getElementById("calGrid");
  calGrid.innerHTML = "";

  for (const d of DOW) {
    const el = document.createElement("div");
    el.className = "dow";
    el.textContent = d;
    calGrid.appendChild(el);
  }

  const first = new Date(viewYear, viewMonth, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  for (let i = 0; i < startDow; i++) {
    const blank = document.createElement("div");
    blank.className = "dayCell blank";
    blank.innerHTML = `<div class="dayTop"><span>—</span><span class="dayBadge"></span></div><div class="dayBottom"></div>`;
    calGrid.appendChild(blank);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dt = new Date(viewYear, viewMonth, day);
    const key = toDateKey(dt);
    const { count, pnl } = dayTotals(app, key);

    const cell = document.createElement("div");
    cell.className = "dayCell";

    if (count > 0) {
      if (pnl > 0) cell.classList.add("pos");
      else if (pnl < 0) cell.classList.add("neg");
    }
    if (selectedDateKey === key) cell.classList.add("selected");

    const badge = count ? `${count} trade${count === 1 ? "" : "s"}` : "no trades";
    const moneyBottom = count > 0 ? formatMoney(pnl) : "";

    cell.innerHTML = `
      <div class="dayTop">
        <span>${day}</span>
        <span class="dayBadge">${escapeHtml(badge)}</span>
      </div>
      <div class="dayBottom">${escapeHtml(moneyBottom)}</div>
    `;

    cell.addEventListener("click", () => onDayClick(key));
    calGrid.appendChild(cell);
  }
}
