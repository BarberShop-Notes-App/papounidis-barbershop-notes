/* app.js - Calendar + time slots + name+phone bookings (IndexedDB) */

/* ─────────────────────────────────────────
   STORAGE CONFIG
   ───────────────────────────────────────── */
const DB_NAME = "papounidis_db";
const DB_VERSION = 1;
const STORE_NAME = "appointments";
const RECORD_KEY = "all"; // single JSON blob
const LANG_KEY = "papounidis_lang";

/* ─────────────────────────────────────────
   LOCALIZATION
   ───────────────────────────────────────── */
const STRINGS = {
  en: {
    appTitle: "Papounidis-Barbershop",
    subtitle: "Barbershop notes",
    selectDate: "Select a date",
    free: "Free",
    booked: "Booked",
    clientName: "Client name",
    phone: "Phone",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    clearConfirm: "Clear all bookings? This cannot be undone.",
    installHint: "Offline · Add to home screen",
    back: "Back",
    weekdays: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
  },
  el: {
    appTitle: "Papounidis-Barbershop",
    subtitle: "Σημειώσεις κουρείου",
    selectDate: "Επιλέξτε ημερομηνία",
    free: "Διαθέσιμο",
    booked: "Κρατημένο",
    clientName: "Όνομα πελάτη",
    phone: "Τηλέφωνο",
    save: "Αποθήκευση",
    cancel: "Άκυρο",
    delete: "Διαγραφή",
    clearConfirm:
      "Θα διαγράψετε όλες τις κρατήσεις; Η ενέργεια δεν αναστρέφεται.",
    installHint: "Offline · Προσθέστε στην αρχική οθόνη",
    back: "Πίσω",
    weekdays: ["Δε", "Τρ", "Τε", "Πέ", "Πα", "Σά", "Κυ"],
  },
};

/* ─────────────────────────────────────────
   DOM REFS
   ───────────────────────────────────────── */
const monthLabel = document.getElementById("monthLabel");
const calendarGrid = document.getElementById("calendarGrid");
const weekdayRow = document.querySelector(".weekday-row");
const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");
const selectedLabel = document.getElementById("selectedLabel");
const slotsContainer = document.getElementById("slotsContainer");
const langToggle = document.getElementById("langToggle");
const clearBtn = document.getElementById("clearBtn");
const exportBtn = document.getElementById("exportBtn");
const importFileInput = document.getElementById("importFileInput");
const importBtn = document.getElementById("importBtn");
const menuBtn = document.getElementById("menuBtn");
const drawer = document.getElementById("drawer");
const drawerOverlay = document.getElementById("drawerOverlay");
const drawerCloseBtn = document.getElementById("drawerCloseBtn");
const calendarSection = document.getElementById("calendarSection");
const slotsSection = document.getElementById("slotsSection");
const backToCalendarBtn = document.getElementById("backToCalendarBtn");
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const inputName = document.getElementById("inputName");
const inputPhone = document.getElementById("inputPhone");
const saveBtn = document.getElementById("saveBtn");
const cancelBtn = document.getElementById("cancelBtn");
const deleteBtn = document.getElementById("deleteBtn");
const appTitleEl = document.getElementById("appTitle");
const subtitleEl = document.getElementById("subtitle");

/* ─────────────────────────────────────────
   STATE
   ───────────────────────────────────────── */
let appointments = {};
let currentMonth = new Date();
let selectedDateISO = null;
let activeSlot = null;
let lang = localStorage.getItem(LANG_KEY) || "en";
let db = null; // IndexedDB instance

/* ═════════════════════════════════════════
   INDEXEDDB  — open / read / write
   ═════════════════════════════════════════ */

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const idb = e.target.result;
      if (!idb.objectStoreNames.contains(STORE_NAME)) {
        idb.createObjectStore(STORE_NAME);
      }
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

function dbGet(idb, key) {
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbPut(idb, key, value) {
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function loadFromDB() {
  try {
    const data = await dbGet(db, RECORD_KEY);

    if (data && Object.keys(data).length > 0) {
      // IndexedDB already has data — normal load, nothing to migrate
      appointments = data;
    } else {
      // IndexedDB is empty (first launch after update).
      // Check if the old localStorage has appointments and migrate them.
      let migrated = {};
      try {
        migrated =
          JSON.parse(localStorage.getItem("papounidis_appointments_v1")) || {};
      } catch (_) {}

      appointments = migrated;

      if (Object.keys(migrated).length > 0) {
        // Save migrated data into IndexedDB so next launch reads from there
        await saveToDB();
        console.log(
          "Migrated",
          Object.keys(migrated).length,
          "days from localStorage to IndexedDB.",
        );
      }
    }
  } catch (e) {
    // IndexedDB completely unavailable — fall back to localStorage as last resort
    console.warn("IndexedDB read failed:", e);
    try {
      appointments =
        JSON.parse(localStorage.getItem("papounidis_appointments_v1")) || {};
    } catch (_) {
      appointments = {};
    }
  }
}

async function saveToDB() {
  try {
    await dbPut(db, RECORD_KEY, appointments);
  } catch (e) {
    console.error("IndexedDB write failed:", e);
    // Last-resort fallback so no data is lost silently
    try {
      localStorage.setItem(
        "papounidis_appointments_v1",
        JSON.stringify(appointments),
      );
    } catch (_) {}
  }
}

/* ═════════════════════════════════════════
   EXPORT / IMPORT  (manual + auto)
   ═════════════════════════════════════════ */

function triggerExport() {
  const json = JSON.stringify(appointments, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `papounidis-backup-${toLocalISODate(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function handleImport(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      // Merge imported data with existing (imported wins on conflicts)
      appointments = { ...appointments, ...parsed };
      await saveToDB();
      renderCalendar();
      renderSlots(selectedDateISO);
      alert("✅ Import successful!");
    } catch {
      alert(
        "❌ Invalid backup file. Please use a previously exported JSON file.",
      );
    }
  };
  reader.readAsText(file);
  // Reset input so the same file can be re-imported if needed
  importFileInput.value = "";
}

/* ─────────────────────────────────────────
   EXPORT / IMPORT LISTENERS
   ───────────────────────────────────────── */
/* ─────────────────────────────────────────
   DRAWER OPEN / CLOSE
   ───────────────────────────────────────── */
function openDrawer() {
  drawer.classList.add("open");
  drawerOverlay.classList.add("open");
}
function closeDrawer() {
  drawer.classList.remove("open");
  drawerOverlay.classList.remove("open");
}
menuBtn.addEventListener("click", openDrawer);
drawerCloseBtn.addEventListener("click", closeDrawer);
drawerOverlay.addEventListener("click", closeDrawer);

exportBtn.addEventListener("click", () => {
  closeDrawer();
  triggerExport();
});
importBtn.addEventListener("click", () => importFileInput.click());
importFileInput.addEventListener("change", (e) => {
  closeDrawer();
  handleImport(e.target.files[0]);
});

/* ═════════════════════════════════════════
   UTILITIES
   ═════════════════════════════════════════ */

function toLocalISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeHtml(s) {
  if (!s) return "";
  return String(s).replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        m
      ],
  );
}

function formatTimeForLocale(hm) {
  const [hh, mm] = hm.split(":").map(Number);
  return new Date(1970, 0, 1, hh % 24, mm).toLocaleTimeString(
    lang === "el" ? "el-GR" : "en-US",
    { hour: "numeric", minute: "2-digit" },
  );
}

/* ═════════════════════════════════════════
   VIEW SWITCHING  (slide animations)
   ═════════════════════════════════════════ */

function showSlotsView() {
  calendarSection.classList.add("anim-exit-left");
  setTimeout(() => {
    calendarSection.style.display = "none";
    calendarSection.classList.remove("anim-exit-left");
    slotsSection.style.display = "block";
    void slotsSection.offsetWidth;
    slotsSection.classList.remove("anim-enter-left", "anim-exit-right");
    slotsSection.classList.add("anim-enter-right");
  }, 280);
}

function showCalendarView() {
  slotsSection.classList.add("anim-exit-right");
  setTimeout(() => {
    slotsSection.style.display = "none";
    slotsSection.classList.remove("anim-exit-right");
    calendarSection.style.display = "block";
    void calendarSection.offsetWidth;
    calendarSection.classList.remove("anim-enter-right", "anim-exit-left");
    calendarSection.classList.add("anim-enter-left");
  }, 280);
}

/* ═════════════════════════════════════════
   STATS BAR
   ═════════════════════════════════════════ */

function renderStats() {
  const now = new Date();
  const todayISO = toLocalISODate(now);

  // Week boundaries (Mon–Sun)
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // Mon=1..Sun=7
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - (dayOfWeek - 1));
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  // Month boundaries
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  let weeklyCount = 0;
  let monthlyCount = 0;

  Object.entries(appointments).forEach(([dateISO, slots]) => {
    const parts = dateISO.split("-").map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const bookedCount = Object.keys(slots).length;

    if (d >= weekStart && d <= weekEnd) weeklyCount += bookedCount;
    if (d >= monthStart && d <= monthEnd) monthlyCount += bookedCount;
  });

  document.getElementById("weeklyCount").textContent = weeklyCount;
  document.getElementById("monthlyCount").textContent = monthlyCount;
}

/* ═════════════════════════════════════════
   CALENDAR
   ═════════════════════════════════════════ */

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function formatMonthLabel(d) {
  return d.toLocaleString(lang === "el" ? "el-GR" : "en-US", {
    month: "long",
    year: "numeric",
  });
}

function renderWeekdays() {
  weekdayRow.innerHTML = "";
  STRINGS[lang].weekdays.forEach((dayName) => {
    const div = document.createElement("div");
    div.innerText = dayName;
    weekdayRow.appendChild(div);
  });
}

function renderCalendar() {
  renderStats();
  calendarGrid.innerHTML = "";
  monthLabel.textContent = formatMonthLabel(currentMonth);

  const start = startOfMonth(currentMonth);
  const end = endOfMonth(currentMonth);
  let startDow = start.getDay();
  if (startDow === 0) startDow = 7;
  const prevFill = startDow - 1;
  const totalDays = prevFill + end.getDate();
  const slots = Math.ceil(totalDays / 7) * 7;
  const firstShown = new Date(start);
  firstShown.setDate(start.getDate() - prevFill);
  const todayISO = toLocalISODate(new Date());

  for (let i = 0; i < slots; i++) {
    const d = new Date(firstShown);
    d.setDate(firstShown.getDate() + i);
    const iso = toLocalISODate(d);

    const dayEl = document.createElement("button");
    dayEl.className = "day";
    if (iso === todayISO) dayEl.classList.add("today");
    if (d.getMonth() !== currentMonth.getMonth())
      dayEl.classList.add("inactive");
    if (iso === selectedDateISO) dayEl.classList.add("selected");
    dayEl.type = "button";
    dayEl.setAttribute("data-date", iso);
    dayEl.innerText = d.getDate();

    dayEl.addEventListener("click", (e) => {
      selectedDateISO = e.currentTarget.getAttribute("data-date");
      renderCalendar();
      renderSlots(selectedDateISO);
      showSlotsView();
    });
    calendarGrid.appendChild(dayEl);
  }
}

/* ═════════════════════════════════════════
   TIME SLOTS
   ═════════════════════════════════════════ */

function generateTimes() {
  const slots = [];
  let h = 7,
    m = 0;
  while (true) {
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    if (h === 24 && m === 0) break;
    m += 20;
    if (m >= 60) {
      m = 0;
      h += 1;
    }
    if (h > 24) break;
  }
  return slots;
}
const TIMES = generateTimes();

function renderSlots(dateISO) {
  if (!dateISO) return;
  const parts = dateISO.split("-").map((p) => parseInt(p, 10));
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  selectedLabel.textContent = d.toLocaleDateString(
    lang === "el" ? "el-GR" : "en-US",
    { weekday: "short", month: "short", day: "numeric", year: "numeric" },
  );

  slotsContainer.innerHTML = "";
  const dayAppts = appointments[dateISO] || {};

  TIMES.forEach((time) => {
    const btn = document.createElement("button");
    btn.className = "slot";
    btn.setAttribute("data-time", time);

    const [hh, mm] = time.split(":").map(Number);
    const tDisplay = new Date(1970, 0, 1, hh % 24, mm).toLocaleTimeString(
      lang === "el" ? "el-GR" : "en-US",
      { hour: "numeric", minute: "2-digit" },
    );

    if (dayAppts[time]) {
      btn.classList.add("booked", "slot-booked-highlight");
      btn.innerHTML = `<div class="time">${tDisplay}</div><div class="client">${escapeHtml(dayAppts[time].name)}</div>`;
      btn.disabled = false;
    } else {
      btn.classList.add("free");
      btn.innerHTML = `<div class="time">${tDisplay}</div>`;
    }
    btn.addEventListener("click", () => openModalForSlot(dateISO, time));
    slotsContainer.appendChild(btn);
  });
}

/* ═════════════════════════════════════════
   MODAL
   ═════════════════════════════════════════ */

function openModalForSlot(date, time) {
  activeSlot = { date, time };
  const booking = (appointments[date] || {})[time] || null;
  inputName.value = booking ? booking.name : "";
  inputPhone.value = booking ? booking.phone : "";
  deleteBtn.style.display = booking ? "inline-block" : "none";

  modalTitle.innerText = STRINGS[lang].save + " — " + formatTimeForLocale(time);
  document.getElementById("lblClient").innerText = STRINGS[lang].clientName;
  document.getElementById("lblPhone").innerText = STRINGS[lang].phone;
  saveBtn.innerText = STRINGS[lang].save;
  cancelBtn.innerText = STRINGS[lang].cancel;
  deleteBtn.innerText = STRINGS[lang].delete;

  modal.setAttribute("aria-hidden", "false");
  modal.style.display = "flex";
  inputName.focus();
}

function closeModal() {
  modal.setAttribute("aria-hidden", "true");
  modal.style.display = "none";
  activeSlot = null;
}

/* ─── Save ─── */
saveBtn.addEventListener("click", async () => {
  if (!activeSlot) return;
  const name = inputName.value.trim();
  const phone = inputPhone.value.trim();
  if (!name) {
    alert(STRINGS[lang].clientName + " is required");
    inputName.focus();
    return;
  }

  if (!appointments[activeSlot.date]) appointments[activeSlot.date] = {};
  appointments[activeSlot.date][activeSlot.time] = { name, phone };

  await saveToDB();
  renderSlots(activeSlot.date);
  renderCalendar();

  const timeToFlash = activeSlot.time;
  closeModal();

  setTimeout(() => {
    const bookedSlot = slotsContainer.querySelector(
      `.slot.booked[data-time="${timeToFlash}"]`,
    );
    if (bookedSlot) {
      bookedSlot.classList.add("flash-booked", "slot-booked-highlight");
      setTimeout(() => bookedSlot.classList.remove("flash-booked"), 700);
    }
  }, 50);
});

/* ─── Delete ─── */
deleteBtn.addEventListener("click", async () => {
  if (!activeSlot) return;
  if (confirm(STRINGS[lang].delete + "?")) {
    if (appointments[activeSlot.date]?.[activeSlot.time]) {
      delete appointments[activeSlot.date][activeSlot.time];
      if (Object.keys(appointments[activeSlot.date]).length === 0)
        delete appointments[activeSlot.date];
      await saveToDB();
      renderSlots(activeSlot.date);
      renderCalendar();
      closeModal();
    }
  }
});

cancelBtn.addEventListener("click", () => closeModal());
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

/* ═════════════════════════════════════════
   NAVIGATION LISTENERS
   ═════════════════════════════════════════ */

prevMonthBtn.addEventListener("click", () => {
  currentMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() - 1,
    1,
  );
  renderCalendar();
});
nextMonthBtn.addEventListener("click", () => {
  currentMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    1,
  );
  renderCalendar();
});
backToCalendarBtn.addEventListener("click", () => showCalendarView());

/* ═════════════════════════════════════════
   CLEAR / LANGUAGE
   ═════════════════════════════════════════ */

clearBtn.addEventListener("click", async () => {
  closeDrawer();
  if (confirm(STRINGS[lang].clearConfirm)) {
    appointments = {};
    await saveToDB();
    renderSlots(selectedDateISO);
    renderCalendar();
  }
});

langToggle.addEventListener("click", () => {
  lang = lang === "en" ? "el" : "en";
  localStorage.setItem(LANG_KEY, lang);
  applyLanguage();
  renderCalendar();
  renderSlots(selectedDateISO);
});

function applyLanguage() {
  appTitleEl.innerText = STRINGS[lang].appTitle;
  subtitleEl.innerText = STRINGS[lang].subtitle;
  langToggle.innerText = lang === "en" ? "Ελληνικά" : "English";
  backToCalendarBtn.innerHTML = `‹ <span>${STRINGS[lang].back}</span>`;
  renderWeekdays();
}

/* ═════════════════════════════════════════
   INIT
   ═════════════════════════════════════════ */

async function init() {
  // 1. Open IndexedDB
  try {
    db = await openDB();
  } catch (e) {
    console.error("Could not open IndexedDB:", e);
  }

  // 2. Load appointments (with localStorage migration fallback inside)
  await loadFromDB();

  // 3. UI setup
  applyLanguage();
  const today = new Date();
  currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  selectedDateISO = toLocalISODate(today);
  renderCalendar();
  renderSlots(selectedDateISO);
  showCalendarView();

  // 4. Service Worker
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("service-worker.js")
        .catch((err) => console.warn("SW failed", err));
    });
  }
}

init();
