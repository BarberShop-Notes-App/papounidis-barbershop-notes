/* app.js - Calendar + time slots + name+phone bookings (localStorage) */

/* STORAGE KEYS */
const STORAGE_KEY = "papounidis_appointments_v1";
const LANG_KEY = "papounidis_lang";

/* LOCALIZATION */
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
    labelWeekly: "This Week",
    labelMonthly: "This Month",
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
    labelWeekly: "Εβδομάδα",
    labelMonthly: "Μήνας",
  },
};

/* DOM */
const monthLabel = document.getElementById("monthLabel");
const calendarGrid = document.getElementById("calendarGrid");
const weekdayRow = document.querySelector(".weekday-row");
const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");
const selectedLabel = document.getElementById("selectedLabel");
const slotsContainer = document.getElementById("slotsContainer");
const langToggle = document.getElementById("langToggle");
const clearBtn = document.getElementById("clearBtn");
const installHint = document.getElementById("installHint");

/* DOM Elements for Layout Toggle */
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

let appointments = {};
let currentMonth = new Date();
let selectedDateISO = null;
let activeSlot = null;
let lang = localStorage.getItem(LANG_KEY) || "en";

/* Utilities */
function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appointments));
}
function loadFromStorage() {
  try {
    appointments = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch (e) {
    appointments = {};
  }
}
function toLocalISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/* Safe ISO → local Date (avoids UTC midnight timezone shift) */
function isoToLocalDate(dateISO) {
  const [y, mo, da] = dateISO.split("-").map(Number);
  return new Date(y, mo - 1, da);
}

/* VIEW SWITCHING LOGIC */
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

/* Calendar helpers */
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

/* Render Weekday Header */
function renderWeekdays() {
  weekdayRow.innerHTML = "";
  const days = STRINGS[lang].weekdays;
  days.forEach((dayName) => {
    const div = document.createElement("div");
    div.innerText = dayName;
    weekdayRow.appendChild(div);
  });
}

/* Render calendar */
function renderCalendar() {
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

  for (let i = 0; i < slots; i++) {
    const d = new Date(firstShown);
    d.setDate(firstShown.getDate() + i);
    const iso = toLocalISODate(d);
    const dayEl = document.createElement("button");
    dayEl.className = "day";
    const now = new Date();
    const todayISO = toLocalISODate(now);
    if (iso === todayISO) dayEl.classList.add("today");
    if (d.getMonth() !== currentMonth.getMonth())
      dayEl.classList.add("inactive");
    if (iso === selectedDateISO) dayEl.classList.add("selected");
    dayEl.type = "button";
    dayEl.setAttribute("data-date", iso);
    dayEl.innerText = d.getDate();

    dayEl.addEventListener("click", (e) => {
      const clickedISO = e.currentTarget.getAttribute("data-date");
      selectedDateISO = clickedISO;
      renderCalendar();
      renderSlots(clickedISO);
      showSlotsView();
    });
    calendarGrid.appendChild(dayEl);
  }
}

/* Time slot generation */
function generateTimes() {
  const slots = [];
  let h = 7,
    m = 0;
  while (true) {
    const hh = String(h).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    slots.push(`${hh}:${mm}`);
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

/* Display selected date & slots */
function renderSlots(dateISO) {
  if (!dateISO) return;

  const d = isoToLocalDate(dateISO);
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
      btn.classList.add("booked");
      btn.classList.add("slot-booked-highlight");
      btn.innerHTML = `<div class="time">${tDisplay}</div><div class="client">${escapeHtml(
        dayAppts[time].name,
      )}</div>`;
      btn.disabled = false;
    } else {
      btn.classList.add("free");
      btn.innerHTML = `<div class="time">${tDisplay}</div>`;
    }
    btn.addEventListener("click", () => openModalForSlot(dateISO, time));
    slotsContainer.appendChild(btn);
  });
}

/* Modal handling */
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

/* helpers */
function formatTimeForLocale(hm) {
  const [hh, mm] = hm.split(":").map(Number);
  return new Date(1970, 0, 1, hh % 24, mm).toLocaleTimeString(
    lang === "el" ? "el-GR" : "en-US",
    { hour: "numeric", minute: "2-digit" },
  );
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

/* Save booking */
saveBtn.addEventListener("click", () => {
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

  saveToStorage();
  renderSlots(activeSlot.date);
  renderCalendar();
  updateStats(); /* ← FIXED: update stats after every save */

  const timeToFlash = activeSlot.time;
  closeModal();

  setTimeout(() => {
    const selector = `.slot.booked[data-time="${timeToFlash}"]`;
    const bookedSlot = slotsContainer.querySelector(selector);
    if (bookedSlot) {
      bookedSlot.classList.add("flash-booked");
      bookedSlot.classList.add("slot-booked-highlight");
      setTimeout(() => {
        bookedSlot.classList.remove("flash-booked");
      }, 700);
    }
  }, 50);
});

/* Delete booking */
deleteBtn.addEventListener("click", () => {
  if (!activeSlot) return;
  if (confirm(STRINGS[lang].delete + "?")) {
    if (
      appointments[activeSlot.date] &&
      appointments[activeSlot.date][activeSlot.time]
    ) {
      delete appointments[activeSlot.date][activeSlot.time];
      if (Object.keys(appointments[activeSlot.date]).length === 0)
        delete appointments[activeSlot.date];
      saveToStorage();
      renderSlots(activeSlot.date);
      renderCalendar();
      updateStats(); /* ← FIXED: update stats after every delete */
      closeModal();
    }
  }
});

cancelBtn.addEventListener("click", () => closeModal());
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

/* Navigation Listeners */
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
backToCalendarBtn.addEventListener("click", () => {
  showCalendarView();
});

/* Clear/Language Listeners */
clearBtn.addEventListener("click", () => {
  if (confirm(STRINGS[lang].clearConfirm)) {
    appointments = {};
    saveToStorage();
    renderSlots(selectedDateISO);
    renderCalendar();
    updateStats(); /* ← FIXED: update stats after manual clear */
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

  /* Update stats labels when language changes */
  const labelWeeklyEl = document.getElementById("labelWeekly");
  const labelMonthlyEl = document.getElementById("labelMonthly");
  if (labelWeeklyEl) labelWeeklyEl.innerText = STRINGS[lang].labelWeekly;
  if (labelMonthlyEl) labelMonthlyEl.innerText = STRINGS[lang].labelMonthly;

  renderWeekdays();
}

/* ─────────────────────────────────────────────
   STATS  — counts only current week & current month
   Uses isoToLocalDate() to avoid UTC timezone shift
   ───────────────────────────────────────────── */
function getStartOfWeek(now) {
  const d = new Date(now);
  const day = d.getDay(); // 0 = Sunday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday-based
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function updateStats() {
  let weeklyTotal = 0;
  let monthlyTotal = 0;

  const now = new Date();
  const curMonth = now.getMonth();
  const curYear = now.getFullYear();

  const weekStart = getStartOfWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  for (const dateISO in appointments) {
    const apptDate = isoToLocalDate(dateISO); /* ← FIXED: no UTC shift */
    const dailyCount = Object.keys(appointments[dateISO]).length;

    if (
      apptDate.getMonth() === curMonth &&
      apptDate.getFullYear() === curYear
    ) {
      monthlyTotal += dailyCount;
    }

    if (apptDate >= weekStart && apptDate <= weekEnd) {
      weeklyTotal += dailyCount;
    }
  }

  document.getElementById("weeklyCount").innerText = weeklyTotal;
  document.getElementById("monthlyCount").innerText = monthlyTotal;
}

/* ─────────────────────────────────────────────
   PERIODIC RESET
   • Monthly: clears ALL appointments on the 1st of each new month
   • Weekly:  clears appointments older than current Mon on each new week
   Both checks run silently at app start — data is only removed when
   the period has genuinely changed (key mismatch).
   ───────────────────────────────────────────── */
function checkPeriodicReset() {
  const now = new Date();

  /* ── Monthly reset ── */
  const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const lastMonthReset = localStorage.getItem("papounidis_last_reset");

  if (lastMonthReset && lastMonthReset !== currentMonthKey) {
    appointments = {};
    saveToStorage();
    console.log("New month: all appointments cleared.");
  }
  localStorage.setItem("papounidis_last_reset", currentMonthKey);

  /* ── Weekly reset ── */
  const weekStart = getStartOfWeek(now);
  const currentWeekKey = toLocalISODate(weekStart); // e.g. "2025-05-12"
  const lastWeekKey = localStorage.getItem("papounidis_last_week");

  if (lastWeekKey && lastWeekKey !== currentWeekKey) {
    // Remove any appointments that belong to a previous week
    // (within the same month — cross-month ones are already gone)
    for (const dateISO in appointments) {
      const apptDate = isoToLocalDate(dateISO);
      if (apptDate < weekStart) {
        delete appointments[dateISO];
      }
    }
    saveToStorage();
    console.log("New week: previous week appointments cleared.");
  }
  localStorage.setItem("papounidis_last_week", currentWeekKey);
}

function init() {
  loadFromStorage();
  checkPeriodicReset(); /* replaces old checkMonthlyReset */
  applyLanguage();

  const today = new Date();
  currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  selectedDateISO = toLocalISODate(today);

  renderCalendar();
  renderSlots(selectedDateISO);
  showCalendarView();
  updateStats(); /* draw correct counts on load */

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("service-worker.js")
        .catch((err) => console.warn("SW failed", err));
    });
  }
}

init();
