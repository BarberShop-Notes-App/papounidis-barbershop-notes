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
const lblFree = document.getElementById("lblFree");
const lblBooked = document.getElementById("lblBooked");
const installHint = document.getElementById("installHint");

const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const inputName = document.getElementById("inputName");
const inputPhone = document.getElementById("inputPhone");
const saveBtn = document.getElementById("saveBtn");
const cancelBtn = document.getElementById("cancelBtn");
const deleteBtn = document.getElementById("deleteBtn");
const appTitleEl = document.getElementById("appTitle");
const subtitleEl = document.getElementById("subtitle");
const slotsCard = document.querySelector(".slots-card");

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
    const iso = d.toISOString().slice(0, 10);
    const dayEl = document.createElement("button");
    dayEl.className = "day";
    if (d.getMonth() !== currentMonth.getMonth())
      dayEl.classList.add("inactive");
    if (iso === selectedDateISO) dayEl.classList.add("selected");
    dayEl.type = "button";
    dayEl.setAttribute("data-date", iso);
    dayEl.innerText = d.getDate();

    // *** CORRECTED DATE TOGGLE LOGIC ***
    dayEl.addEventListener("click", (e) => {
      const clickedISO = e.currentTarget.getAttribute("data-date");

      if (selectedDateISO === clickedISO) {
        // CASE 1: Same date clicked -> DESELECT and HIDE slots
        selectedDateISO = null;
        renderSlots(null); // renderSlots(null) handles hiding the slotsCard
      } else {
        // CASE 2: Different date clicked -> SELECT and SHOW slots
        selectedDateISO = clickedISO;
        renderSlots(clickedISO);
      }

      // CRITICAL: We call renderCalendar again to update the "selected" visual state
      // based on the new value of the global variable `selectedDateISO`.
      renderCalendar();
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
  if (!dateISO) {
    slotsContainer.innerHTML = `<div class="placeholder">${STRINGS[lang].selectDate}</div>`;
    selectedLabel.textContent = STRINGS[lang].selectDate;
    slotsCard.style.display = "none";
    return;
  }
  slotsCard.style.display = "block";

  // label: CRITICAL FIX for Timezone Bug (Nov 10 -> Nov 9 shift)
  // We use Y, M, D components to force local date interpretation.
  const parts = dateISO.split("-").map((p) => parseInt(p, 10)); // [YYYY, MM, DD]
  const d = new Date(parts[0], parts[1] - 1, parts[2]); // Month is 0-indexed, so we subtract 1

  selectedLabel.textContent = d.toLocaleDateString(
    lang === "el" ? "el-GR" : "en-US",
    { weekday: "short", month: "short", day: "numeric", year: "numeric" }
  );

  slotsContainer.innerHTML = "";
  const dayAppts = appointments[dateISO] || {};

  // *** NEW PAGINATION LOGIC ***
  const ITEMS_PER_PAGE = 6; // 2 rows of 3 boxes
  let currentPage = null;

  TIMES.forEach((time, index) => {
    // 1. Create a new page every 6 items
    if (index % ITEMS_PER_PAGE === 0) {
      if (currentPage) {
        slotsContainer.appendChild(currentPage); // Append the finished page
      }
      currentPage = document.createElement("div");
      currentPage.className = "slot-page";
    }

    // 2. Create the time slot button (same as before)
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
      btn.innerHTML = `<div class="time">${tDisplay}</div><div class="client">${escapeHtml(
        dayAppts[time].name
      )}</div>`;
      btn.disabled = false;
    } else {
      btn.classList.add("free");
      btn.innerHTML = `<div class="time">${tDisplay}</div>`;
    }
    btn.addEventListener("click", () => openModalForSlot(dateISO, time));

    // 3. Append the button to the current page
    currentPage.appendChild(btn);
  });

  // 4. Append the final page
  if (currentPage) {
    slotsContainer.appendChild(currentPage);
  }
}
/* Modal handling */
function openModalForSlot(date, time) {
  activeSlot = { date, time };
  const booking = (appointments[date] || {})[time] || null;
  // Fill inputs or show existing
  inputName.value = booking ? booking.name : "";
  inputPhone.value = booking ? booking.phone : "";
  // show delete button only if exists
  deleteBtn.style.display = booking ? "inline-block" : "none";
  // labels/titles
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

  // 1. SAVE & RENDER
  saveToStorage();
  renderSlots(activeSlot.date);
  renderCalendar();

  // 💡 CRITICAL FIX: Save activeSlot.time *before* closeModal() runs
  const timeToFlash = activeSlot.time;

  // Close the modal and set activeSlot = null
  closeModal();

  // 2. ANIMATION CODE: Now uses the safe, local variable timeToFlash
  setTimeout(() => {
    // Select the newly rendered slot that is booked AND has the correct time
    const selector = `.slot.booked[data-time="${timeToFlash}"]`;
    const bookedSlot = slotsContainer.querySelector(selector);

    if (bookedSlot) {
      bookedSlot.classList.add("flash-booked");
      // Remove class after animation (500ms)
      setTimeout(() => bookedSlot.classList.remove("flash-booked"), 500);
    }
  }, 50); // Small delay to ensure renderSlots finishes
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
      // if day empty remove date key
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

/* Month navigation */
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

/* Clear all bookings */
clearBtn.addEventListener("click", () => {
  if (confirm(STRINGS[lang].clearConfirm)) {
    appointments = {};
    saveToStorage();
    renderSlots(selectedDateISO);
    renderCalendar();
  }
});

/* Language toggle */
langToggle.addEventListener("click", () => {
  lang = lang === "en" ? "el" : "en";
  localStorage.setItem(LANG_KEY, lang);
  applyLanguage();
  renderCalendar();
  renderSlots(selectedDateISO);
});

/* apply language labels */
function applyLanguage() {
  appTitleEl.innerText = STRINGS[lang].appTitle;
  subtitleEl.innerText = STRINGS[lang].subtitle;
  //lblFree.innerText = STRINGS[lang].free;
  //lblBooked.innerText = STRINGS[lang].booked;
  installHint.innerText = STRINGS[lang].installHint;
  langToggle.innerText = lang === "en" ? "Ελληνικά" : "English";
}

/* Init */

function init() {
  loadFromStorage();
  applyLanguage();

  // 1. Get a reliable Date object for today.
  const today = new Date();

  // 2. FIX: Set currentMonth to the START of today's month.
  // This ensures the calendar grid opens to the correct month (e.g., November).
  currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // 3. FIX: Set selectedDateISO to today's date string (e.g., "2025-11-11").
  // This ensures the time slots are visible on first load.
  selectedDateISO = today.toISOString().slice(0, 10);

  renderCalendar(); // Renders November with today (e.g., 11th) selected
  renderSlots(selectedDateISO); // Renders slots for the 11th

  // register service worker
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("service-worker.js")
        .catch((err) => console.warn("SW failed", err));
    });
  }
}

init();
