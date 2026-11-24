# PulseCare HMS — 4-Screen Clinical Lookup Prototype

A clean, responsive 4-screen clinical web application prototype for hospital provider lookup and patient consent gating. Built with **HTML5/JS + Tailwind CSS** (plus an accompanying **React 18 + Tailwind** version).

No external database or backend server required — all state and mock data are managed in-memory in the frontend.

---

## 🚀 Live Demo & How to Run

You have multiple zero-friction options to launch and test this application:

### Option 1: Direct File Open (Instant)
Simply open [`index.html`](./index.html) directly in Google Chrome, Safari, Microsoft Edge, or Firefox.

### Option 2: Local HTTP Server (Zero Dependencies)
Run the built-in Node static server:
```bash
npm start
# or: node server.js
```
Then visit: **[http://localhost:3000](http://localhost:3000)**

*(To test the React version, open **[http://localhost:3000/react-app.html](http://localhost:3000/react-app.html)** or double-click `react-app.html`)*

---

## 📋 The 4-Screen Straight-Through Flow

```
[1. Login Page] ──(Valid: iron_man / 1234)──> [2. Scan/Lookup Page]
                                                    │
                                                    ▼ (Valid ID: P001)
[4. Happy Page (Full Record)] <──(Valid PIN: 1234)── [3. Consent Gate Page]
```

### 1. Login Page
- **Fields**: Username and Password input fields, "Authenticate & Continue" button.
- **Hardcoded Account**:
  - Username: `iron_man`
  - Password: `1234`
- **Validation**:
  - Wrong credentials: Shows inline error alert (`"Invalid credentials. Please verify your username and password."`) and stays on the page.
  - Correct credentials: Sets provider state in-memory and transitions to **Scan/Lookup Page**.
- **Bonus Feature**: Includes a quick "Auto-fill" demo chip and a toggle to show/hide the password.

### 2. Scan / Lookup Page
- **Fields**: Patient ID text input, "Look up Patient" button.
- **Hardcoded Patient ID**: `P001` (case-insensitive: accepts `P001` or `p001`).
- **Validation**:
  - No match: Shows inline error alert (`No matching patient record found for ID "..."`) and stays on the page.
  - Match: Stores validated patient ID in memory and transitions to **Consent Gate Page**.
- **Bonus Feature**: "Simulate Barcode / QR Scan" button that demonstrates simulated wristband scanning.

### 3. Consent Gate Page
- **Fields**: 4-digit PIN input field, "Verify PIN & Access Record" button.
- **Hardcoded PIN**: `1234`
- **Validation**:
  - Wrong PIN: Shows inline error (`"Incorrect PIN, try again"`), **clears the field**, and stays on the page with input refocused.
  - Correct PIN: Transitions to **Happy Page (Full Patient Record)**.
- **Bonus Feature**: "&larr; Back to Patient Lookup" button if provider needs to re-enter ID.

### 4. Happy Page (Full Patient Record)
Acts as the full clinical patient record tied to `P001`:
- **Patient Demographics**:
  - Name: **Anthony Edward Stark (Tony Stark)**
  - Patient ID: **P001**
  - Age: **48 years** (DOB: May 29, 1978)
  - Gender: **Male**
  - Blood Group: **O+** (Prominently highlighted)
  - Emergency Contact & Address
- **Current Vitals (6 telemetry cards with normal reference badges)**:
  - Blood Pressure: `118/76 mmHg` (Normal)
  - Heart Rate: `72 bpm` (Normal Sinus)
  - SpO2 Oxygen Saturation: `99%` (Optimal)
  - Body Temperature: `98.6°F (37.0°C)` (Afebrile)
  - Respiratory Rate: `16 breaths/min` (Normal)
  - Blood Glucose: `94 mg/dL` (Fasting Normal)
- **Documented Allergies**:
  - Penicillin (Severe - High Alert: Anaphylaxis & angioedema)
  - Sulfa Antibiotics (Moderate: Urticaria & pruritus)
  - Radiocontrast Dye (Mild: Flushing & nausea)
- **Chronic Conditions**:
  - Essential Hypertension (Stage 1 Managed)
  - Cardiac Arrhythmia (Monitored / Stable)
  - Mild Obstructive Sleep Apnea (CPAP Controlled)
- **Clinical Visit History**:
  - 4 detailed clinical encounters with dates, department, attending MD (Dr. Bruce Banner, Dr. Stephen Strange, Dr. Christine Palmer, Dr. Helen Cho), diagnosis notes, prescription details, and status badges.
- **Navigation Controls**:
  - "New Patient Lookup" button to quickly restart the lookup flow.
  - "Sign out" provider button in the header.

---

## 🗂️ File Structure

| File | Description |
|---|---|
| `index.html` | Complete standalone single-page app (HTML5 + Tailwind CSS + Vanilla JS state machine) |
| `react-app.html` | React 18 + Tailwind implementation with hooks (`useState`) and Babel |
| `server.js` | Built-in Node.js HTTP server (zero external npm dependencies required) |
| `package.json` | Project scripts configuration (`npm start`) |
| `README.md` | Comprehensive documentation & test instructions |

---

## 🧪 Quick Test Matrix

| Step | Valid Input | Invalid Test Input | Expected Behavior on Invalid Input |
|---|---|---|---|
| **1. Login** | `iron_man` / `1234` | `admin` / `admin` | Shows error: "Invalid credentials. Please verify your username and password." |
| **2. Lookup** | `P001` | `P999` | Shows error: "No matching patient record found for ID "P999"..." |
| **3. Consent** | `1234` | `9999` | Shows error: "Incorrect PIN, try again", clears PIN field |
| **4. Happy Page** | N/A | N/A | Displays full medical chart, vitals, allergies, conditions, and visit history |
