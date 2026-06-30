// ==========================================
//  DASHBOARD.JS — Logic หน้า Dashboard
// ==========================================

// Column name mapping จาก gviz (parsedNumHeaders:2 ทำให้ชื่อแปลก)
const COL = {
  DATE:         "Orders Information Date",
  CHANNEL:      "Channel",
  MENU:         "Menu",
  QTY:          "Qty",
  PRICE:        "Selling priec & Cost Prices",
  GROSS_SALES:  "Calculate sales Gross sales",
  ORDER_TOTAL:  "Order total",
  DISCOUNT:     "Order discount",
  NET_SALES:    "Net_sales",
  GP_RATE:      "GP rate",
  GP_AMOUNT:    "GP amount",
  VAT:          "VAT on GP",
  PAYOUT:       "Payout",
  PROFIT:       "Profit",
  HIDDEN_COST:  "Hidden_cost",
  HIDDEN_TOTAL: "Hidden_cost_total",
  REAL_PROFIT:  "Real Profit",
};

// Column names for campaigns (ในคอลัมน์ Orders)
const COL_CAMPAIGN = {
  PARTNER_CAMPAIGN: "Partner campaign",
  DISCOUNT_CAMPAIGN: "Discount campaign",
  PROMOTION_SHOP: "Promotion shop",
  DISCOUNT_PROMOTION: "Discount promotion",
};

let allOrders = [];
let filteredOrders = [];

// ---- INIT ----
document.addEventListener("DOMContentLoaded", async () => {
  showLoading(true);
  try {
    const [orders, menuPrices] = await Promise.all([
      fetchSheetCached(CONFIG.SHEETS.ORDERS),
      fetchSheetCached(CONFIG.SHEETS.MENU_PRICES),
    ]);
    allOrders = orders;

    // สร้าง map ราคาจาก Menu_prices: { "Thai Tea": { store: 45, online: 60 }, ... }
    window._menuPriceMap = {};
    menuPrices.forEach((r) => {
      const name   = (r["Menu"] || r["เมนู"] || Object.values(r)[0] || "").trim();
      const store  = Number(r["Store"]  || r["Prices Store"]  || Object.values(r)[1]) || 0;
      const online = Number(r["Online"] || r["Prices Online"] || Object.values(r)[2]) || 0;
      if (name) window._menuPriceMap[name] = { store, online };
    });

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
  // โหลดค่าที่บันทึกไว้จาก localStorage ก่อน
  const savedFrom   = localStorage.getItem("filter_date_from");
  const savedTo     = localStorage.getItem("filter_date_to");
  const savedPreset = localStorage.getItem("filter_preset");

  if (savedFrom && savedTo) {
    document.getElementById("date-from").value = savedFrom;
    document.getElementById("date-to").value   = savedTo;
    ["today", "week", "month", "year"].forEach((p) => {
      document.getElementById("btn-" + p).classList.toggle("active", p === savedPreset);
    });
    // parse แบบ UTC เพื่อป้องกัน timezone offset
    applyFilter(parseDateStr(savedFrom), parseDateStr(savedTo));
  } else {
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    document.getElementById("date-from").value = formatDate(firstOfMonth);
    document.getElementById("date-to").value   = formatDate(today);
    setPreset("month");
  }
}

// parse "YYYY-MM-DD" string ให้เป็น Date โดยไม่มี timezone issue
function parseDateStr(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
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

  // บันทึกลง localStorage
  localStorage.setItem("filter_date_from", formatDate(from));
  localStorage.setItem("filter_date_to",   formatDate(to));
  localStorage.setItem("filter_preset",    preset);

  applyFilter(from, to);
}

function applyCustomRange() {
  const fromStr = document.getElementById("date-from").value;
  const toStr   = document.getElementById("date-to").value;
  if (!fromStr || !toStr) return alert("กรุณาเลือกวันที่ให้ครบถ้วน");

  const from = parseDateStr(fromStr);
  const to   = parseDateStr(toStr);

  ["today", "week", "month", "year"].forEach((p) => {
    document.getElementById("btn-" + p).classList.remove("active");
  });

  localStorage.setItem("filter_date_from", fromStr);
  localStorage.setItem("filter_date_to",   toStr);
  localStorage.removeItem("filter_preset");

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
  renderCampaign();
  renderSalesByMenu();
  renderSalesByChannel();
  renderDailyChart();
}

function renderKPIs() {
  const totalGross    = filteredOrders.reduce((s, r) => s + (Number(r[COL.GROSS_SALES])  || 0), 0);
  const totalDiscount = filteredOrders.reduce((s, r) => s + (Number(r[COL.DISCOUNT])     || 0), 0);
  const totalSales    = filteredOrders.reduce((s, r) => s + (Number(r[COL.NET_SALES])    || 0), 0);
  const totalProfit   = filteredOrders.reduce((s, r) => s + (Number(r[COL.REAL_PROFIT] !== null ? r[COL.REAL_PROFIT] : r[COL.PROFIT]) || 0), 0);
  const totalOrders   = filteredOrders.length;
  const totalQty      = filteredOrders.reduce((s, r) => s + (Number(r[COL.QTY]) || 0), 0);
  const avgOrder      = totalOrders > 0 ? totalSales / totalOrders : 0;
  const totalGP       = filteredOrders.reduce((s, r) => s + (Number(r[COL.GP_AMOUNT])   || 0), 0);
  const totalVAT      = filteredOrders.reduce((s, r) => s + (Number(r[COL.VAT])         || 0), 0);
  const totalPayout   = filteredOrders.reduce((s, r) => s + (Number(r[COL.PAYOUT])      || 0), 0);
  const totalHidden   = filteredOrders.reduce((s, r) => s + (Number(r[COL.HIDDEN_TOTAL] ?? r[COL.HIDDEN_COST]) || 0), 0);
  const gpRateAvg     = filteredOrders.reduce((s, r) => s + (Number(r[COL.GP_RATE])     || 0), 0) / (totalOrders || 1);

  document.getElementById("kpi-discount").textContent = formatMoney(totalDiscount);
  document.getElementById("kpi-sales").textContent    = formatMoney(totalSales);
  document.getElementById("kpi-orders").textContent   = totalOrders.toLocaleString();
  document.getElementById("kpi-qty").textContent      = totalQty.toLocaleString();
  document.getElementById("kpi-avg").textContent      = formatMoney(avgOrder);
  document.getElementById("kpi-gp").textContent       = formatMoney(totalGP);
  document.getElementById("kpi-gp-pct").textContent   = `(${formatPercent(gpRateAvg * 100)} เฉลี่ย)`;
  document.getElementById("kpi-vat").textContent      = formatMoney(totalVAT);
  document.getElementById("kpi-payout").textContent   = formatMoney(totalPayout);
  document.getElementById("kpi-hidden").textContent   = formatMoney(totalHidden);
  document.getElementById("kpi-profit").textContent   = formatMoney(totalProfit);
}

async function renderCampaign() {
  try {
    // นับจาก filteredOrders (ตามช่วงเวลาที่ filter)
    
    // Partner campaign: นับจำนวนแถวที่ Partner campaign ไม่ว่าง
    const partnerCampaignCount = filteredOrders.filter(r => 
      r[COL_CAMPAIGN.PARTNER_CAMPAIGN] && r[COL_CAMPAIGN.PARTNER_CAMPAIGN].toString().trim() !== ""
    ).length;
    
    // Discount campaign: รวมยอดเงิน
    const discountCampaignTotal = filteredOrders.reduce((sum, r) => {
      return sum + (Number(r[COL_CAMPAIGN.DISCOUNT_CAMPAIGN]) || 0);
    }, 0);
    
    // Promotion shop: นับจำนวนแถวที่ Promotion shop ไม่ว่าง
    const promotionShopCount = filteredOrders.filter(r => 
      r[COL_CAMPAIGN.PROMOTION_SHOP] && r[COL_CAMPAIGN.PROMOTION_SHOP].toString().trim() !== ""
    ).length;
    
    // Discount promotion: รวมยอดเงิน
    const discountPromotionTotal = filteredOrders.reduce((sum, r) => {
      return sum + (Number(r[COL_CAMPAIGN.DISCOUNT_PROMOTION]) || 0);
    }, 0);
    
    // อัปเดต UI
    document.getElementById("campaign-partner").textContent = partnerCampaignCount > 0 ? partnerCampaignCount.toString() : "—";
    document.getElementById("campaign-discount").textContent = discountCampaignTotal > 0 ? formatMoney(discountCampaignTotal) : "—";
    document.getElementById("campaign-promotion").textContent = promotionShopCount > 0 ? promotionShopCount.toString() : "—";
    document.getElementById("campaign-promo-discount").textContent = discountPromotionTotal > 0 ? formatMoney(discountPromotionTotal) : "—";
  } catch (e) {
    console.error("Error loading campaigns:", e);
    document.getElementById("campaign-partner").textContent = "ข้อมูลไม่ได้";
    document.getElementById("campaign-discount").textContent = "ข้อมูลไม่ได้";
    document.getElementById("campaign-promotion").textContent = "ข้อมูลไม่ได้";
    document.getElementById("campaign-promo-discount").textContent = "ข้อมูลไม่ได้";
  }
}

function renderSalesByMenu() {
  const menuMap = {};
  filteredOrders.forEach((r) => {
    const menu = r[COL.MENU] || "ไม่ระบุ";
    const qty  = Number(r[COL.QTY]) || 0;
    // ใช้ Net_sales ถ้ามี ไม่งั้นใช้ Price × Qty (sub-row มีค่านี้อยู่แล้ว)
    const sales = Number(r[COL.NET_SALES]) || (Number(r[COL.PRICE]) * qty) || 0;

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
