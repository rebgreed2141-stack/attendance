let childrenData = {};
let teachers = [];

const REASONS = ["出席", "都合", "早退", "様子見", "熱", "咳", "下痢", "病院"];

// --- DOM ---
const tabInput = document.getElementById("tabInput");
const tabMonth = document.getElementById("tabMonth");

const screenInput = document.getElementById("screenInput");
const screenMonth = document.getElementById("screenMonth");

const dateInput = document.getElementById("dateInput");
const classSelect = document.getElementById("classSelect");
const teacherSelect = document.getElementById("teacherSelect");
const childList = document.getElementById("childList");

const presentCountEl = document.getElementById("presentCount");
const absentCountEl = document.getElementById("absentCount");

const viewHeader = document.getElementById("viewHeader");
const monthTable = document.getElementById("monthTable");

// --- init ---
(function setToday(){
  const d = new Date();
  dateInput.value = toYMD(d);
})();

init();

async function init(){
  await loadChildren();
  await loadTeachers();
  renderTeachers();
  wireEvents();
  // 初期は何も表示しない（クラス未選択）
}

function wireEvents(){
  // タブ切り替え
  tabInput.addEventListener("click", () => {
    tabInput.classList.add("active");
    tabMonth.classList.remove("active");
    screenInput.classList.remove("hidden");
    screenMonth.classList.add("hidden");
  });

  tabMonth.addEventListener("click", () => {
    tabMonth.classList.add("active");
    tabInput.classList.remove("active");
    screenMonth.classList.remove("hidden");
    screenInput.classList.add("hidden");
    renderMonthlyView(); // 月間表示は常に全体
  });

  // クラス変更：園児描画→保存済み反映→人数
  classSelect.addEventListener("change", () => {
    renderChildren();
    applySavedForSelectedDate();
    updateCounts();
    // クラス変更時は「自動保存しない」（保存したいのは出欠変更時）
  });

  // 日付変更：保存済み反映→人数
  dateInput.addEventListener("change", () => {
    applySavedForSelectedDate();
    updateCounts();
    // 日付変更時も「自動保存しない」
  });

  // 担任変更：自動保存
  teacherSelect.addEventListener("change", () => {
    autoSaveNow();
  });

  // 出欠変更（ラジオ）：自動保存＋人数
  childList.addEventListener("change", (e) => {
    if(e.target && e.target.matches('input[type="radio"]')){
      updateCounts();
      autoSaveNow();
    }
  });
}

async function loadChildren(){
  try{
    const res = await fetch("children.json");
    if(!res.ok) throw new Error("children.json");
    childrenData = await res.json();
  }catch(e){
    alert("children.json を読み込めませんでした");
    console.error(e);
  }
}

async function loadTeachers(){
  try{
    const res = await fetch("teachers.json");
    if(!res.ok) throw new Error("teachers.json");
    teachers = await res.json();
  }catch(e){
    alert("teachers.json を読み込めませんでした");
    console.error(e);
  }
}

function renderTeachers(){
  teacherSelect.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "担任を選択";
  teacherSelect.appendChild(opt0);

  (teachers || []).forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    teacherSelect.appendChild(opt);
  });
}

function renderChildren(){
  childList.innerHTML = "";
  const className = classSelect.value;
  if(!className) return;

  const names = childrenData[className];
  if(!Array.isArray(names)) return;

  names.forEach(name => childList.appendChild(createChildRow(className, name)));
}

function createChildRow(className, name){
  const row = document.createElement("div");
  row.className = "child-row";

  const nameDiv = document.createElement("div");
  nameDiv.className = "child-name";
  nameDiv.textContent = name;

  const group = document.createElement("div");
  group.className = "reason-group";

  const groupName = makeRadioGroupName(className, name);

  REASONS.forEach((r, idx) => {
    const label = document.createElement("label");
    label.className = "reason-item";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = groupName;
    radio.value = r;
    if(idx === 0) radio.checked = true; // デフォルト出席

    const span = document.createElement("span");
    span.textContent = r;

    label.appendChild(radio);
    label.appendChild(span);
    group.appendChild(label);
  });

  row.appendChild(nameDiv);
  row.appendChild(group);
  return row;
}

// --- counts ---
function updateCounts(){
  const className = classSelect.value;
  if(!className){
    presentCountEl.textContent = "0";
    absentCountEl.textContent = "0";
    return;
  }
  const names = childrenData[className];
  if(!Array.isArray(names) || names.length === 0){
    presentCountEl.textContent = "0";
    absentCountEl.textContent = "0";
    return;
  }

  // 入力画面の人数は「画面上の選択」を集計（未入力は出席デフォルト）
  let absent = 0;
  names.forEach(name => {
    const st = getStatusForChild(className, name) || "出席";
    if(st !== "出席") absent += 1;
  });
  const present = Math.max(0, names.length - absent);

  presentCountEl.textContent = String(present);
  absentCountEl.textContent = String(absent);
}

function getStatusForChild(className, name){
  const groupName = makeRadioGroupName(className, name);
  const checked = document.querySelector(`input[type="radio"][name="${cssEscape(groupName)}"]:checked`);
  return checked ? checked.value : "出席";
}

function setStatusForChild(className, name, status){
  const groupName = makeRadioGroupName(className, name);
  const val = REASONS.includes(status) ? status : "出席";
  const radios = document.querySelectorAll(`input[type="radio"][name="${cssEscape(groupName)}"]`);
  radios.forEach(r => r.checked = (r.value === val));
}

// --- auto save (localStorage) ---
function autoSaveNow(){
  const className = classSelect.value;
  if(!className) return;

  const dateStr = dateInput.value;
  if(!dateStr) return;

  // 日曜は保存しない
  if(isSunday(dateStr)) return;

  const names = childrenData[className] || [];
  if(!Array.isArray(names) || names.length === 0) return;

  const monthKey = monthKeyFromDate(dateStr);
  const data = loadMonthlyFromStorage(monthKey, className);

  // meta
  if(!data.meta) data.meta = {};
  data.meta.className = className;
  if(!data.meta.teacherByDate) data.meta.teacherByDate = {};
  data.meta.teacherByDate[dateStr] = (teacherSelect.value || "");

  // day
  if(!data.days) data.days = {};
  if(!data.days[dateStr]) data.days[dateStr] = {};
  names.forEach(name => {
    data.days[dateStr][name] = getStatusForChild(className, name) || "出席";
  });

  saveMonthlyToStorage(monthKey, className, data);
}

function applySavedForSelectedDate(){
  const className = classSelect.value;
  if(!className) return;

  const dateStr = dateInput.value;
  if(!dateStr) return;

  const monthKey = monthKeyFromDate(dateStr);
  const data = loadMonthlyFromStorage(monthKey, className);

  // 担任（その日があれば反映）
  const t = data?.meta?.teacherByDate?.[dateStr];
  if(typeof t === "string"){
    teacherSelect.value = t;
  }else{
    teacherSelect.value = "";
  }

  // 出欠（その日があれば反映。なければデフォルト出席のまま）
  const names = childrenData[className] || [];
  const dayMap = data?.days?.[dateStr];
  if(dayMap && typeof dayMap === "object"){
    names.forEach(name => {
      const st = dayMap[name] || "出席";
      setStatusForChild(className, name, st);
    });
  }else{
    // 未保存日は全員出席に戻す
    names.forEach(name => setStatusForChild(className, name, "出席"));
  }
}

function storageKey(monthKey, className){
  return `attendance_${monthKey}_${className}`;
}

function loadMonthlyFromStorage(monthKey, className){
  try{
    const raw = localStorage.getItem(storageKey(monthKey, className));
    if(!raw) return { meta:{}, days:{} };
    const obj = JSON.parse(raw);
    if(!obj || typeof obj !== "object") return { meta:{}, days:{} };
    if(!obj.meta) obj.meta = {};
    if(!obj.days) obj.days = {};
    return obj;
  }catch(_){
    return { meta:{}, days:{} };
  }
}

function saveMonthlyToStorage(monthKey, className, data){
  localStorage.setItem(storageKey(monthKey, className), JSON.stringify(data));
}

// --- monthly view (全体表示) ---
function renderMonthlyView(){
  const className = classSelect.value;
  const dateStr = dateInput.value;

  if(!className || !dateStr){
    viewHeader.textContent = "クラスと日付を選択してください";
    monthTable.innerHTML = "";
    return;
  }

  const monthKey = monthKeyFromDate(dateStr); // YYYY-MM
  const data = loadMonthlyFromStorage(monthKey, className);

  const year = Number(monthKey.slice(0,4));
  const month = Number(monthKey.slice(5,7));
  const lastDay = getLastDay(year, month);

  const names = childrenData[className] || [];
  const childcareDays = countChildcareDays(year, month);

  // 担任は「当日」の担任を表示（その日のmetaがあれば）
  const teacher = (data?.meta?.teacherByDate?.[dateStr] ?? teacherSelect.value ?? "") || "";

  // ヘッダー（和暦 / ○○組）
  const era = toWarekiYearMonth(year, month);
  const cls = `${className}組`;
  viewHeader.textContent = `${era}　${cls}　担任：${teacher}　保育日数：${childcareDays}`;

  // テーブル生成
  monthTable.innerHTML = "";

  const thead = document.createElement("thead");
  const trh = document.createElement("tr");

  const thName = document.createElement("th");
  thName.textContent = "園児";
  thName.className = "sticky-name th";
  trh.appendChild(thName);

  // 日付列（全体表示。日曜も列は作るが空白運用）
  for(let d=1; d<=lastDay; d++){
    const th = document.createElement("th");
    const ds = `${monthKey}-${String(d).padStart(2,"0")}`;
    const dow = dayOfWeek(ds);
    th.textContent = String(d);
    if(dow === 0) th.classList.add("sun-col");
    trh.appendChild(th);
  }

  // 右端（文字数を減らす）
  const thP = document.createElement("th");
  thP.textContent = "出席";
  thP.className = "right-total";
  trh.appendChild(thP);

  const thA = document.createElement("th");
  thA.textContent = "欠席";
  thA.className = "right-total";
  trh.appendChild(thA);

  thead.appendChild(trh);
  monthTable.appendChild(thead);

  const tbody = document.createElement("tbody");

  // 日別集計（保存データのみカウント。未入力はゼロ）
  const dailyPresent = new Array(lastDay).fill(0);
  const dailyAbsent = new Array(lastDay).fill(0);

  // 各園児行：セルは「保存されている文字列」をそのまま表示（出席も表示）
  names.forEach(name => {
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.textContent = name;
    tdName.className = "sticky-name";
    tr.appendChild(tdName);

    let pTotal = 0;
    let aTotal = 0;

    for(let d=1; d<=lastDay; d++){
      const td = document.createElement("td");
      const ds = `${monthKey}-${String(d).padStart(2,"0")}`;
      const dow = dayOfWeek(ds);

      if(dow === 0){
        td.classList.add("sun-col");
        td.textContent = ""; // 日曜は表示なし
      }else{
        const st = data?.days?.[ds]?.[name];
        if(!st){
          td.textContent = ""; // 未入力は空白（ゼロ扱い）
        }else{
          td.textContent = st; // そのまま表示（出席も表示）
          if(st === "出席"){
            pTotal += 1;
            dailyPresent[d-1] += 1;
          }else{
            aTotal += 1;
            dailyAbsent[d-1] += 1;
          }
        }
      }
      tr.appendChild(td);
    }

    const tdPT = document.createElement("td");
    tdPT.textContent = String(pTotal);
    tdPT.className = "right-total";
    tr.appendChild(tdPT);

    const tdAT = document.createElement("td");
    tdAT.textContent = String(aTotal);
    tdAT.className = "right-total";
    tr.appendChild(tdAT);

    tbody.appendChild(tr);
  });

  // フッター：園児名の下に「出席人数」「欠席人数」を1列（2行で表示）
  // 右端は月合計（保存分のみ）
  let monthPresentSum = 0;
  let monthAbsentSum = 0;

  const trP = document.createElement("tr");
  trP.className = "footer-row";

  const tdPLabel = document.createElement("td");
  tdPLabel.textContent = "出席人数";
  tdPLabel.className = "sticky-name";
  trP.appendChild(tdPLabel);

  for(let d=1; d<=lastDay; d++){
    const ds = `${monthKey}-${String(d).padStart(2,"0")}`;
    const dow = dayOfWeek(ds);
    const td = document.createElement("td");

    if(dow === 0){
      td.classList.add("sun-col");
      td.textContent = "";
    }else{
      const p = dailyPresent[d-1] || 0;
      td.textContent = String(p);
      monthPresentSum += p;
    }
    trP.appendChild(td);
  }

  const tdMP = document.createElement("td");
  tdMP.textContent = String(monthPresentSum);
  tdMP.className = "right-total";
  trP.appendChild(tdMP);

  const tdMP2 = document.createElement("td");
  tdMP2.textContent = ""; // 欠席列側は空白
  tdMP2.className = "right-total";
  trP.appendChild(tdMP2);

  const trA = document.createElement("tr");
  trA.className = "footer-row";

  const tdALabel = document.createElement("td");
  tdALabel.textContent = "欠席人数";
  tdALabel.className = "sticky-name";
  trA.appendChild(tdALabel);

  for(let d=1; d<=lastDay; d++){
    const ds = `${monthKey}-${String(d).padStart(2,"0")}`;
    const dow = dayOfWeek(ds);
    const td = document.createElement("td");

    if(dow === 0){
      td.classList.add("sun-col");
      td.textContent = "";
    }else{
      const a = dailyAbsent[d-1] || 0;
      td.textContent = String(a);
      monthAbsentSum += a;
    }
    trA.appendChild(td);
  }

  const tdMA1 = document.createElement("td");
  tdMA1.textContent = ""; // 出席列側は空白
  tdMA1.className = "right-total";
  trA.appendChild(tdMA1);

  const tdMA2 = document.createElement("td");
  tdMA2.textContent = String(monthAbsentSum);
  tdMA2.className = "right-total";
  trA.appendChild(tdMA2);

  tbody.appendChild(trP);
  tbody.appendChild(trA);

  monthTable.appendChild(tbody);
}

// --- date utils ---
function toYMD(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

function monthKeyFromDate(dateStr){
  return dateStr.slice(0,7); // YYYY-MM
}

function getLastDay(year, month){
  return new Date(year, month, 0).getDate();
}

function dayOfWeek(dateStr){
  const [y,m,d] = dateStr.split("-").map(Number);
  return new Date(y, m-1, d).getDay(); // 0=Sun
}

function isSunday(dateStr){
  return dayOfWeek(dateStr) === 0;
}

function countChildcareDays(year, month){
  const last = getLastDay(year, month);
  let c = 0;
  for(let d=1; d<=last; d++){
    const dow = new Date(year, month-1, d).getDay();
    if(dow !== 0) c += 1;
  }
  return c;
}

// --- wareki ---
function toWarekiYearMonth(year, month){
  const d = new Date(year, month-1, 1);
  const reiwaStart = new Date(2019, 4, 1);
  const heiseiStart = new Date(1989, 0, 8);

  let eraName = "";
  let eraYear = 0;

  if(d >= reiwaStart){
    eraName = "令和";
    eraYear = year - 2018;
  }else if(d >= heiseiStart){
    eraName = "平成";
    eraYear = year - 1988;
  }else{
    eraName = "西暦";
    eraYear = year;
  }

  const yStr = (eraName === "西暦") ? `${eraYear}年` : `${eraName}${eraYear}年`;
  return `${yStr}${month}月`;
}

// --- misc ---
function cssEscape(s){
  if(window.CSS && CSS.escape) return CSS.escape(s);
  return s.replace(/["\\]/g, "\\$&");
}

function makeRadioGroupName(className, name){
  const base = `${className}_${name}`;
  return "reason_" + base.replace(/[^\w\u3040-\u30FF\u4E00-\u9FFF]+/g, "_");
}
