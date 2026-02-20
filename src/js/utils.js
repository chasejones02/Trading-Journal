// js/utils.js
// Date helpers, formatters, and escape utilities

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toDateKey(d) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function keyToPretty(key) {
  if (!key) return "—";
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "2-digit" });
}

function monthName(y, m0) {
  const dt = new Date(y, m0, 1);
  return dt.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatMoney(n) {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}$${abs.toFixed(2)}`;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseTimeToHourBucket(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return null;
  const parts = timeStr.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const hm = parts[0];
  const ap = (parts[1] || "").toUpperCase();
  const [hStr, mStr] = hm.split(":");
  const h = Number(hStr), m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 1 || h > 12 || m < 0 || m > 59) return null;
  if (ap !== "AM" && ap !== "PM") return null;
  let hour24 = h % 12;
  if (ap === "PM") hour24 += 12;
  const start = `${pad2(hour24)}:00`;
  const end = `${pad2(hour24)}:59`;
  return { hour24, label: `${start}–${end}` };
}

function normalizeSetupKey(confluences) {
  const arr = Array.isArray(confluences) ? confluences.filter(Boolean) : [];
  const sorted = [...arr].map(s => String(s).trim()).filter(Boolean).sort((a, b) => a.localeCompare(b));
  return sorted.join(" + ");
}
