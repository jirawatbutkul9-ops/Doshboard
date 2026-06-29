// ==========================================
//  DASHBOARD.JS — Logic หน้า Dashboard
// ==========================================

// Column name mapping จาก gviz (parsedNumHeaders:2 ทำให้ชื่อแปลก)
const COL = {
  DATE:        "Orders Information Date",
  CHANNEL:     "Channel",
  MENU:        "Menu",
  QTY:         "Qty",
  NET_SALES:   "Net_sales",
  GP_RATE:     "GP rate",
  GP_AMOUNT:   "GP amount",
  PROFIT:      "Profit",
  REAL_PROFIT: "Real Profit",
};

let allOrders = [];
let filteredOrders = [];

// ---- INIT ----
document.addEventListener("DOMContentLoaded", async () => {
  showLoading(true);
  try {
    allOrders = await fetchSheetCached(CONFIG.SHEETS.ORDERS);
    initDateDefaults();
  } catch (e) {
    showError("ไม่สามารถดึงข้อมูลได้: " + e.message);
  } finally {
    showLoading(false);
  }

  document.getElementById("btn-today").addEventListener("click", () => setPreset("today"));
  document.getElementById("btn-week").addEventListener("click",  () => setPreset("week"));
  document.getElementById("btn-month").addEventListener("click", () => setPreset("month"));
  document.getElementById("btn-year").addEventListener("click",  () => setPreset("year"));
  document.getElementById("btn-custom").addEventListener("click", applyCustomRange);
  document.getElementById("btn-refresh").addEventListener("click", async () => {
    clearCache();
    showLoading(true);
    try {
      allOrders = await fetchSheet(CONFIG.SHEETS.ORDERS);
      _cache[CONFIG.SHEETS.ORDERS] = allOrders;
      applyFilter(
        new Date(document.getElementById("date-from").value),
        new Date(document.getElementById("date-to").value)
      );
    } catch (e) {
      showError("Refresh ล้มเหลว: " + e.message);
    } finally {
      showLoading(false);
    }
  });
});

function initDateDefaults() {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  document.getElementById("date-from").value = formatDate(firstOfMonth);
  document.getElementById("date-to").value   = formatDate(today);
  setPreset("month");
}

// ---- PRESET FILTERS ----
function setPreset(preset) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let from, to;

  if (preset === "today") {
    from = to = new Date(today);
  } else if (preset === "week") {
    const day = today.getDay();
    from = new Date(today);
    from.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    to = new Date(today);
  } else if (preset === "month") {
    from = new Date(today.getFullYear(), today.getMonth(), 1);
    to   = new Date(today);
  } else if (preset === "year") {
    from = new Date(today.getFullYear(), 0, 1);
    to   = new Date(today);
  }

  document.getElementById("date-from").value = formatDate(from);
  document.getElementById("date-to").value   = formatDate(to);

  ["today", "week", "month", "year"].forEach((p) => {
    document.getElementById("btn-" + p).classList.toggle("active", p === preset);
  });

  applyFilter(from, to);
}

function applyCustomRange() {
  const from = new Date(document.getElementById("date-from").value);
  const to   = new Date(document.getElementById("date-to").value);
  if (isNaN(from) || isNaN(to)) return alert("กรุณาเลือกวันที่ให้ครบถ้วน");
  ["today", "week", "month", "year"].forEach((p) => {
    document.getElementById("btn-" + p).classList.remove("active");
  });
  applyFilter(from, to);
}

function applyFilter(from, to) {
  // แปลงเป็น UTC เพื่อให้ตรงกับ parseDate ที่ใช้ UTC
  const fromUTC = new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate()));
  const toUTC   = new Date(Date.UTC(to.getFullYear(),   to.getMonth(),   to.getDate(), 23, 59, 59));

  filteredOrders = allOrders.filter((row) => {
    const d = parseDate(row[COL.DATE]);
    if (!d) return false;
    return d >= fromUTC && d <= toUTC;
  });

  renderDashboard();
}

// ---- RENDER ----
function renderDashboard() {
  renderKPIs();
  renderSalesByMenu();
  renderSalesByChannel();
  renderDailyChart();
}

function renderKPIs() {
  const totalSales  = filteredOrders.reduce((s, r) => s + (Number(r[COL.NET_SALES])  || 0), 0);
  const totalProfit = filteredOrders.reduce((s, r) => s + (Number(r[COL.REAL_PROFIT] !== null ? r[COL.REAL_PROFIT] : r[COL.PROFIT]) || 0), 0);
  const totalOrders = filteredOrders.length;
  const avgOrder    = totalOrders > 0 ? totalSales / totalOrders : 0;
  const gpRateAvg   = filteredOrders.reduce((s, r) => s + (Number(r[COL.GP_RATE]) || 0), 0) / (totalOrders || 1);

  document.getElementById("kpi-sales").textContent   = formatMoney(totalSales);
  document.getElementById("kpi-orders").textContent  = totalOrders.toLocaleString();
  document.getElementById("kpi-profit").textContent  = formatMoney(totalProfit);
  document.getElementById("kpi-avg").textContent     = formatMoney(avgOrder);
  document.getElementById("kpi-gp").textContent      = formatPercent(gpRateAvg * 100);
}

function renderSalesByMenu() {
  // ก่อนรวม ให้ inherit Net_sales และ Price จาก row หลักสำหรับ sub-row
  // โดยใช้ Order ID เป็น key
  const orderSalesMap = {};
  filteredOrders.forEach((r) => {
    const oid = r["Order ID"];
    if (!oid) return;
    if (r[COL.NET_SALES] && !orderSalesMap[oid]) {
      orderSalesMap[oid] = {
        netSales: Number(r[COL.NET_SALES]) || 0,
        price:    Number(r[COL.PRICE])     || 0,
      };
    }
  });

  const menuMap = {};
  filteredOrders.forEach((r) => {
    const menu = r[COL.MENU] || "ไม่ระบุ";
    const qty  = Number(r[COL.QTY]) || 0;
    let sales  = Number(r[COL.NET_SALES]) || 0;

    // sub-row ไม่มี Net_sales → คำนวณจาก Price × Qty ของ Order นั้น
    if (!sales && qty > 0) {
      const oid   = r["Order ID"];
      const price = Number(r[COL.PRICE]) || (oid && orderSalesMap[oid] ? orderSalesMap[oid].price : 0);
      sales = price * qty;
    }

    if (!menuMap[menu]) menuMap[menu] = { sales: 0, qty: 0 };
    menuMap[menu].sales += sales;
    menuMap[menu].qty   += qty;
  });

  const sorted = Object.entries(menuMap).sort((a, b) => b[1].sales - a[1].sales);
  const tbody  = document.getElementById("menu-table-body");
  tbody.innerHTML = "";

  if (sorted.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="empty">ไม่มีข้อมูลในช่วงเวลานี้</td></tr>`;
    return;
  }

  // แถวข้อมูลแต่ละเมนู
  let totalQty   = 0;
  let totalSales = 0;
  sorted.forEach(([menu, data], i) => {
    totalQty   += data.qty;
    totalSales += data.sales;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}. ${menu}</td>
      <td class="num">${data.qty.toLocaleString()}</td>
      <td class="num">${formatMoney(data.sales)}</td>
    `;
    tbody.appendChild(tr);
  });

  // แถวยอดรวม
  const trTotal = document.createElement("tr");
  trTotal.style.cssText = "font-weight:700;border-top:2px solid var(--border);background:var(--surface2)";
  trTotal.innerHTML = `
    <td>รวมทั้งหมด</td>
    <td class="num">${totalQty.toLocaleString()}</td>
    <td class="num">${formatMoney(totalSales)}</td>
  `;
  tbody.appendChild(trTotal);
}

function renderSalesByChannel() {
  const channelMap = {};
  filteredOrders.forEach((r) => {
    const ch    = r[COL.CHANNEL]   || "ไม่ระบุ";
    const sales = Number(r[COL.NET_SALES]) || 0;
    if (!channelMap[ch]) channelMap[ch] = 0;
    channelMap[ch] += sales;
  });

  const total     = Object.values(channelMap).reduce((s, v) => s + v, 0);
  const container = document.getElementById("channel-bars");
  container.innerHTML = "";

  if (Object.keys(channelMap).length === 0) {
    container.innerHTML = `<p class="empty">ไม่มีข้อมูล</p>`;
    return;
  }

  const colors = ["#4f9cf9", "#f97316", "#22c55e", "#a855f7", "#ec4899", "#14b8a6"];
  Object.entries(channelMap)
    .sort((a, b) => b[1] - a[1])
    .forEach(([ch, val], i) => {
      const pct = total > 0 ? (val / total) * 100 : 0;
      const div = document.createElement("div");
      div.className = "channel-row";
      div.innerHTML = `
        <div class="channel-label">${ch}</div>
        <div class="channel-bar-wrap">
          <div class="channel-bar" style="width:${pct.toFixed(1)}%;background:${colors[i % colors.length]}"></div>
        </div>
        <div class="channel-val">${formatMoney(val)} (${pct.toFixed(1)}%)</div>
      `;
      container.appendChild(div);
    });
}

function renderDailyChart() {
  const dayMap = {};
  filteredOrders.forEach((r) => {
    const d = parseDate(r[COL.DATE]);
    if (!d) return;
    const key   = formatDate(d);
    const sales = Number(r[COL.NET_SALES]) || 0;
    if (!dayMap[key]) dayMap[key] = 0;
    dayMap[key] += sales;
  });

  const labels = Object.keys(dayMap).sort();
  const values = labels.map((k) => dayMap[k]);

  const canvas = document.getElementById("daily-chart");
  if (!canvas) return;

  if (window._dailyChart) window._dailyChart.destroy();

  window._dailyChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: labels.map((l) => {
        const parts = l.split("-");
        return `${parseInt(parts[2])}/${parseInt(parts[1])}`;
      }),
      datasets: [{
        label: "ยอดขาย (฿)",
        data: values,
        backgroundColor: "#4f9cf9",
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => formatMoney(ctx.raw) } },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (v) => formatMoney(v) },
        },
      },
    },
  });
}

// ---- UI HELPERS ----
function showLoading(show) {
  const el = document.getElementById("loading-overlay");
  if (el) el.style.display = show ? "flex" : "none";
}

function showError(msg) {
  const el = document.getElementById("error-msg");
  if (el) {
    el.textContent = msg;
    el.style.display = "block";
  }
}
