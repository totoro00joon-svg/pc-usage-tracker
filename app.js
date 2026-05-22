const STORAGE_KEY = "pc-usage-records-v1";
const DEFAULT_TYPE = "업무";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js");
  });
}

const usageForm = document.querySelector("#usageForm");
const usageDate = document.querySelector("#usageDate");
const startHour = document.querySelector("#startHour");
const startMinute = document.querySelector("#startMinute");
const endHour = document.querySelector("#endHour");
const endMinute = document.querySelector("#endMinute");
const usageType = document.querySelector("#usageType");
const note = document.querySelector("#note");
const saveButton = document.querySelector("#saveButton");
const cancelEditButton = document.querySelector("#cancelEditButton");
const startButton = document.querySelector("#startButton");
const endButton = document.querySelector("#endButton");
const todayLabel = document.querySelector("#todayLabel");
const todayStatus = document.querySelector("#todayStatus");
const todayDuration = document.querySelector("#todayDuration");
const monthTotal = document.querySelector("#monthTotal");
const weekAverage = document.querySelector("#weekAverage");
const longestDay = document.querySelector("#longestDay");
const weeklyChart = document.querySelector("#weeklyChart");
const typeSummary = document.querySelector("#typeSummary");
const recordTable = document.querySelector("#recordTable");
const emptyState = document.querySelector("#emptyState");
const recordCount = document.querySelector("#recordCount");
const searchInput = document.querySelector("#searchInput");
const exportButton = document.querySelector("#exportButton");
const clearButton = document.querySelector("#clearButton");

let records = loadRecords();
let editingId = null;

function pad(value) {
  return String(value).padStart(2, "0");
}

function todayString() {
  const date = new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function nowTime() {
  const date = new Date();
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function makeTime(hour, minute) {
  return `${hour}:${minute}`;
}

function fillTimeSelects() {
  for (let hour = 0; hour < 24; hour += 1) {
    const option = new Option(pad(hour), pad(hour));
    startHour.add(option.cloneNode(true));
    endHour.add(option);
  }

  for (let minute = 0; minute < 60; minute += 1) {
    const option = new Option(pad(minute), pad(minute));
    startMinute.add(option.cloneNode(true));
    endMinute.add(option);
  }
}

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function minutesFromTime(time) {
  if (!time) return null;
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function usageMinutes(record) {
  if (!record.start || !record.end) return 0;
  let minutes = minutesFromTime(record.end) - minutesFromTime(record.start);
  if (minutes < 0) minutes += 24 * 60;
  return minutes;
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}분`;
  if (mins === 0) return `${hours}시간`;
  return `${hours}시간 ${mins}분`;
}

function formatDateLabel(dateText) {
  const [year, month, day] = dateText.split("-").map(Number);
  return `${month}/${day}`;
}

function setTimeControls(start, end) {
  const [sHour, sMinute] = start.split(":");
  const [eHour, eMinute] = end.split(":");
  startHour.value = sHour;
  startMinute.value = sMinute;
  endHour.value = eHour;
  endMinute.value = eMinute;
}

function setDefaultForm() {
  usageDate.value = todayString();
  setTimeControls("09:00", "18:00");
  usageType.value = DEFAULT_TYPE;
  note.value = "";
  editingId = null;
  saveButton.textContent = "기록 저장";
  cancelEditButton.hidden = true;
}

function currentFormRecord() {
  return {
    id: editingId || crypto.randomUUID(),
    date: usageDate.value,
    start: makeTime(startHour.value, startMinute.value),
    end: makeTime(endHour.value, endMinute.value),
    type: usageType.value,
    note: note.value.trim(),
  };
}

function getTodayRecord() {
  return records.find((record) => record.date === todayString());
}

function sortRecords(list) {
  return [...list].sort((a, b) => b.date.localeCompare(a.date) || (b.start || "").localeCompare(a.start || ""));
}

function filteredRecords() {
  const keyword = searchInput.value.trim().toLowerCase();
  if (!keyword) return sortRecords(records);

  return sortRecords(
    records.filter((record) => {
      return (
        record.date.includes(keyword) ||
        record.type.toLowerCase().includes(keyword) ||
        record.note.toLowerCase().includes(keyword)
      );
    }),
  );
}

function upsertRecord(record) {
  const editIndex = records.findIndex((item) => item.id === record.id);
  const sameDateIndex = records.findIndex((item) => item.date === record.date);

  if (editIndex >= 0) {
    records[editIndex] = record;
    return true;
  }

  if (sameDateIndex >= 0) {
    const replace = confirm("같은 날짜의 기록이 있습니다. 새 내용으로 바꿀까요?");
    if (!replace) return false;
    records[sameDateIndex] = { ...record, id: records[sameDateIndex].id };
    return true;
  }

  records.push(record);
  return true;
}

function quickRecord(kind) {
  const date = todayString();
  const time = nowTime();
  const record = getTodayRecord();

  if (kind === "start") {
    if (record?.start) {
      const replace = confirm(`오늘 시작시간이 이미 ${record.start}로 기록되어 있습니다. ${time}로 바꿀까요?`);
      if (!replace) return;
      record.start = time;
    } else if (record) {
      record.start = time;
    } else {
      records.push({ id: crypto.randomUUID(), date, start: time, end: "", type: DEFAULT_TYPE, note: "" });
    }
  }

  if (kind === "end") {
    if (!record) {
      const create = confirm("오늘 시작 기록이 없습니다. 종료시간만 먼저 기록할까요?");
      if (!create) return;
      records.push({ id: crypto.randomUUID(), date, start: "", end: time, type: DEFAULT_TYPE, note: "" });
    } else if (record.end) {
      const replace = confirm(`오늘 종료시간이 이미 ${record.end}로 기록되어 있습니다. ${time}로 바꿀까요?`);
      if (!replace) return;
      record.end = time;
    } else {
      record.end = time;
    }
  }

  saveRecords();
  setDefaultForm();
  render();
}

function renderToday() {
  const record = getTodayRecord();
  if (!record) {
    todayStatus.textContent = "시작 전";
    todayDuration.textContent = "0분";
    return;
  }

  if (record.start && record.end) {
    todayStatus.textContent = `시작 ${record.start} · 종료 ${record.end}`;
    todayDuration.textContent = formatDuration(usageMinutes(record));
    return;
  }

  if (record.start) {
    todayStatus.textContent = `시작 ${record.start} · 사용 중`;
    todayDuration.textContent = "종료 전";
    return;
  }

  todayStatus.textContent = `종료 ${record.end}`;
  todayDuration.textContent = "시작 전";
}

function getLastSevenDays() {
  const days = [];
  const base = new Date(`${todayString()}T00:00:00`);
  for (let index = 6; index >= 0; index -= 1) {
    const date = new Date(base);
    date.setDate(base.getDate() - index);
    days.push(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`);
  }
  return days;
}

function renderSummary() {
  const currentMonth = todayString().slice(0, 7);
  const completedRecords = records.filter((record) => record.start && record.end);
  const monthRecords = completedRecords.filter((record) => record.date.startsWith(currentMonth));
  const monthMinutes = monthRecords.reduce((sum, record) => sum + usageMinutes(record), 0);

  const recentDates = getLastSevenDays();
  const weekMinutes = recentDates.map((date) => {
    const record = completedRecords.find((item) => item.date === date);
    return record ? usageMinutes(record) : 0;
  });
  const usedDays = weekMinutes.filter((minutes) => minutes > 0).length;
  const average = usedDays ? Math.round(weekMinutes.reduce((sum, minutes) => sum + minutes, 0) / usedDays) : 0;

  const longest = completedRecords.reduce((best, record) => {
    if (!best || usageMinutes(record) > usageMinutes(best)) return record;
    return best;
  }, null);

  monthTotal.textContent = formatDuration(monthMinutes);
  weekAverage.textContent = formatDuration(average);
  longestDay.textContent = longest ? `${formatDateLabel(longest.date)} · ${formatDuration(usageMinutes(longest))}` : "-";
}

function renderWeeklyChart() {
  const dates = getLastSevenDays();
  const values = dates.map((date) => {
    const record = records.find((item) => item.date === date && item.start && item.end);
    return record ? usageMinutes(record) : 0;
  });
  const maxValue = Math.max(...values, 60);

  weeklyChart.innerHTML = "";
  dates.forEach((date, index) => {
    const minutes = values[index];
    const width = Math.max((minutes / maxValue) * 100, minutes ? 8 : 0);
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <span>${formatDateLabel(date)}</span>
      <div class="bar-track">
        <div class="bar-fill" style="width: ${width}%"></div>
      </div>
      <strong>${minutes ? formatDuration(minutes) : "-"}</strong>
    `;
    weeklyChart.appendChild(row);
  });
}

function renderTypeSummary() {
  const totals = records.reduce((map, record) => {
    if (!record.start || !record.end) return map;
    map[record.type] = (map[record.type] || 0) + usageMinutes(record);
    return map;
  }, {});

  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  typeSummary.innerHTML = "";

  if (entries.length === 0) {
    typeSummary.innerHTML = `<div class="empty-state">완료된 기록이 생기면 유형별 시간이 표시됩니다.</div>`;
    return;
  }

  entries.forEach(([type, minutes]) => {
    const item = document.createElement("div");
    item.className = "type-item";
    item.innerHTML = `<strong>${type}</strong><span>${formatDuration(minutes)}</span>`;
    typeSummary.appendChild(item);
  });
}

function renderRecords() {
  const list = filteredRecords();
  recordTable.innerHTML = "";

  list.forEach((record) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${record.date}</td>
      <td>${record.start || "-"}</td>
      <td>${record.end || "-"}</td>
      <td>${record.start && record.end ? formatDuration(usageMinutes(record)) : "-"}</td>
      <td>${record.type}</td>
      <td>${record.note || "-"}</td>
      <td>
        <div class="row-actions">
          <button class="ghost" type="button" data-action="edit" data-id="${record.id}">수정</button>
          <button class="danger" type="button" data-action="delete" data-id="${record.id}">삭제</button>
        </div>
      </td>
    `;
    recordTable.appendChild(row);
  });

  emptyState.classList.toggle("hidden", list.length > 0);
  recordCount.textContent = `저장된 기록 ${records.length}개`;
}

function editRecord(id) {
  const record = records.find((item) => item.id === id);
  if (!record) return;

  editingId = id;
  usageDate.value = record.date;
  setTimeControls(record.start || "09:00", record.end || "18:00");
  usageType.value = record.type;
  note.value = record.note || "";
  saveButton.textContent = "수정 저장";
  cancelEditButton.hidden = false;
  usageDate.focus();
}

function deleteRecord(id) {
  const record = records.find((item) => item.id === id);
  if (!record) return;
  const confirmed = confirm(`${record.date} 기록을 삭제할까요?`);
  if (!confirmed) return;
  records = records.filter((item) => item.id !== id);
  saveRecords();
  render();
}

function exportCsv() {
  if (records.length === 0) {
    alert("내보낼 기록이 없습니다.");
    return;
  }

  const headers = ["날짜", "시작시간", "종료시간", "사용시간", "사용유형", "메모"];
  const rows = sortRecords(records).map((record) => [
    record.date,
    record.start || "",
    record.end || "",
    record.start && record.end ? formatDuration(usageMinutes(record)) : "",
    record.type,
    record.note || "",
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `pc-usage-${todayString()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function render() {
  renderToday();
  renderSummary();
  renderWeeklyChart();
  renderTypeSummary();
  renderRecords();
}

usageForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const saved = upsertRecord(currentFormRecord());
  if (!saved) return;
  saveRecords();
  setDefaultForm();
  render();
});

recordTable.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const { action, id } = button.dataset;
  if (action === "edit") editRecord(id);
  if (action === "delete") deleteRecord(id);
});

startButton.addEventListener("click", () => quickRecord("start"));
endButton.addEventListener("click", () => quickRecord("end"));
cancelEditButton.addEventListener("click", setDefaultForm);
searchInput.addEventListener("input", renderRecords);
exportButton.addEventListener("click", exportCsv);
clearButton.addEventListener("click", () => {
  if (records.length === 0) return;
  const confirmed = confirm("모든 PC 사용 기록을 삭제할까요?");
  if (!confirmed) return;
  records = [];
  saveRecords();
  setDefaultForm();
  render();
});

fillTimeSelects();
todayLabel.textContent = new Date().toLocaleDateString("ko-KR", {
  month: "long",
  day: "numeric",
  weekday: "short",
});
setDefaultForm();
render();
