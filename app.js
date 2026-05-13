const STORAGE_EXPENSES = "japan_se7en_expenses";
const STORAGE_BALANCES = "japan_se7en_balances";

const $ = (id) => document.getElementById(id);

const balYouTrip = $("balYouTrip");
const balKrungrsiJCB = $("balKrungrsiJCB");
const balUOBVisa = $("balUOBVisa");
const tripStartDate = $("tripStartDate");
const btnSaveBalances = $("btnSaveBalances");
const balanceSaved = $("balanceSaved");
const syncBadge = $("syncBadge");

const dateEl = $("date");
const categoryEl = $("category");
const methodEl = $("method");
const amountEl = $("amount");
const currencyEl = $("currency");
const rateEl = $("rate");
const noteEl = $("note");
const btnAdd = $("btnAdd");
const btnExport = $("btnExport");
const tbody = $("tbody");
const totals = $("totals");
const liveStatus = $("liveStatus");
const searchEl = $("search");
const filterCurrency = $("filterCurrency");
const lastSaved = $("lastSaved");

const reconcileDate = $("reconcileDate");
const btnRecalc = $("btnRecalc");
const reconcileTable = $("reconcileTable");
const categorySummary = $("categorySummary");

let currentRows = [];
let editingId = null;

function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function setSyncBadge(text) {
  if (syncBadge) syncBadge.textContent = `Mode: local`;
}

function loadExpenses() {
  currentRows = JSON.parse(localStorage.getItem(STORAGE_EXPENSES) || "[]");
  currentRows.sort((a, b) => b.createdAt - a.createdAt);
  render();
}

function saveExpenses() {
  localStorage.setItem(STORAGE_EXPENSES, JSON.stringify(currentRows));
}

function loadBalances() {
  const b = JSON.parse(localStorage.getItem(STORAGE_BALANCES) || "{}");

  if (balYouTrip) balYouTrip.value = b.youtrip ?? "";
  if (balKrungrsiJCB) balKrungrsiJCB.value = b.krungsriJCB ?? "";
  if (balUOBVisa) balUOBVisa.value = b.uobVisa ?? "";
  if (tripStartDate) tripStartDate.value = b.startDate || todayISO();
}

function saveBalances() {
  const b = {
    youtrip: Number(balYouTrip?.value || 0),
    krungsriJCB: Number(balKrungrsiJCB?.value || 0),
    uobVisa: Number(balUOBVisa?.value || 0),
    startDate: tripStartDate?.value || todayISO(),
    updatedAt: Date.now()
  };

  localStorage.setItem(STORAGE_BALANCES, JSON.stringify(b));

  if (balanceSaved) {
    balanceSaved.textContent = "บันทึกยอดตั้งต้นแล้ว: " + new Date().toLocaleString();
  }

  computeReconcile();
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function render() {
  const term = (searchEl?.value || "").toLowerCase();
  const fc = filterCurrency?.value || "";

  const rows = currentRows.filter((r) => {
    const hit = `${r.date} ${r.category} ${r.note} ${r.method} ${r.currency}`
      .toLowerCase()
      .includes(term);

    const money = !fc || r.currency === fc;
    return hit && money;
  });

  let thb = 0;
  let jpy = 0;

  if (tbody) {
    tbody.innerHTML = rows.map((r) => {
      if (r.currency === "THB") thb += Number(r.amount || 0);
      if (r.currency === "JPY") jpy += Number(r.amount || 0);

      return `
        <tr>
          <td>${r.date || ""}</td>
          <td>${escapeHtml(r.category)}</td>
          <td>${escapeHtml(r.note)}</td>
          <td>${escapeHtml(r.currency)}</td>
          <td class="num">${Number(r.amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
          <td>${escapeHtml(r.method)}</td>
          <td>
            <button class="btn secondary" style="width:auto;padding:6px 10px;font-size:12px" onclick="editExpense('${r.id}')">แก้ไข</button>
            <button class="btn danger" style="width:auto;padding:6px 10px;font-size:12px" onclick="deleteExpense('${r.id}')">ลบ</button>
          </td>
        </tr>
      `;
    }).join("");
  }

  if (totals) {
    totals.textContent =
      `THB: ${thb.toLocaleString(undefined, { maximumFractionDigits: 2 })} · JPY: ${jpy.toLocaleString()}`;
  }

  if (liveStatus) {
    liveStatus.textContent = `รายการทั้งหมด: ${currentRows.length}`;
  }

  updateCategorySummary();
  computeReconcile();
}

function addExpense() {
  const amount = Number(amountEl?.value || 0);

  if (!amount || amount <= 0) {
    alert("กรุณาใส่จำนวนเงิน");
    return;
  }

  const payload = {
    id: editingId || String(Date.now()),
    date: dateEl?.value || todayISO(),
    category: categoryEl?.value || "อื่นๆ",
    method: methodEl?.value || "Cash",
    amount: amount,
    currency: currencyEl?.value || "THB",
    rate: rateEl?.value ? Number(rateEl.value) : null,
    note: noteEl?.value.trim() || "",
    createdAt: editingId
      ? (currentRows.find((x) => x.id === editingId)?.createdAt || Date.now())
      : Date.now(),
    updatedAt: Date.now()
  };

  if (editingId) {
    currentRows = currentRows.map((x) => x.id === editingId ? payload : x);
    editingId = null;
    btnAdd.textContent = "บันทึก";
  } else {
    currentRows.unshift(payload);
  }

  saveExpenses();
  render();

  if (amountEl) amountEl.value = "";
  if (noteEl) noteEl.value = "";
  if (rateEl) rateEl.value = "";
  if (dateEl) dateEl.value = todayISO();

  if (lastSaved) {
    lastSaved.textContent = "บันทึกล่าสุด: " + new Date().toLocaleString();
  }
}

window.editExpense = function(id) {
  const item = currentRows.find((x) => x.id === id);
  if (!item) return;

  editingId = id;

  if (dateEl) dateEl.value = item.date || todayISO();
  if (categoryEl) categoryEl.value = item.category || "อื่นๆ";
  if (methodEl) methodEl.value = item.method || "Cash";
  if (amountEl) amountEl.value = item.amount || "";
  if (currencyEl) currencyEl.value = item.currency || "THB";
  if (rateEl) rateEl.value = item.rate || "";
  if (noteEl) noteEl.value = item.note || "";

  if (btnAdd) btnAdd.textContent = "อัปเดต";
  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.deleteExpense = function(id) {
  if (!confirm("ลบรายการนี้?")) return;
  currentRows = currentRows.filter((x) => x.id !== id);
  saveExpenses();
  render();
};

function exportJSON() {
  const data = {
    exportedAt: new Date().toISOString(),
    mode: "localStorage",
    expenses: currentRows,
    balances: JSON.parse(localStorage.getItem(STORAGE_BALANCES) || "{}")
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `japan-se7en-expenses-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function computeReconcile() {
  if (!reconcileTable) return;

  const b = JSON.parse(localStorage.getItem(STORAGE_BALANCES) || "{}");
  const selectedDate = reconcileDate?.value || todayISO();

  function sumMethod(methodName) {
    return currentRows
      .filter((r) => r.date === selectedDate && r.method === methodName)
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);
  }

  const rows = [
    ["YouTrip", Number(b.youtrip || 0), sumMethod("YouTrip")],
    ["Krungsri JCB", Number(b.krungsriJCB || 0), sumMethod("Krungsri JCB")],
    ["UOB Visa", Number(b.uobVisa || 0), sumMethod("UOB Visa")]
  ];

  reconcileTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>บัตร</th>
          <th>ยอดตั้งต้น</th>
          <th>ใช้ไปวันนี้</th>
          <th>ควรคงเหลือ</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r) => `
          <tr>
            <td>${r[0]}</td>
            <td class="num">${r[1].toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
            <td class="num">${r[2].toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
            <td class="num">${(r[1] - r[2]).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function updateCategorySummary() {
  if (!categorySummary) return;

  const budgets = {
    "อาหาร": 10000,
    "เดินทาง": 10000,
    "ของเล่น": 20000,
    "เสื้อผ้า": 10000,
    "น้ำหอม": 10000,
    "iqos": 10000,
    "ของฝาก": 10000,
    "อื่นๆ": 10000
  };

  const spent = {};
  Object.keys(budgets).forEach((k) => spent[k] = 0);

  currentRows.forEach((r) => {
    if (r.currency === "THB" && spent[r.category] !== undefined) {
      spent[r.category] += Number(r.amount || 0);
    }
  });

  categorySummary.innerHTML = Object.keys(budgets).map((k) => {
    const used = spent[k] || 0;
    const budget = budgets[k];
    const pct = Math.min(100, (used / budget) * 100);

    return `
      <div class="cat-row">
        <span class="cat-label">${k}</span>
        <div class="cat-bar">
          <div class="cat-bar-fill" style="width:${pct}%"></div>
        </div>
        <span class="cat-value">${used.toFixed(0)} / ${budget.toFixed(0)}</span>
      </div>
    `;
  }).join("");
}

function clearTestData() {
  if (!confirm("ต้องการล้างข้อมูลทั้งหมดในเครื่องนี้?")) return;
  localStorage.removeItem(STORAGE_EXPENSES);
  currentRows = [];
  render();
}

document.addEventListener("DOMContentLoaded", () => {
  setSyncBadge("local");

  if (dateEl) dateEl.value = todayISO();
  if (reconcileDate) reconcileDate.value = todayISO();

  loadBalances();
  loadExpenses();

  if (btnAdd) btnAdd.onclick = addExpense;
  if (btnExport) btnExport.onclick = exportJSON;
  if (btnSaveBalances) btnSaveBalances.onclick = saveBalances;
  if (btnRecalc) btnRecalc.onclick = computeReconcile;

  if (searchEl) searchEl.oninput = render;
  if (filterCurrency) filterCurrency.onchange = render;

  const clearBtn = document.querySelector(".btn.danger");
  if (clearBtn && clearBtn.textContent.includes("ล้างข้อมูล")) {
    clearBtn.onclick = clearTestData;
  }
});
