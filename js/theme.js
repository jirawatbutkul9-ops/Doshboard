// ==========================================
//  THEME.JS — Dark / Light mode toggle
// ==========================================

(function () {
  const btn = document.getElementById("theme-toggle");
  const saved = localStorage.getItem("theme") || "dark";

  function applyTheme(mode) {
    if (mode === "light") {
      document.body.classList.add("light");
      btn.textContent = "☀️";
      btn.title = "เปลี่ยนเป็น Dark mode";
    } else {
      document.body.classList.remove("light");
      btn.textContent = "🌙";
      btn.title = "เปลี่ยนเป็น Light mode";
    }
    localStorage.setItem("theme", mode);
  }

  // โหลดค่าที่บันทึกไว้
  applyTheme(saved);

  // คลิกสลับ
  btn.addEventListener("click", () => {
    const current = document.body.classList.contains("light") ? "light" : "dark";
    applyTheme(current === "dark" ? "light" : "dark");
  });
})();
