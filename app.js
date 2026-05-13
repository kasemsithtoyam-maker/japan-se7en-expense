// ===== 1) ใส่ค่า Firebase ของคุณที่นี่ =====
    const firebaseConfig = {
      apiKey: "__YOUR_API_KEY__",
      authDomain: "__YOUR_PROJECT_ID__.firebaseapp.com",
      projectId: "__YOUR_PROJECT_ID__",
      storageBucket: "__YOUR_PROJECT_ID__.appspot.com",
      messagingSenderId: "__YOUR_SENDER_ID__",
      appId: "__YOUR_APP_ID__"
    };

    import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
    import { getFirestore, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, enableIndexedDbPersistence, doc, deleteDoc, updateDoc, getDocs, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    // Offline Persistence
    enableIndexedDbPersistence(db).catch((err)=>{ console.warn('Persistence error:', err.code); });

    // ===== DOM =====
    const balanceCard = document.getElementById('balanceCard');
    const entryCard = document.getElementById('entryCard');
    const listCard = document.getElementById('listCard');
    const reconcileCard = document.getElementById('reconcileCard');

    const balYouTrip = document.getElementById('balYouTrip');
    const balKrungrsiJCB = document.getElementById('balKrungrsiJCB');
    const balUOBVisa = document.getElementById('balUOBVisa');
    const tripStartDate = document.getElementById('tripStartDate');
    const btnSaveBalances = document.getElementById('btnSaveBalances');
    const balanceSaved = document.getElementById('balanceSaved');
    const syncBadge = document.getElementById('syncBadge');

    const dateEl = document.getElementById('date');
    const categoryEl = document.getElementById('category');
    const methodEl = document.getElementById('method');
    const amountEl = document.getElementById('amount');
    const currencyEl = document.getElementById('currency');
    const rateEl = document.getElementById('rate');
    const noteEl = document.getElementById('note');
    const btnAdd = document.getElementById('btnAdd');
    const btnExport = document.getElementById('btnExport');
    const tbody = document.getElementById('tbody');
    const totals = document.getElementById('totals');
    const liveStatus = document.getElementById('liveStatus');
    const searchEl = document.getElementById('search');
    const filterCurrency = document.getElementById('filterCurrency');
    const lastSaved = document.getElementById('lastSaved');

    const reconcileDate = document.getElementById('reconcileDate');
    const btnRecalc = document.getElementById('btnRecalc');
    const reconcileTable = document.getElementById('reconcileTable');

    // Default today
    const today = new Date();
    dateEl.valueAsDate = today;
    reconcileDate.valueAsDate = today;

    let unsub = null; // snapshot unsubscribe
    let selectedEmail = "wr.tarantura.4502@gmail.com"; // iPad main profile
    let currentRows = [];

    // iPad-only mode: skip email selection screen
    function showAppUI(){
      balanceCard.style.display = 'block';
      entryCard.style.display = 'block';
      listCard.style.display = 'block';
      reconcileCard.style.display = 'block';
    }

    function refCol(){ return collection(db, `profiles/${selectedEmail}/expenses`); }
    function refBalancesDoc(){ return doc(db, `profiles/${selectedEmail}/settings/balances`); }

    // iPad-only mode: auto start app
    bindExpensesListener();
    loadBalances();
    showAppUI();

    function setSyncBadge(text){ syncBadge.textContent = `Sync: ${text}`; }

    async function bindExpensesListener(){
      if(!selectedEmail) return;
      if(unsub) unsub();
      const q = query(refCol(), orderBy('createdAt','desc')); // iPad fix: รองรับ 30+ รายการ/วัน และลดปัญหา composite index
      setSyncBadge('connecting…');
      unsub = onSnapshot(q, (snap)=>{
        currentRows = [];
        snap.forEach(doc=> currentRows.push({ id: doc.id, ...doc.data() }));
        render(currentRows);
        setSyncBadge('online');
        liveStatus.textContent = `รายการทั้งหมด: ${currentRows.length}`;
        computeReconcile();
      },(err)=>{
        console.error(err); setSyncBadge('error');
      });
    }

    function render(rowsSource){
      const term = (searchEl.value||'').toLowerCase();
      const fc = filterCurrency.value;
      const rows = rowsSource.filter(r=>{
        const hit = `${r.category} ${r.note||''} ${r.method} ${r.currency}`.toLowerCase().includes(term);
        const money = !fc || r.currency===fc;
        return hit && money;
      });
      let thb=0, jpy=0;
      tbody.innerHTML = rows.map(r=>{
        if(r.currency==='THB') thb += Number(r.amount||0);
        if(r.currency==='JPY') jpy += Number(r.amount||0);
        const d = r.date ? new Date(r.date).toISOString().slice(0,10) : '';
        return `<tr>
          <td>${d}</td>
          <td>${r.category||''}</td>
          <td>${(r.note||'').replace(/</g,'&lt;')}</td>
          <td>${r.currency}</td>
          <td class="num">${Number(r.amount||0).toLocaleString(undefined,{maximumFractionDigits:2})}</td>
          <td>${r.method||''}</td>
          <td>
            <button data-id="${r.id}" class="btn secondary" style="width:auto;padding:6px 10px;font-size:12px">แก้ไข</button>
            <button data-del="${r.id}" class="btn danger" style="width:auto;padding:6px 10px;font-size:12px">ลบ</button>
          </td>
        </tr>`
      }).join('');
      totals.textContent = `THB: ${thb.toLocaleString(undefined,{maximumFractionDigits:2})} · JPY: ${jpy.toLocaleString()}`;

      tbody.querySelectorAll('button[data-del]').forEach(btn=>{
        btn.onclick = async ()=>{
          if(confirm('ลบรายการนี้?')){
            await deleteDoc(doc(db, `profiles/${selectedEmail}/expenses/${btn.dataset.del}`));
          }
        }
      });
      tbody.querySelectorAll('button[data-id]').forEach(btn=>{
        btn.onclick = ()=> startEdit(btn.dataset.id, rowsSource);
      });

      searchEl.oninput = ()=> render(rowsSource);
      filterCurrency.onchange = ()=> render(rowsSource);
      updateCategorySummary(rowsSource);
    }

    async function startEdit(id, rowsSource){
      const item = rowsSource.find(x=>x.id===id);
      if(!item) return;
      dateEl.value = item.date ? new Date(item.date).toISOString().slice(0,10) : '';
      categoryEl.value = item.category||'อื่นๆ';
      methodEl.value = item.method||'Other';
      amountEl.value = item.amount||'';
      currencyEl.value = item.currency||'THB';
      rateEl.value = item.rate||'';
      noteEl.value = item.note||'';
      btnAdd.textContent = 'อัปเดต';
      btnAdd.dataset.editing = id;
      window.scrollTo({top:0,behavior:'smooth'});
    }

    btnAdd.onclick = async ()=>{
      if(!selectedEmail){ alert('ยังไม่ได้เลือกอีเมล'); return; }
      const payload = {
        date: dateEl.value ? new Date(dateEl.value).getTime() : null,
        category: categoryEl.value,
        method: methodEl.value,
        amount: Number(amountEl.value||0),
        currency: currencyEl.value,
        rate: rateEl.value ? Number(rateEl.value) : null,
        note: noteEl.value.trim(),
        updatedAt: serverTimestamp(),
      };
      try{
        setSyncBadge('saving…');
        if(btnAdd.dataset.editing){
          await updateDoc(doc(db, `profiles/${selectedEmail}/expenses/${btnAdd.dataset.editing}`), payload);
          btnAdd.textContent = 'บันทึก';
          delete btnAdd.dataset.editing;
        } else {
          await addDoc(refCol(), { ...payload, createdAt: serverTimestamp() });
        }
        lastSaved.textContent = 'บันทึกล่าสุด: ' + new Date().toLocaleString();
        
        // ล้างค่า form หลังบันทึก
        amountEl.value = '';
        noteEl.value = '';
        rateEl.value = '';

        categoryEl.selectedIndex = 0;
        methodEl.selectedIndex = 0;
        currencyEl.selectedIndex = 0;

        dateEl.valueAsDate = new Date();

        setSyncBadge('online');
      }catch(e){
        console.error(e); setSyncBadge('error'); alert('บันทึกไม่สำเร็จ: '+e.message);
      }
    };

    btnExport.onclick = async ()=>{
      if(!selectedEmail) return;
      const snap = await getDocs(refCol());
      const data = snap.docs.map(d=>({ id:d.id, ...d.data() }));
      const blob = new Blob([JSON.stringify({email: selectedEmail, exportedAt: Date.now(), data}, null, 2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `expenses_${selectedEmail}_${new Date().toISOString().slice(0,10)}.json`;
      a.click(); URL.revokeObjectURL(url);
    };

    async function loadBalances(){
      if(!selectedEmail) return;
      try{
        const docSnap = await getDoc(refBalancesDoc());
        if(docSnap.exists()){
          const d = docSnap.data();
          balYouTrip.value = d.youtrip ?? "";
          balKrungrsiJCB.value = d.krungsriJCB ?? "";
          balUOBVisa.value = d.uobVisa ?? "";
          if(d.startDate) tripStartDate.valueAsDate = new Date(d.startDate);
        } else {
          balYouTrip.value = "";
          balKrungrsiJCB.value = "";
          balUOBVisa.value = "";
          tripStartDate.valueAsDate = today;
        }
      } catch(e){
        console.error(e);
      }
    }

    btnSaveBalances.onclick = async ()=>{
      if(!selectedEmail) return;
      try{
        setSyncBadge('saving…');
        await setDoc(refBalancesDoc(), {
          youtrip: balYouTrip.value ? Number(balYouTrip.value) : null,
          krungsriJCB: balKrungrsiJCB.value ? Number(balKrungrsiJCB.value) : null,
          uobVisa: balUOBVisa.value ? Number(balUOBVisa.value) : null,
          startDate: tripStartDate.value ? new Date(tripStartDate.value).getTime() : null,
          updatedAt: serverTimestamp()
        }, { merge: true });
        balanceSaved.textContent = 'บันทึกยอดตั้งต้นแล้ว: ' + new Date().toLocaleString();
        setSyncBadge('online');
        computeReconcile();
      } catch(e){
        console.error(e); setSyncBadge('error'); alert('ไม่สามารถบันทึกยอดตั้งต้น: ' + e.message);
      }
    };

    btnRecalc.onclick = computeReconcile;

    function sumByMethod(rows, methodName, dayStart, dayEnd){
      return rows.reduce((acc, r)=>{
        if(r.method===methodName && typeof r.date==='number' && r.date>=dayStart && r.date<dayEnd){
          acc += Number(r.amount||0);
        }
        return acc;
      }, 0);
    }

    async function computeReconcile(){
      if(!selectedEmail){ reconcileTable.innerHTML = ''; return; }
      let youtrip=0, kr=0, uob=0;
      try{
        const snap = await getDoc(refBalancesDoc());
        if(snap.exists()){
          const d = snap.data();
          youtrip = Number(d.youtrip||0);
          kr = Number(d.krungsriJCB||0);
          uob = Number(d.uobVisa||0);
        }
      }catch(e){ console.error(e); }

      const d = reconcileDate.value ? new Date(reconcileDate.value) : today;
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + 24*60*60*1000;

      const sYou = sumByMethod(currentRows, 'YouTrip', dayStart, dayEnd);
      const sKr = sumByMethod(currentRows, 'Krungsri JCB', dayStart, dayEnd);
      const sUob = sumByMethod(currentRows, 'UOB Visa', dayStart, dayEnd);

      const rows = [
        ['YouTrip', youtrip, sYou, youtrip - sYou],
        ['Krungsri JCB', kr, sKr, kr - sKr],
        ['UOB Visa', uob, sUob, uob - sUob],
      ];

      const html = `
        <table>
          <thead>
            <tr><th>บัตร</th><th>ยอดตั้งต้น (THB)</th><th>ใช้ไปวันนี้ (THB)</th><th>ควรคงเหลือ (THB)</th></tr>
          </thead>
          <tbody>
            ${rows.map(r=>`<tr>
              <td>${r[0]}</td>
              <td class="num">${r[1].toLocaleString(undefined,{maximumFractionDigits:2})}</td>
              <td class="num">${r[2].toLocaleString(undefined,{maximumFractionDigits:2})}</td>
              <td class="num">${r[3].toLocaleString(undefined,{maximumFractionDigits:2})}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      `;
      reconcileTable.innerHTML = html;
      updateCategorySummary(currentRows || []);
    }

    function updateCategorySummary(rows){
      const budgets = {
        "อาหาร":10000,"เดินทาง":10000,"ของเล่น":20000,
        "เสื้อผ้า":10000,"น้ำหอม":10000,"iqos":10000,
        "ของฝาก":10000,"อื่นๆ":10000
      };
      const spent={};
      Object.keys(budgets).forEach(k=>spent[k]=0);

      rows.forEach(r=>{
        if(r.currency==="THB" && spent[r.category]!==undefined){
          spent[r.category]+=Number(r.amount||0);
        }
      });

      let html = "";
      Object.keys(budgets).forEach(k=>{
        const used = spent[k] || 0;
        const budget = budgets[k];
        const pct = budget > 0 ? Math.min(100, (used / budget) * 100) : 0;
        const pctText = budget > 0 ? (used / budget * 100).toFixed(1) : "0.0";
        html += `
          <div class="cat-row">
            <span class="cat-label">${k}</span>
            <div class="cat-bar">
              <div class="cat-bar-fill" style="width:${pct}%"></div>
            </div>
            <span class="cat-value">${used.toFixed(0)} / ${budget.toFixed(0)} (${pctText}%)</span>
          </div>
        `;
      });

      const box=document.getElementById("categorySummary");
      if(box) box.innerHTML = html;
    }
