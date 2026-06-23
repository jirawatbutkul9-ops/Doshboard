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
    const menuPrices = await fetchSheetCached(CONFIG.SHEETS.MENU_PRICES);
    const menuCost = await fetchSheetCached(CONFIG.SHEETS.MENU_COST);

    if (!menuPrices.length && !menuCost.length) {
      container.innerHTML = `<p class="empty">ยังไม่มีข้อมูลสูตรเครื่องดื่ม</p>`;
      return;
    }

    container.innerHTML = "";

    // รวมข้อมูลเมนู
    const menus = menuPrices.length ? menuPrices : menuCost;
    menus.forEach((row) => {
      const name = row["Menu"] || row["เมนู"] || Object.values(row)[0] || "ไม่ระบุ";
      const price = row["Price"] || row["ราคา"] || row["Selling_price"] || "";
      const cost = row["Cost"] || row["ต้นทุน"] || "";

      const card = document.createElement("div");
      card.className = "recipe-card";
      card.innerHTML = `
        <div class="recipe-name">${name}</div>
        <div class="recipe-details">
          ${price ? `<span>💰 ราคาขาย: ${formatMoney(price)}</span>` : ""}
          ${cost ? `<span>🧾 ต้นทุน: ${formatMoney(cost)}</span>` : ""}
          ${price && cost ? `<span>📊 Margin: ${formatPercent(((price - cost) / price) * 100)}</span>` : ""}
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
