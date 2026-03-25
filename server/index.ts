import "dotenv/config";
import express from "express";
import session from "express-session";
import cors from "cors";
import { createServer } from "http";
import { db } from "./db/index.js";
import { authRouter, setupPassport } from "./modules/auth/index.js";
import { patientRouter } from "./modules/patient/index.js";
import { visitRouter } from "./modules/visit/index.js";
import { autocompleteRouter } from "./modules/autocomplete/index.js";
import { billingRouter } from "./modules/billing/index.js";
import { reportRouter } from "./modules/report/index.js";
import { appointmentRouter } from "./modules/appointment/index.js";
import { imageRouter } from "./modules/images/index.js";
import { userRouter } from "./modules/user/index.js";
import { settingsRouter } from "./modules/settings/index.js";
import { followUpRouter } from "./modules/followup/index.js";
import { referralRouter } from "./modules/referral/index.js";
import { aiRouter } from "./modules/ai/index.js";
import { setupWebSocket } from "./ws.js";
import path from "path";

const app = express();
const server = createServer(app);

// ─── Middleware ──────────────────────────────────────────────────────

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));

const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || "dermclinic-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 8 * 60 * 60 * 1000, // 8 hours
        httpOnly: true,
        secure: false, // local network only
    },
});

app.use(sessionMiddleware);
setupPassport(app);

// ─── API Routes ─────────────────────────────────────────────────────

app.use("/api/auth", authRouter);
app.use("/api/patients", patientRouter);
app.use("/api/visits", visitRouter);
app.use("/api/autocomplete", autocompleteRouter);
app.use("/api/billing", billingRouter);
app.use("/api/reports", reportRouter);
app.use("/api/appointments", appointmentRouter);
app.use("/api/images", imageRouter);
app.use("/api/users", userRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/followups", followUpRouter);
app.use("/api/referrals", referralRouter);
app.use("/api/ai", aiRouter);

// ─── Static file serving for uploads ────────────────────────────────

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ─── Health check ───────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── WebSocket ──────────────────────────────────────────────────────

setupWebSocket(server);

// ─── Start ──────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || "3002");

server.listen(PORT, "0.0.0.0", () => {
    console.log(`🩺 DermClinic server running on http://0.0.0.0:${PORT}`);
});
