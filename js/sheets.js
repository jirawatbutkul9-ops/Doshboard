// ==========================================
//  SHEETS.JS — ดึงข้อมูลจาก Google Sheets
// ==========================================

/**
 * ดึงข้อมูลจาก Google Sheets (Public) โดยใช้ gviz/tq endpoint
 * @param {string} sheetName - ชื่อ sheet
 * @returns {Promise<Array>} - array of objects
 */
async function fetchSheet(sheetName) {
  const url = `${CONFIG.BASE_URL}/${CONFIG.SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;

  const response = await fetch(url);
  const text = await response.text();

  // gviz response มี prefix ที่ต้องตัดออก
  const jsonText = text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const data = JSON.parse(jsonText);

  if (!data.table || !data.table.rows) return [];

  // ดึง column labels จาก gviz
  // กรณี parsedNumHeaders=2 → gviz รวม 2 header rows เป็น label เดียว (ชื่อยาวแปลกๆ)
  // เราจึงใช้ col.id (A, B, C...) แล้ว map เองจาก COLUMN_MAP แทน
  const cols = data.table.cols.map((c) => (c.label || c.id).trim());

  // กรองแถวที่ว่างทั้งแถวออก (แถว formula placeholder ที่ sheet ใส่ไว้)
  const rows = data.table.rows
    .filter((r) => r.c && r.c.some((cell) => cell && cell.v !== null && cell.v !== ""))
    .map((r) => {
      const obj = {};
      r.c.forEach((cell, i) => {
        if (cols[i] !== undefined) obj[cols[i]] = cell ? cell.v : null;
      });
      return obj;
    });

  return rows;
}

/**
 * cache ข้อมูลเพื่อไม่ต้องดึงซ้ำบ่อยๆ
 */
const _cache = {};

async function fetchSheetCached(sheetName) {
  if (_cache[sheetName]) return _cache[sheetName];
  const data = await fetchSheet(sheetName);
  _cache[sheetName] = data;
  return data;
}

function clearCache() {
  Object.keys(_cache).forEach((k) => delete _cache[k]);
}

/**
 * แปลง Google Date serial หรือ Date object เป็น JS Date
 */
function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  // Google gviz ส่งมาเป็น "Date(year,month,day)" string
  if (typeof val === "string" && val.startsWith("Date(")) {
    const parts = val.replace("Date(", "").replace(")", "").split(",").map(Number);
    return new Date(parts[0], parts[1], parts[2]);
  }
  const d = new Date(val);
  return isNaN(d) ? null : d;
}

/**
 * format วันที่เป็น YYYY-MM-DD
 */
function formatDate(date) {
  if (!date) return "";
  const d = parseDate(date);
  if (!d) return "";
  return d.toISOString().split("T")[0];
}

/**
 * format ตัวเลขเงิน
 */
function formatMoney(val) {
  if (val === null || val === undefined || isNaN(val)) return "฿0";
  return "฿" + Number(val).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * format เปอร์เซ็นต์
 */
function formatPercent(val) {
  if (val === null || val === undefined || isNaN(val)) return "0%";
  return Number(val).toFixed(1) + "%";
}
