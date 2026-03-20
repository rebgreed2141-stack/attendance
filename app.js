let childrenData = {};
let teachers = [];

const REASONS = ["出席", "都合", "早退", "様子見", "熱", "咳", "下痢", "病院"];
const STORAGE_PREFIX = "attendance_";
const BACKUP_ZIP_NAME = "attendance_backup_2025.zip";
const CLASS_FILE_MAP = {
  "もみじ": "momiji",
  "どんぐり": "donguri",
  "こぐま": "koguma",
  "りす": "risu",
  "のうさぎ": "nousagi",
  "かもしか": "kamoshika"
};
const FILE_CLASS_MAP = Object.fromEntries(
  Object.entries(CLASS_FILE_MAP).map(([jp, en]) => [en, jp])
);
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAME_MAP = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12
};
const WEEKDAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

const tabInput = document.getElementById("tabInput");
const tabMonth = document.getElementById("tabMonth");
const tabManage = document.getElementById("tabManage");

const screenInput = document.getElementById("screenInput");
const screenMonth = document.getElementById("screenMonth");
const screenManage = document.getElementById("screenManage");

const dateInput = document.getElementById("dateInput");
const classSelect = document.getElementById("classSelect");
const teacherSelect = document.getElementById("teacherSelect");
const childList = document.getElementById("childList");

const presentCountEl = document.getElementById("presentCount");
const absentCountEl = document.getElementById("absentCount");
const viewHeader = document.getElementById("viewHeader");
const monthTable = document.getElementById("monthTable");

const backupBtn = document.getElementById("backupBtn");
const restoreBtn = document.getElementById("restoreBtn");
const deleteBtn = document.getElementById("deleteBtn");
const restoreFileInput = document.getElementById("restoreFileInput");
const manageMessage = document.getElementById("manageMessage");

(function setToday() {
  dateInput.value = getDefaultWorkDate();
})();

init();

async function init() {
  await loadChildren();
  await loadTeachers();
  renderTeachers();
  wireEvents();
}

function wireEvents() {
  tabInput.addEventListener("click", () => showScreen("input"));
  tabMonth.addEventListener("click", () => {
    showScreen("month");
    renderMonthlyView();
  });
  tabManage.addEventListener("click", () => showScreen("manage"));

  classSelect.addEventListener("change", () => {
    renderChildren();
    applySavedForSelectedDate();
    updateCounts();
    autoSaveNow();
    if (!screenMonth.classList.contains("hidden")) {
      renderMonthlyView();
    }
  });

  dateInput.addEventListener("change", () => {
    applySavedForSelectedDate();
    updateCounts();
    autoSaveNow();
    if (!screenMonth.classList.contains("hidden")) {
      renderMonthlyView();
    }
  });

  teacherSelect.addEventListener("change", () => {
    autoSaveNow();
    if (!screenMonth.classList.contains("hidden")) {
      renderMonthlyView();
    }
  });

  childList.addEventListener("change", (e) => {
    if (e.target && e.target.matches('input[type="radio"]')) {
      updateCounts();
      autoSaveNow();
      if (!screenMonth.classList.contains("hidden")) {
        renderMonthlyView();
      }
    }
  });

  backupBtn.addEventListener("click", handleBackup);
  restoreBtn.addEventListener("click", () => restoreFileInput.click());
  restoreFileInput.addEventListener("change", handleRestoreFile);
  deleteBtn.addEventListener("click", handleDeleteAllAttendance);
}

function showScreen(screenName) {
  const activeMap = {
    input: tabInput,
    month: tabMonth,
    manage: tabManage
  };

  [tabInput, tabMonth, tabManage].forEach((tab) => tab.classList.remove("active"));
  activeMap[screenName].classList.add("active");

  screenInput.classList.toggle("hidden", screenName !== "input");
  screenMonth.classList.toggle("hidden", screenName !== "month");
  screenManage.classList.toggle("hidden", screenName !== "manage");
}

async function loadChildren() {
  try {
    const res = await fetch("./children.json", { cache: "no-store" });
    if (!res.ok) throw new Error("children.json");
    childrenData = await res.json();
  } catch (e) {
    alert("children.json を読み込めませんでした");
    console.error(e);
  }
}

async function loadTeachers() {
  try {
    const res = await fetch("./teachers.json", { cache: "no-store" });
    if (!res.ok) throw new Error("teachers.json");
    teachers = await res.json();
  } catch (e) {
    alert("teachers.json を読み込めませんでした");
    console.error(e);
  }
}

function renderTeachers() {
  teacherSelect.innerHTML = "";

  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "担任を選択";
  teacherSelect.appendChild(opt0);

  (teachers || []).forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    teacherSelect.appendChild(opt);
  });
}

function renderChildren() {
  childList.innerHTML = "";
  const className = classSelect.value;
  if (!className) return;

  const names = childrenData[className];
  if (!Array.isArray(names)) return;

  names.forEach((name) => childList.appendChild(createChildRow(className, name)));
}

function createChildRow(className, name) {
  const row = document.createElement("div");
  row.className = "child-row";

  const nameDiv = document.createElement("div");
  nameDiv.className = "child-name";
  nameDiv.textContent = name;

  const group = document.createElement("div");
  group.className = "reason-group";
  const groupName = makeRadioGroupName(className, name);

  REASONS.forEach((reason, idx) => {
    const label = document.createElement("label");
    label.className = "reason-item";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = groupName;
    radio.value = reason;
    if (idx === 0) radio.checked = true;

    const span = document.createElement("span");
    span.textContent = reason;

    label.appendChild(radio);
    label.appendChild(span);
    group.appendChild(label);
  });

  row.appendChild(nameDiv);
  row.appendChild(group);
  return row;
}

function updateCounts() {
  const className = classSelect.value;
  if (!className) {
    presentCountEl.textContent = "0";
    absentCountEl.textContent = "0";
    return;
  }

  const names = childrenData[className] || [];
  if (names.length === 0) {
    presentCountEl.textContent = "0";
    absentCountEl.textContent = "0";
    return;
  }

  let absent = 0;
  names.forEach((name) => {
    const st = getStatusForChild(className, name) || "出席";
    if (st !== "出席") absent += 1;
  });

  presentCountEl.textContent = String(Math.max(0, names.length - absent));
  absentCountEl.textContent = String(absent);
}

function getStatusForChild(className, name) {
  const groupName = makeRadioGroupName(className, name);
  const checked = document.querySelector(`input[type="radio"][name="${cssEscape(groupName)}"]:checked`);
  return checked ? checked.value : "出席";
}

function setStatusForChild(className, name, status) {
  const groupName = makeRadioGroupName(className, name);
  const safeStatus = REASONS.includes(status) ? status : "出席";
  const radios = document.querySelectorAll(`input[type="radio"][name="${cssEscape(groupName)}"]`);
  radios.forEach((radio) => {
    radio.checked = radio.value === safeStatus;
  });
}

function autoSaveNow() {
  const className = classSelect.value;
  const dateStr = dateInput.value;
  if (!className || !dateStr) return;
  if (isSunday(dateStr)) return;

  const names = childrenData[className] || [];
  if (names.length === 0) return;

  const monthKey = monthKeyFromDate(dateStr);
  const data = loadMonthlyFromStorage(monthKey, className);

  if (!data.meta) data.meta = {};
  if (!data.meta.teacherByDate) data.meta.teacherByDate = {};
  if (!data.days) data.days = {};
  if (!data.days[dateStr]) data.days[dateStr] = {};

  data.meta.className = className;
  data.meta.teacherByDate[dateStr] = teacherSelect.value || "";

  names.forEach((name) => {
    data.days[dateStr][name] = getStatusForChild(className, name) || "出席";
  });

  saveMonthlyToStorage(monthKey, className, data);
}

function applySavedForSelectedDate() {
  const className = classSelect.value;
  const dateStr = dateInput.value;
  if (!className || !dateStr) return;

  const monthKey = monthKeyFromDate(dateStr);
  const data = loadMonthlyFromStorage(monthKey, className);
  const names = childrenData[className] || [];

  const teacher = data?.meta?.teacherByDate?.[dateStr];
  teacherSelect.value = typeof teacher === "string" ? teacher : "";

  const dayMap = data?.days?.[dateStr];
  if (dayMap && typeof dayMap === "object") {
    names.forEach((name) => {
      setStatusForChild(className, name, dayMap[name] || "出席");
    });
  } else {
    names.forEach((name) => setStatusForChild(className, name, "出席"));
  }
}

function storageKey(monthKey, className) {
  return `${STORAGE_PREFIX}${monthKey}_${className}`;
}

function loadMonthlyFromStorage(monthKey, className) {
  try {
    const raw = localStorage.getItem(storageKey(monthKey, className));
    if (!raw) return { meta: {}, days: {} };
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return { meta: {}, days: {} };
    if (!obj.meta) obj.meta = {};
    if (!obj.days) obj.days = {};
    return obj;
  } catch (_error) {
    return { meta: {}, days: {} };
  }
}

function saveMonthlyToStorage(monthKey, className, data) {
  localStorage.setItem(storageKey(monthKey, className), JSON.stringify(data));
}

function renderMonthlyView() {
  const className = classSelect.value;
  const dateStr = dateInput.value;

  if (!className || !dateStr) {
    viewHeader.textContent = "クラスと日付を選択してください";
    monthTable.innerHTML = "";
    return;
  }

  const monthKey = monthKeyFromDate(dateStr);
  const data = loadMonthlyFromStorage(monthKey, className);
  const year = Number(dateStr.slice(0, 4));
  const month = Number(dateStr.slice(5, 7));
  const lastDay = getLastDay(year, month);
  const names = childrenData[className] || [];
  const childcareDays = countChildcareDays(year, month);
  const teacher = data?.meta?.teacherByDate?.[dateStr] ?? teacherSelect.value ?? "";

  viewHeader.textContent = `${toWarekiYearMonth(year, month)}　${className}組　担任：${teacher}　保育日数：${childcareDays}`;
  monthTable.innerHTML = "";

  const thead = document.createElement("thead");
  const trh = document.createElement("tr");

  const thName = document.createElement("th");
  thName.textContent = "園児";
  thName.className = "sticky-name th";
  trh.appendChild(thName);

  for (let d = 1; d <= lastDay; d += 1) {
    const th = document.createElement("th");
    const ds = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dow = dayOfWeek(ds);

    th.appendChild(createDateHeaderContent(d, dow));

    if (dow === 0) th.classList.add("sun-col");
    if (dow === 6) th.classList.add("sat-col");

    trh.appendChild(th);
  }

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
  const dailyPresent = new Array(lastDay).fill(0);
  const dailyAbsent = new Array(lastDay).fill(0);

  names.forEach((name) => {
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.textContent = name;
    tdName.className = "sticky-name";
    tr.appendChild(tdName);

    let pTotal = 0;
    let aTotal = 0;

    for (let d = 1; d <= lastDay; d += 1) {
      const td = document.createElement("td");
      const ds = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dow = dayOfWeek(ds);

      if (dow === 0) {
        td.classList.add("sun-col");
        td.textContent = "";
      } else {
        const st = data?.days?.[ds]?.[name];
        if (!st || st === "出席") {
          td.textContent = "";
          if (st === "出席") {
            pTotal += 1;
            dailyPresent[d - 1] += 1;
          }
        } else {
          td.textContent = st;
          aTotal += 1;
          dailyAbsent[d - 1] += 1;
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

  let monthPresentSum = 0;
  let monthAbsentSum = 0;

  const trP = document.createElement("tr");
  trP.className = "footer-row";

  const tdPLabel = document.createElement("td");
  tdPLabel.textContent = "出席人数";
  tdPLabel.className = "sticky-name";
  trP.appendChild(tdPLabel);

  for (let d = 1; d <= lastDay; d += 1) {
    const ds = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dow = dayOfWeek(ds);
    const td = document.createElement("td");

    if (dow === 0) {
      td.classList.add("sun-col");
      td.textContent = "";
    } else {
      const p = dailyPresent[d - 1] || 0;
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
  tdMP2.textContent = "";
  tdMP2.className = "right-total";
  trP.appendChild(tdMP2);

  const trA = document.createElement("tr");
  trA.className = "footer-row";

  const tdALabel = document.createElement("td");
  tdALabel.textContent = "欠席人数";
  tdALabel.className = "sticky-name";
  trA.appendChild(tdALabel);

  for (let d = 1; d <= lastDay; d += 1) {
    const ds = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dow = dayOfWeek(ds);
    const td = document.createElement("td");

    if (dow === 0) {
      td.classList.add("sun-col");
      td.textContent = "";
    } else {
      const a = dailyAbsent[d - 1] || 0;
      td.textContent = String(a);
      monthAbsentSum += a;
    }
    trA.appendChild(td);
  }

  const tdMA1 = document.createElement("td");
  tdMA1.textContent = "";
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

function createDateHeaderContent(dayNumber, dow) {
  const wrap = document.createElement("div");
  wrap.className = "date-head";

  const dayEl = document.createElement("div");
  dayEl.className = "date-number";
  dayEl.textContent = String(dayNumber);

  const weekEl = document.createElement("div");
  weekEl.className = "date-weekday";
  weekEl.textContent = WEEKDAY_NAMES[dow] || "";

  if (dow === 0) {
    dayEl.classList.add("sun-text");
    weekEl.classList.add("sun-text");
  } else if (dow === 6) {
    dayEl.classList.add("sat-text");
    weekEl.classList.add("sat-text");
  }

  wrap.appendChild(dayEl);
  wrap.appendChild(weekEl);
  return wrap;
}

async function handleBackup() {
  try {
    setManageMessage("");

    if (typeof JSZip === "undefined") {
      throw new Error("jszip.min.js を読み込めませんでした");
    }

    const grouped = collectBackupRowsByFile();
    const zip = new JSZip();

    Object.entries(grouped).forEach(([filename, rows]) => {
      const csvText = buildCsvText(rows);
      zip.file(filename, csvText);
    });

    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, BACKUP_ZIP_NAME);
    setManageMessage("バックアップを保存しました。");
  } catch (error) {
    console.error(error);
    alert("バックアップに失敗しました");
  }
}

async function handleRestoreFile(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = "";
  if (!file) return;

  try {
    setManageMessage("");
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith(".zip")) {
      await restoreFromZip(file);
      setManageMessage("ZIPからデータを復元しました。既存データは上書きされました。");
    } else if (lowerName.endsWith(".csv")) {
      const text = await readFileAsText(file);
      clearAttendanceStorage();
      importCsvText(text, file.name);
      afterRestoreRefresh();
      setManageMessage("CSVからデータを復元しました。既存データは上書きされました。");
    } else {
      alert("ZIPまたはCSVファイルを選択してください");
    }
  } catch (error) {
    console.error(error);
    alert("データ復元に失敗しました");
  }
}

async function restoreFromZip(file) {
  if (typeof JSZip === "undefined") {
    throw new Error("jszip.min.js を読み込めませんでした");
  }

  const zip = await JSZip.loadAsync(file);
  const csvEntries = Object.values(zip.files).filter(
    (entry) => !entry.dir && entry.name.toLowerCase().endsWith(".csv")
  );

  clearAttendanceStorage();

  for (const entry of csvEntries) {
    const text = await entry.async("string");
    importCsvText(text, entry.name);
  }

  afterRestoreRefresh();
}

function handleDeleteAllAttendance() {
  const ok = confirm("出席データをすべて削除します。よろしいですか？");
  if (!ok) return;

  const input = prompt("削除を実行するには「削除」と入力してください。");
  if (input !== "削除") {
    alert("削除を中止しました");
    return;
  }

  clearAttendanceStorage();
  resetUiAfterDelete();
  setManageMessage("出席データを削除しました。");
}

function collectBackupRowsByFile() {
  const result = {};
  const keys = getAttendanceKeys();

  keys.forEach((key) => {
    const parsed = parseStorageKey(key);
    if (!parsed) return;

    const { monthKey, className } = parsed;
    const data = loadMonthlyFromStorage(monthKey, className);
    const fileName = buildCsvFileName(className, monthKey);
    const rows = [];
    const dates = Object.keys(data.days || {}).sort();

    dates.forEach((dateStr) => {
      const teacher = data?.meta?.teacherByDate?.[dateStr] || "";
      const dayMap = data.days[dateStr] || {};
      Object.keys(dayMap).forEach((childName) => {
        rows.push({
          monthKey,
          className,
          date: formatDateForCsv(dateStr),
          teacher,
          childName,
          status: dayMap[childName] || "出席"
        });
      });
    });

    result[fileName] = rows;
  });

  return result;
}

function buildCsvText(rows) {
  const header = ["monthKey", "className", "date", "teacher", "childName", "status"];
  const lines = [header.map(csvEscape).join(",")];

  rows.forEach((row) => {
    lines.push(
      [
        row.monthKey || "",
        row.className || "",
        row.date || "",
        row.teacher || "",
        row.childName || "",
        row.status || ""
      ].map(csvEscape).join(",")
    );
  });

  return "\uFEFF" + lines.join("\r\n");
}

function importCsvText(text, sourceName = "") {
  const cleanText = String(text || "").replace(/^\uFEFF/, "");
  const rows = parseCsv(cleanText);
  if (rows.length === 0) return;

  const header = rows[0].map((v) => String(v || "").trim());
  const idx = {
    monthKey: header.indexOf("monthKey"),
    className: header.indexOf("className"),
    date: header.indexOf("date"),
    teacher: header.indexOf("teacher"),
    childName: header.indexOf("childName"),
    status: header.indexOf("status")
  };

  if (Object.values(idx).some((v) => v < 0)) {
    throw new Error(`${sourceName || "CSV"} のヘッダーが不正です`);
  }

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || row.every((cell) => String(cell || "").trim() === "")) continue;

    const rawClassName = String(row[idx.className] || "").trim();
    const className = normalizeClassName(rawClassName);
    const dateStr = normalizeDate(row[idx.date]);
    const teacher = String(row[idx.teacher] || "").trim();
    const childName = String(row[idx.childName] || "").trim();
    const status = normalizeStatus(row[idx.status]);
    let monthKey = normalizeMonthKey(row[idx.monthKey]);

    if (!monthKey && dateStr) {
      monthKey = monthKeyFromDate(dateStr);
    }

    if (!monthKey || !className || !dateStr || !childName) continue;

    const data = loadMonthlyFromStorage(monthKey, className);
    if (!data.meta) data.meta = {};
    if (!data.meta.teacherByDate) data.meta.teacherByDate = {};
    if (!data.days) data.days = {};
    if (!data.days[dateStr]) data.days[dateStr] = {};

    data.meta.className = className;
    data.meta.teacherByDate[dateStr] = teacher;
    data.days[dateStr][childName] = status;

    saveMonthlyToStorage(monthKey, className, data);
  }
}

function clearAttendanceStorage() {
  getAttendanceKeys().forEach((key) => localStorage.removeItem(key));
}

function getAttendanceKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) {
      keys.push(key);
    }
  }
  return keys;
}

function parseStorageKey(key) {
  const prefix = `${STORAGE_PREFIX}`;
  if (!key.startsWith(prefix)) return null;
  const rest = key.slice(prefix.length);
  const idx = rest.indexOf("_");
  if (idx < 0) return null;

  const monthKey = rest.slice(0, idx);
  const className = rest.slice(idx + 1);

  if (!monthKey || !className) return null;

  return {
    monthKey,
    className
  };
}

function buildCsvFileName(className, monthKey) {
  const classToken = CLASS_FILE_MAP[className] || sanitizeFilePart(className);
  const yyyymm = monthKeyToYYYYMM(monthKey);
  return `attendance_${classToken}_${yyyymm}.csv`;
}

function sanitizeFilePart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "_");
}

function normalizeClassName(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (CLASS_FILE_MAP[text]) return text;
  if (FILE_CLASS_MAP[text.toLowerCase()]) return FILE_CLASS_MAP[text.toLowerCase()];
  return text;
}

function normalizeMonthKey(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  let match = text.match(/^(\d{2})-([A-Za-z]{3})$/);
  if (match) {
    const yy = match[1];
    const mon = capitalizeMonth(match[2]);
    if (MONTH_NAME_MAP[mon.toLowerCase()]) {
      return `${yy}-${mon}`;
    }
  }

  match = text.match(/^([A-Za-z]{3})-(\d{2})$/);
  if (match) {
    const mon = capitalizeMonth(match[1]);
    const yy = match[2];
    if (MONTH_NAME_MAP[mon.toLowerCase()]) {
      return `${yy}-${mon}`;
    }
  }

  match = text.replace(/\//g, "-").match(/^(\d{4})-(\d{1,2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month >= 1 && month <= 12) {
      return `${String(year).slice(-2)}-${MONTH_NAMES[month - 1]}`;
    }
  }

  match = text.match(/^(\d{6})$/);
  if (match) {
    const year = Number(text.slice(0, 4));
    const month = Number(text.slice(4, 6));
    if (month >= 1 && month <= 12) {
      return `${String(year).slice(-2)}-${MONTH_NAMES[month - 1]}`;
    }
  }

  return "";
}

function normalizeDate(value) {
  if (value == null) return "";

  if (typeof value === "number" && Number.isFinite(value)) {
    const converted = excelSerialToYMD(value);
    return converted || "";
  }

  const text = String(value).trim();
  if (!text) return "";

  if (/^\d{5}$/.test(text) || /^\d{1,5}(\.\d+)?$/.test(text)) {
    const num = Number(text);
    if (Number.isFinite(num) && num > 0) {
      const converted = excelSerialToYMD(num);
      if (converted) return converted;
    }
  }

  let match = text.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    if (isValidYMD(y, m, d)) {
      return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  match = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    if (isValidYMD(y, m, d)) {
      return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return toYMD(parsed);
  }

  return "";
}

function normalizeStatus(value) {
  const text = String(value || "").trim();
  return REASONS.includes(text) ? text : "出席";
}

function afterRestoreRefresh() {
  renderChildren();
  applySavedForSelectedDate();
  updateCounts();
  renderMonthlyView();
}

function resetUiAfterDelete() {
  dateInput.value = getDefaultWorkDate();
  classSelect.value = "";
  teacherSelect.value = "";
  childList.innerHTML = "";
  presentCountEl.textContent = "0";
  absentCountEl.textContent = "0";
  viewHeader.textContent = "";
  monthTable.innerHTML = "";
  showScreen("input");
}

function setManageMessage(message) {
  manageMessage.textContent = message;
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(cell);
        cell = "";
      } else if (ch === "\n") {
        row.push(cell.replace(/\r$/, ""));
        rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += ch;
      }
    }
  }

  row.push(cell.replace(/\r$/, ""));
  if (row.length > 1 || row[0] !== "") {
    rows.push(row);
  }

  return rows;
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || "");
    reader.onerror = () => reject(reader.error || new Error("read error"));
    reader.readAsText(file, "utf-8");
  });
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getDefaultWorkDate() {
  const d = new Date();
  while (d.getDay() === 0) {
    d.setDate(d.getDate() + 1);
  }
  return toYMD(d);
}

function monthKeyFromDate(dateStr) {
  const normalized = normalizeDate(dateStr);
  if (!normalized) return "";

  const y = normalized.slice(2, 4);
  const m = Number(normalized.slice(5, 7));
  return `${y}-${MONTH_NAMES[m - 1]}`;
}

function monthKeyToYYYYMM(monthKey) {
  const normalized = normalizeMonthKey(monthKey);
  if (!normalized) return "";

  const match = normalized.match(/^(\d{2})-([A-Za-z]{3})$/);
  if (!match) return "";

  const yy = Number(match[1]);
  const month = MONTH_NAME_MAP[match[2].toLowerCase()];
  const yyyy = yy >= 70 ? 1900 + yy : 2000 + yy;
  return `${yyyy}${String(month).padStart(2, "0")}`;
}

function formatDateForCsv(dateStr) {
  const normalized = normalizeDate(dateStr);
  if (!normalized) return "";
  const y = normalized.slice(0, 4);
  const m = String(Number(normalized.slice(5, 7)));
  const d = String(Number(normalized.slice(8, 10)));
  return `${y}/${m}/${d}`;
}

function getLastDay(year, month) {
  return new Date(year, month, 0).getDate();
}

function dayOfWeek(dateStr) {
  const normalized = normalizeDate(dateStr);
  if (!normalized) return 0;
  const [y, m, d] = normalized.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

function isSunday(dateStr) {
  return dayOfWeek(dateStr) === 0;
}

function countChildcareDays(year, month) {
  const last = getLastDay(year, month);
  let count = 0;
  for (let d = 1; d <= last; d += 1) {
    if (new Date(year, month - 1, d).getDay() !== 0) {
      count += 1;
    }
  }
  return count;
}

function toWarekiYearMonth(year, month) {
  const d = new Date(year, month - 1, 1);
  const reiwaStart = new Date(2019, 4, 1);
  const heiseiStart = new Date(1989, 0, 8);

  let eraName = "";
  let eraYear = 0;

  if (d >= reiwaStart) {
    eraName = "令和";
    eraYear = year - 2018;
  } else if (d >= heiseiStart) {
    eraName = "平成";
    eraYear = year - 1988;
  } else {
    eraName = "西暦";
    eraYear = year;
  }

  const yStr = eraName === "西暦" ? `${eraYear}年` : `${eraName}${eraYear}年`;
  return `${yStr}${month}月`;
}

function cssEscape(s) {
  if (window.CSS && CSS.escape) return CSS.escape(s);
  return s.replace(/["\\]/g, "\\$&");
}

function makeRadioGroupName(className, name) {
  const base = `${className}_${name}`;
  return "reason_" + base.replace(/[^\w\u3040-\u30FF\u4E00-\u9FFF]+/g, "_");
}

function capitalizeMonth(mon) {
  const lower = String(mon || "").trim().toLowerCase();
  if (!MONTH_NAME_MAP[lower]) return "";
  return lower.charAt(0).toUpperCase() + lower.slice(1, 3);
}

function isValidYMD(y, m, d) {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function excelSerialToYMD(serial) {
  const num = Number(serial);
  if (!Number.isFinite(num)) return "";
  const utcDays = Math.floor(num - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  if (Number.isNaN(dateInfo.getTime())) return "";
  const y = dateInfo.getUTCFullYear();
  const m = dateInfo.getUTCMonth() + 1;
  const d = dateInfo.getUTCDate();
  if (!isValidYMD(y, m, d)) return "";
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}