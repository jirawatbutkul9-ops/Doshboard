// ==========================================
//  BACKEND.JS — Logic หน้าหลังบ้าน
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  // ---- TABS ----
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("tab-" + target).classList.add("active");
    });
  });

  // ---- RECIPE PASSWORD ----
  const recipeSection = document.getElementById("recipe-content");
  const lockSection = document.getElementById("recipe-lock");

  document.getElementById("btn-unlock").addEventListener("click", () => {
    const input = document.getElementById("recipe-password").value;
    if (input === CONFIG.RECIPE_PASSWORD) {
      lockSection.style.display = "none";
      recipeSection.style.display = "block";
      loadRecipes();
    } else {
      document.getElementById("password-error").textContent = "รหัสไม่ถูกต้อง กรุณาลองใหม่";
    }
  });

  // กด Enter ที่ช่องรหัสผ่าน
  document.getElementById("recipe-password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("btn-unlock").click();
  });
});

// ---- LOAD RECIPES ----
async function loadRecipes() {
  const container = document.getElementById("recipe-list");
  container.innerHTML = `<p class="loading-text">กำลังโหลด...</p>`;

  try {
    const menus = await fetchSheetCached(CONFIG.SHEETS.MENU_SUMMARY);

    if (!menus.length) {
      container.innerHTML = `<p class="empty">ยังไม่มีข้อมูลสูตรเครื่องดื่ม</p>`;
      return;
    }

    container.innerHTML = "";
    menus.forEach((row) => {
      const name         = row["Menu"]             || "-";
      const cost         = Number(row["Cost"])      || 0;
      const priceStore   = Number(row["Price_Store"])  || 0;
      const priceOnline  = Number(row["Price_Online"]) || 0;
      const gpStore      = Number(row["GP_Store"])     || 0;
      const gpOnline     = Number(row["GP_Online"])    || 0;
      const profitStore  = Number(row["Real_Profit_Store"])  || 0;
      const profitOnline = Number(row["Real_Profit_Online"]) || 0;

      const gpStorePct  = priceStore  > 0 ? (profitStore  / priceStore  * 100) : 0;
      const gpOnlinePct = priceOnline > 0 ? (profitOnline / priceOnline * 100) : 0;

      const card = document.createElement("div");
      card.className = "recipe-card-new";
      card.innerHTML = `
        <div class="recipe-card-header">
          <span class="recipe-icon">🧋</span>
          <span class="recipe-title">${name}</span>
        </div>
        <div class="recipe-cost-row">
          <span class="recipe-cost-label">ต้นทุน</span>
          <span class="recipe-cost-value">฿${cost.toFixed(2)}</span>
        </div>
        <div class="recipe-price-grid">
          <div class="recipe-price-col store">
            <div class="price-channel">🏪 หน้าร้าน</div>
            <div class="price-value">฿${priceStore}</div>
            <div class="price-profit ${profitStore < 0 ? 'negative' : ''}">กำไร ฿${profitStore.toFixed(2)}</div>
            <div class="price-gp ${gpStorePct < 0 ? 'negative' : ''}">GP ${gpStorePct.toFixed(1)}%</div>
          </div>
          <div class="recipe-price-col online">
            <div class="price-channel">📱 ออนไลน์</div>
            <div class="price-value">฿${priceOnline}</div>
            <div class="price-profit ${profitOnline < 0 ? 'negative' : ''}">กำไร ฿${profitOnline.toFixed(2)}</div>
            <div class="price-gp ${gpOnlinePct < 0 ? 'negative' : ''}">GP ${gpOnlinePct.toFixed(1)}%</div>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (e) {
    container.innerHTML = `<p class="error-text">โหลดข้อมูลไม่สำเร็จ: ${e.message}</p>`;
  }
}

// ---- STOCK (placeholder) ----
async function loadStock() {
  const container = document.getElementById("stock-content");
  container.innerHTML = `
    <div class="coming-soon">
      <div class="coming-soon-icon">📦</div>
      <h3>ระบบ Stock วัตถุดิบ</h3>
      <p>ยังไม่ได้เปิดใช้งาน</p>
      <p class="hint">เมื่อพร้อมให้เพิ่ม Sheet "Stock" ใน Google Sheets แล้วแจ้งผู้พัฒนา</p>
    </div>
  `;
}

// โหลด stock เมื่อคลิก tab
document.addEventListener("DOMContentLoaded", () => {
  document.querySelector('[data-tab="stock"]')?.addEventListener("click", loadStock);
});
