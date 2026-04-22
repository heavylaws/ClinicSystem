# DermClinic System - AI Handoff & Windows Migration Guide

Hello, AI Assistant! If you are reading this on the new Windows 11 machine, you have just inherited the `DermClinic` project. This document serves as a comprehensive handoff to give you the full context of what this system is, its architecture, recent major updates, and what your immediate goals are for getting it running on Windows.

## 🏗️ Architecture & Tech Stack
- **Frontend**: React, Vite, Tailwind CSS, React Query.
- **Backend**: Node.js, Express.
- **Database**: PostgreSQL (currently v14+ on Linux, targeting v16 on Windows).
- **ORM**: Drizzle ORM (`server/db/schema.ts`).
- **Network**: The Vite dev server handles both frontend serving and backend proxying. It runs on port `5174` and binds to `0.0.0.0` for local network access.

## 🚀 Recent Major Implementations
To give you an idea of the codebase's current state, here are the most recent features added before the migration:
1. **Insurance / Assurance Field**: Added an `insurance` field to the `patients` schema. It features an autocomplete dropdown that queries the backend for existing insurance companies. Over 13,000 legacy insurance records were imported.
2. **Data Merge Script**: Created `scripts/merge-backup-data.ts`. This was a critical fix for timezone/date-matching issues from the legacy SQL Server. It safely imports missing diagnoses, appointments, and lab tests without duplicating existing data.
3. **Reports Sorting**: Implemented client-side column sorting on the "Custom Prescription Report" table (`Reports.tsx`).
4. **Print Optimization**: A5-optimized printables for prescriptions, lab tests, and clinical notes.
5. **AI Chatbot**: Integrated a Gemini-powered multilingual chatbot (`Chatbot.tsx`) that reads from `GEMINI_API_KEY` in the `.env` file.
6. **System Startup Screen**: Added a loading screen (`StartupScreen.tsx`) that polls the backend health endpoint to prevent users from interacting before the backend (database and Express) is fully ready.

## 💾 Data Migration Status
**CRITICAL CONTEXT**: All data from the old Linux machine has been exported to a full PostgreSQL dump. 
- The dump file should be available via USB or a shared folder (e.g., `dermclinic_full_20260423.sql`).
- This dump contains **every single record** (35k+ patients, 59k+ visits, 131k+ prescriptions).
- **Do not** run any legacy JSON imports (`load-legacy-data.ts`). You ONLY need to restore the `.sql` dump.

## 📋 Your Immediate Tasks (Windows Setup)
Your primary goal is to get this system running locally on Windows 11 and accessible by other clients on the local network. 

Please execute or guide the user through the following steps:

### 1. Prerequisites (Ensure these are installed)
- **Node.js**: v20 LTS.
- **PostgreSQL**: Version 16. During installation, the password should be set to `postgres` and port to `5432`. Ensure `psql` is added to the Windows PATH.
- **Git**: For pulling latest changes (already done if you're reading this).

### 2. Environment Setup
Create a `.env` file in the project root (`C:\clinicsystem` or similar) with the following exact variables:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dermclinic
PORT=3002
HOST=0.0.0.0
SESSION_SECRET=dermclinic-local-session-secret
NODE_ENV=development
GEMINI_API_KEY=<insert-api-key-here>
```

### 3. Database Restoration
1. Open a Command Prompt or PowerShell terminal.
2. Create the database: `psql -U postgres -c "CREATE DATABASE dermclinic;"`
3. Restore the data: `psql -U postgres -d dermclinic -f path\to\dermclinic_full_20260423.sql`
4. Verify data: `psql -U postgres -d dermclinic -c "SELECT COUNT(*) FROM patients;"` (Should be ~35,584).

### 4. Network Configuration (Crucial)
The app must be accessible to other devices in the clinic (receptionist, doctor's tablet).
1. Open Windows Defender Firewall with Advanced Security.
2. Create a new **Inbound Rule**.
3. Set to **Port**, **TCP**, Specific local ports: `5174`.
4. Allow the connection for all profiles (Domain, Private, Public).
5. Name it "DermClinic Server".
*Find the Windows machine's IP (e.g., `192.168.1.100`) using `ipconfig`. Other machines will access the app via `http://192.168.1.100:5174`.*

### 5. Auto-Start Configuration
The app needs to run automatically when the Windows machine boots up.
1. Create a `start-dermclinic.bat` file in the project root:
   ```bat
   @echo off
   cd /d "%~dp0"
   npm run dev
   ```
2. Place a shortcut to this `.bat` file in the Windows Startup folder (`Win + R`, type `shell:startup`).
3. Create a desktop shortcut for the doctor pointing to `http://localhost:5174`.

## 🤝 Handoff Complete
You are now fully caught up. Run `npm install`, then `npm run dev` to start the development server. Ensure the database connects correctly and the startup health checks pass!
