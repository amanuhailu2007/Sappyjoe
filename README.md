# Sappy Stationary - Cloud POS & Inventory System

A production-ready, responsive Point-of-Sale (POS) and inventory management web app designed specifically for **Sappy Stationary**, located in Addis Ababa, Ethiopia.

Built with React 19, Vite, TypeScript, Tailwind CSS, and a real **Firebase** backend (Firebase Authentication & Cloud Firestore).

---

## 🏬 Shop Specifications & Defaults

- **Shop Name**: Sappy Stationary (ሳፒ ስቴሽነሪ)
- **Location**: Bole Medhanialem, Addis Ababa, Ethiopia (Timezone: Africa/Addis_Ababa, UTC+3)
- **Currency**: Ethiopian Birr (`ETB`, e.g. `ETB 1,250.00`)
- **Tax Policy**: **TAX EXEMPT** (0% VAT by default; tax toggle available in Settings)
- **Payment Methods**: Cash, Telebirr, CBE Birr, Bank Transfer, and Card (with reference/transaction number capture)
- **Bilingual Interface**: English and Amharic (አማርኛ) with full Ethiopic script typography
- **Session Security**: 30-minute inactivity auto-logout (configurable in Settings)

---

## 🚀 Key Modules & Architecture

1. **POS / Checkout Terminal**
   - Instant search by item name, SKU, or live barcode scan.
   - Per-item quantity adjustments, item discounts, cart-level discounts.
   - Quick tender with change calculation and transaction reference numbers for Telebirr / CBE Birr / Bank Transfer.
   - Park / Hold carts to serve multi-customer queues.
   - 80mm thermal receipt generation with shop TIN, phone, address, cashier name, and barcode.

2. **Quick Sale Services Panel**
   - Instant line items for non-barcode stationery services (photocopy, B&W/color printing, lamination, spiral/thesis binding).
   - Admin-editable presets stored in Firestore.

3. **Dual Barcode Scanner**
   - Live camera scanner (EAN-13, Code 128, QR) with torch toggle and audio feedback.
   - Hardware USB / Bluetooth keyboard-wedge barcode gun listener.
   - Unknown barcode detection with automatic prompt to create a new catalog item.

4. **Barcode Studio & Label Designer**
   - EAN-13 and Code 128 vector barcode generation.
   - Printable shelf price labels and sticker sheets with shop name wordmark.

5. **Inventory & Stock Management**
   - Complete inventory catalog stored in Firestore.
   - Atomic Firestore transactions for stock deduction on sales.
   - Audit stock adjustments with reason logging (Restock, Damaged, Count Correction, Internal Use).

6. **Staff Management & Role-Based Access Control (Admin Only)**
   - Create staff accounts (Admin or Cashier) using a secondary Firebase Auth instance without signing out the current admin.
   - Role updates, activation/deactivation toggles, and password reset email triggers.
   - Deletion protection preventing deletion of staff with existing sales transactions.

---

## 🛠️ Real Firebase Setup & Configuration

This application connects to a **real Firebase backend** and does not use any mock or fake data fallbacks. If any required environment variable is missing, a full-screen configuration prompt is shown.

### 1. Create a Firebase Project
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Create a new Firebase project (or select an existing one).

### 2. Enable Firebase Authentication
1. Go to **Build > Authentication > Sign-in method**.
2. Click **Add new provider** and enable **Email/Password**.

### 3. Create Cloud Firestore
1. Go to **Build > Firestore Database**.
2. Click **Create database** (Start in **production mode**).
3. Choose your preferred region.

### 4. Deploy Firestore Security Rules
Deploy the included `firestore.rules` file:
```bash
firebase deploy --only firestore:rules
```

The security rules enforce:
- Unauthenticated access is denied across all collections.
- Only users with an active Firestore document (`active == true`) in `users/{uid}` can read or write data.
- Cashiers can only view their own sales transactions.
- Stock deductions during sales are strictly verified.
- Settings, inventory catalog, bulk import, and staff management are restricted to users with `role == 'admin'`.

### 5. Configure Environment Variables
Copy `.env.example` to `.env` in the root folder:
```bash
cp .env.example .env
```
Populate the values from your Firebase Project Settings:
```env
VITE_FIREBASE_API_KEY="AIzaSy..."
VITE_FIREBASE_AUTH_DOMAIN="your-app.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-app-id"
VITE_FIREBASE_STORAGE_BUCKET="your-app.appspot.com"
VITE_FIREBASE_MESSAGING_SENDER_ID="123456789012"
VITE_FIREBASE_APP_ID="1:123456789012:web:abcdef"
```

---

## 👤 Creating the First Administrator Account

Because public registration is disabled for security, follow these two steps to create the initial Admin account:

### Step 1: Create the User in Firebase Authentication
1. Go to **Firebase Console > Authentication > Users**.
2. Click **Add user**.
3. Enter an email (e.g. `admin@sappystationary.com`) and a secure password.
4. Copy the generated **User UID** (e.g. `abC123XyZ...`).

### Step 2: Create the User Document in Firestore
1. Go to **Firebase Console > Firestore Database**.
2. In the `users` collection, click **Add document**.
3. Set **Document ID** to the exact **User UID** copied from Step 1.
4. Add the following fields:
   - `id` (string): `<User UID>`
   - `email` (string): `admin@sappystationary.com`
   - `displayName` (string): `Store Admin`
   - `role` (string): `admin`
   - `active` (boolean): `true`
   - `createdAt` (string): `2026-10-29T00:00:00.000Z`

Once created, sign in at `/login`. The system will recognize the `admin` role and automatically bootstrap the `settings/store` document with default settings (Shop name: **Sappy Stationary**, currency: **ETB**, tax-exempt mode active).

Additional Cashier and Admin staff can then be invited directly through the in-app **Users** page.

---

## 🔒 Security & Route Guards

- All application screens require an authenticated user with an authorized, active account in Firestore (`active === true`).
- If an unauthorized or deactivated user attempts to sign in, they are immediately signed out and notified with `"Account not authorized."`
- Inactivity monitoring automatically ends the session after 30 minutes of no user interaction.
