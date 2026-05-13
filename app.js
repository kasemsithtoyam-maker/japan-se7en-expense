const STORAGE_EXPENSES = "japan_se7en_expenses";
const STORAGE_BALANCES = "japan_se7en_balances";

const $ = (id) => document.getElementById(id);

let currentRows = [];
let editingId = null;

function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getExpenses() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_EXPENSES) || "[]");
  } catch {
    return [];
  }
}

function saveExpenses() {
  localStorage.setItem(STORAGE_EXPENSES, JSON.stringify(currentRows));
}

function getBalances() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_BALANCES) || "{}");
  } catch {
    return {};
  }
}

function saveBalancesToStorage(data) {
  localStorage.setItem(STORAGE_BALANCES, JSON.stringify(data));
}

function loadBalances() {
  const b = getBalances();

  $("balYouTrip").value = b.youtrip ?? "";
  $("balKrungrsiJCB").value = b.krungsriJCB ?? "";
  $("balUOBVisa").value = b.uobVisa ?? "";
  $("tripStartDate").value = b.startDate || todayISO();
}

function saveBalances() {
  const data = {
    youtrip: Number($("balYouTrip").value || 0),
    krungsriJCB: Number($("balKrungrsiJCB").value || 0),
    uobVisa: Number($("balUOBVisa").value || 0),
    startDate: $("tripStartDate").value || todayISO(),
    updatedAt: Date.now()
  };

  saveBalancesToStorage(data);

  $("balanceSaved").textContent =
    "บันทึกยอดตั้งต้นแล้ว: " + new Date().toLocaleString();

  computeReconcile();
}

function loadExpenses() {
  currentRows = getExpenses();
  currentRows.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  render();
}

function addExpense() {
  const amount = Number($("amount").value || 0);

  if (!amount || amount <= 0) {
    alert("กรุณาใส่จำนวนเงิน");
    return;
  }

  const oldItem = editingId
    ? currentRows.find((x) => x.id === editingId)
    : null;

  const item = {
    id: editingId || String(Date.now()),
    date: $("date").value || todayISO(),
    category: $("category").value,
    method: $("method").value,
    amount: amount,
    currency: $("currency").value,
    rate: $("rate").value ? Number($("rate").value) : null,
    note: $("note").value.trim(),
    createdAt: oldItem?.createdAt || Date.now(),
    updatedAt: Date.now()
  };

  if (editingId) {
    currentRows = currentRows.map((x) =>
      x.id === editingId ? item : x
    );

    editingId = null;
    $("btnAdd").textContent = "บันทึก";
  } else {
    currentRows.unshift(item);
  }

  saveExpenses();

  $("amount").value = "";
  $("note").value = "";
  $("rate").value = "";
  $("date").value = todayISO();

  $("lastSaved").textContent =
    "บันทึกล่าสุด: " + new Date().toLocaleString();

  render();
}

function render() {
  const term = ($("search").value || "").toLowerCase();
  const currencyFilter = $("filterCurrency").value || "";

  const rows = currentRows.filter((r) => {
    const text = `${r.date} ${r.category} ${r.note} ${r.method} ${r.currency}`.toLowerCase();

    return (
      text.includes(term) &&
      (!currencyFilter || r.currency === currencyFilter)
    );
  });

  let thb = 0;
  let jpy = 0;

  $("tbody").innerHTML = rows
    .map((r) => {
      if (r.currency === "THB") thb += Number(r.amount || 0);
      if (r.currency === "JPY") jpy += Number(r.amount || 0);

      return `
        <tr>
          <td>${escapeHtml(r.date)}</td>
          <td>${escapeHtml(r.category)}</td>
          <td>${escapeHtml(r.note)}</td>
          <td>${escapeHtml(r.currency)}</td>
          <td class="num">
            ${Number(r.amount || 0).toLocaleString(undefined, {
              maximumFractionDigits: 2
            })}
          </td>
          <td>${escapeHtml(r.method)}</td>
          <td>
            <button
              class="btn secondary"
              style="width:auto;padding:6px 10px;font-size:12px"
              data-edit="${r.id}"
            >
              แก้ไข
            </button>

            <button
              class="btn danger"
              style="width:auto;padding:6px 10px;font-size:12px"
              data-delete="${r.id}"
            >
              ลบ
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  $("totals").textContent =
    `THB: ${thb.toLocaleString(undefined, {
      maximumFractionDigits: 2
    })} · JPY: ${jpy.toLocaleString()}`;

  $("liveStatus").textContent = `รายการทั้งหมด: ${currentRows.length}`;

  document.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.onclick = () => editExpense(btn.dataset.edit);
  });

  document.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.onclick = () => deleteExpense(btn.dataset.delete);
  });

  updateCategorySummary();
  computeReconcile();
}

function editExpense(id) {
  const item = currentRows.find((x) => x.id === id);
  if (!item) return;

  editingId = id;

  $("date").value = item.date || todayISO();
  $("category").value = item.category || "อาหาร";
  $("method").value = item.method || "Cash";
  $("amount").value = item.amount || "";
  $("currency").value = item.currency || "THB";
  $("rate").value = item.rate || "";
  $("note").value = item.note || "";

  $("btnAdd").textContent = "อัปเดต";

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function deleteExpense(id) {
  if (!confirm("ลบรายการนี้?")) return;

  currentRows = currentRows.filter((x) => x.id !== id);
  saveExpenses();
  render();
}

function clearAllData() {
  if (!confirm("ต้องการล้างข้อมูลทดสอบทั้งหมดในเครื่องนี้?")) return;

  localStorage.removeItem(STORAGE_EXPENSES);

  currentRows = [];
  editingId = null;

  $("btnAdd").textContent = "บันทึก";
  $("lastSaved").textContent =
    "ล้างข้อมูลแล้ว: " + new Date().toLocaleString();

  render();
}

function exportJSON() {
  const data = {
    exportedAt: new Date().toISOString(),
    mode: "localStorage",
    expenses: currentRows,
    balances: getBalances()
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

function sumMethodByDate(method, date) {
  return currentRows
    .filter((r) => r.date === date && r.method === method)
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);
}

function computeReconcile() {
  const b = getBalances();
  const date = $("reconcileDate").value || todayISO();

  const rows = [
    ["YouTrip", Number(b.youtrip || 0), sumMethodByDate("YouTrip", date)],
    ["Krungsri JCB", Number(b.krungsriJCB || 0), sumMethodByDate("Krungsri JCB", date)],
    ["UOB Visa", Number(b.uobVisa || 0), sumMethodByDate("UOB Visa", date)]
  ];

  $("reconcileTable").innerHTML = `
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
        ${rows
          .map(
            (r) => `
              <tr>
                <td>${r[0]}</td>
                <td class="num">
                  ${r[1].toLocaleString(undefined, {
                    maximumFractionDigits: 2
                  })}
                </td>
                <td class="num">
                  ${r[2].toLocaleString(undefined, {
                    maximumFractionDigits: 2
                  })}
                </td>
                <td class="num">
                  ${(r[1] - r[2]).toLocaleString(undefined, {
                    maximumFractionDigits: 2
                  })}
                </td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function updateCategorySummary() {
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
  Object.keys(budgets).forEach((k) => {
    spent[k] = 0;
  });

  currentRows.forEach((r) => {
    if (r.currency === "THB" && spent[r.category] !== undefined) {
      spent[r.category] += Number(r.amount || 0);
    }
  });

  $("categorySummary").innerHTML = Object.keys(budgets)
    .map((k) => {
      const used = spent[k] || 0;
      const budget = budgets[k];
      const pct = budget > 0 ? Math.min(100, (used / budget) * 100) : 0;
      const pctText =
        budget > 0 ? ((used / budget) * 100).toFixed(1) : "0.0";

      return `
        <div class="cat-row">
          <span class="cat-label">${k}</span>

          <div class="cat-bar">
            <div class="cat-bar-fill" style="width:${pct}%"></div>
          </div>

          <span class="cat-value">
            ${used.toFixed(0)} / ${budget.toFixed(0)} (${pctText}%)
          </span>
        </div>
      `;
    })
    .join("");
}

document.addEventListener("DOMContentLoaded", () => {
  $("syncBadge").textContent = "Mode: local";

  $("date").value = todayISO();
  $("reconcileDate").value = todayISO();
  $("tripStartDate").value = todayISO();

  $("btnAdd").onclick = addExpense;
  $("btnExport").onclick = exportJSON;
  $("btnClearAll").onclick = clearAllData;
  $("btnSaveBalances").onclick = saveBalances;
  $("btnRecalc").onclick = computeReconcile;

  $("search").oninput = render;
  $("filterCurrency").onchange = render;

  loadBalances();
  loadExpenses();
});
