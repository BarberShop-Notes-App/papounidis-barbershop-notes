# 💈 Papounidis-Barbershop PWA (Appointment Manager)

A simple Progressive Web App (PWA) designed specifically for Papounidis-Barbershop to manage daily appointments. The app utilizes client-side **Local Storage** to save all data and is designed to work completely **offline**.

---

## 🔒 Access & Installation Guide (For Owner/Barber)

This app is hosted on a private link for limited access.




### **📱 How to Install on a Mobile Device (PWA)**

Installing the app makes it available directly from your phone's home screen, complete with the custom icon, and ensures full offline access.

1.  Open the **LIVE URL** above in your phone's browser (Chrome on Android or Safari on iOS).
2.  **On Android (Chrome):** Tap the **three-dot menu (⋮)**, then select **"Install app"** or **"Add to Home Screen."**
3.  **On iOS (Safari):** Tap the **Share button ($\uparrow$)** at the bottom, then select **"Add to Home Screen."**
4.  Confirm the installation. The app icon (barber scissors) will appear on your home screen.

---

## 🛠️ Developer Notes

### **Key Features**

- **Offline First:** All core functionality works without an internet connection.
- **Data Storage:** Appointments are stored locally in the browser's **Local Storage**.
- **Flash Animation:** Successfully booked slots flash with a **theme-matching red pulse**.
- **Icon:** Uses the custom `scissors.png` for both the favicon and the PWA home screen icon.

### **Cache Busting (Critical for Updates)**

Any time changes are made to `index.html`, `style.css`, `app.js`, or any asset files (like `scissors.png`), you **MUST** update the Service Worker cache version.

1.  Edit *`service-worker.js`*.
2.  Change the `CACHE_NAME` constant (e.g., from `"papounidis-shell-v5"` to `"papounidis-shell-v6"`).
3.  Push the changes to GitHub and redeploy. This forces client browsers to fetch the new files.

### **Files to Note**

| File                | Purpose                                                          |
| :------------------ | :--------------------------------------------------------------- |
| `app.js`            | Core logic, data handling, and all UI manipulation.              |
| `style.css`         | All styling, including the custom `danger-glow-pulse` animation. |
| `manifest.json`     | PWA metadata, including app name and home screen icons.          |
| `service-worker.js` | Enables offline functionality and manages caching of all assets. |
| `scissors.png`      | Custom icon for PWA and favicon.                                 |
