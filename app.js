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
  },
};

/* DOM */
const monthLabel = document.getElementById("monthLabel");
const calendarGrid = document.getElementById("calendarGrid");
const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");
const selectedLabel = document.getElementById("selectedLabel");
const slotsContainer = document.getElementById("slotsContainer");
const langToggle = document.getElementById("langToggle");
const clearBtn = document.getElementById("clearBtn");
const installHint = document.getElementById("installHint");

/* NEW DOM Elements for Layout Toggle */
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

let appointments = {}; // loaded from storage
let currentMonth = new Date();
let selectedDateISO = null; // default today
let activeSlot = null; // {date, time}
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
/* Local date helper (no UTC shift) */
function toLocalISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/* VIEW SWITCHING LOGIC (Sequential Slides) */

function showSlotsView() {
  // 1. Animate Calendar Sliding OUT to the Left
  calendarSection.classList.add("anim-exit-left");

  // 2. Wait 300ms for animation to finish, then swap views
  setTimeout(() => {
    calendarSection.style.display = "none";
    calendarSection.classList.remove("anim-exit-left"); // Cleanup

    // 3. Show Slots and Animate IN from the Right
    slotsSection.style.display = "block";

    // Force reflow to ensure animation plays
    void slotsSection.offsetWidth;

    slotsSection.classList.remove("anim-enter-left", "anim-exit-right"); // Clean old classes
    slotsSection.classList.add("anim-enter-right");
  }, 280); // Slight overlap (280ms) makes it feel snappier
}

function showCalendarView() {
  // 1. Animate Slots Sliding OUT to the Right
  slotsSection.classList.add("anim-exit-right");

  // 2. Wait for animation to finish
  setTimeout(() => {
    slotsSection.style.display = "none";
    slotsSection.classList.remove("anim-exit-right"); // Cleanup

    // 3. Show Calendar and Animate IN from the Left
    calendarSection.style.display = "block";

    // Force reflow
    void calendarSection.offsetWidth;

    calendarSection.classList.remove("anim-enter-right", "anim-exit-left"); // Clean old classes
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

/* Render calendar */
function renderCalendar() {
  calendarGrid.innerHTML = "";
  monthLabel.textContent = formatMonthLabel(currentMonth);

  const start = startOfMonth(currentMonth);
  const end = endOfMonth(currentMonth);
  const startDow = start.getDay(); // 0 = Sunday
  const prevFill = startDow;
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
    if (d.getMonth() !== currentMonth.getMonth())
      dayEl.classList.add("inactive");
    if (iso === selectedDateISO) dayEl.classList.add("selected");
    dayEl.type = "button";
    dayEl.setAttribute("data-date", iso);
    dayEl.innerText = d.getDate();

    // Navigation Logic: Click Date -> Show Slots
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

/* Time slot generation: 07:00 to 24:00 every 20 minutes */
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

  // Date Label Fix
  const parts = dateISO.split("-").map((p) => parseInt(p, 10)); // [YYYY, MM, DD]
  const d = new Date(parts[0], parts[1] - 1, parts[2]);

  selectedLabel.textContent = d.toLocaleDateString(
    lang === "el" ? "el-GR" : "en-US",
    { weekday: "short", month: "short", day: "numeric", year: "numeric" }
  );

  slotsContainer.innerHTML = "";
  const dayAppts = appointments[dateISO] || {};

  // Standard Grid Layout (No slider, no pages)
  TIMES.forEach((time) => {
    const btn = document.createElement("button");
    btn.className = "slot";
    btn.setAttribute("data-time", time);

    const [hh, mm] = time.split(":").map(Number);
    const tDisplay = new Date(1970, 0, 1, hh % 24, mm).toLocaleTimeString(
      lang === "el" ? "el-GR" : "en-US",
      { hour: "numeric", minute: "2-digit" }
    );

    if (dayAppts[time]) {
      btn.classList.add("booked");
      // Persist Red Text for Booked Slots
      btn.classList.add("slot-booked-highlight");

      btn.innerHTML = `<div class="time">${tDisplay}</div><div class="client">${escapeHtml(
        dayAppts[time].name
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
    { hour: "numeric", minute: "2-digit" }
  );
}
function escapeHtml(s) {
  if (!s) return "";
  return String(s).replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ])
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

  const timeToFlash = activeSlot.time;
  closeModal();

  // Animation logic
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
    1
  );
  renderCalendar();
});
nextMonthBtn.addEventListener("click", () => {
  currentMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    1
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

  // Update Back Button Text
  backToCalendarBtn.innerHTML = `‹ <span>${STRINGS[lang].back}</span>`;
}

function init() {
  loadFromStorage();
  applyLanguage();

  const today = new Date();
  currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  selectedDateISO = toLocalISODate(today);

  // Initialize view: Show Calendar first
  renderCalendar();
  renderSlots(selectedDateISO);
  showCalendarView();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("service-worker.js")
        .catch((err) => console.warn("SW failed", err));
    });
  }
}

init();
