import { Router } from "express";
import { db } from "../../db/index.js";
import { settings } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../auth/index.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";

const router = Router();
router.use(requireAuth);

const BACKUP_DIR = path.join(process.cwd(), "bu_backup");
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, BACKUP_DIR),
    filename: (_req, _file, cb) => cb(null, "bu.bak"),
});

const upload = multer({
    storage,
    limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB max limit for .bak
});

// ─── Get all settings ───────────────────────────────────────────────

router.get("/", async (_req, res) => {
    try {
        const allSettings = await db.select().from(settings);
        // Convert to key-value object
        const obj: Record<string, string> = {};
        for (const s of allSettings) {
            obj[s.key] = s.value;
        }
        res.json(obj);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Update settings (admin only) ───────────────────────────────────

router.put("/", requireRole("admin"), async (req, res) => {
    try {
        const entries = req.body as Record<string, string>;

        for (const [key, value] of Object.entries(entries)) {
            const [existing] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
            if (existing) {
                await db.update(settings).set({ value, updatedAt: new Date() }).where(eq(settings.key, key));
            } else {
                await db.insert(settings).values({ key, value });
            }
        }

        // Return updated settings
        const allSettings = await db.select().from(settings);
        const obj: Record<string, string> = {};
        for (const s of allSettings) {
            obj[s.key] = s.value;
        }
        res.json(obj);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Restore Database (admin only) ──────────────────────────────────

router.post("/restore", requireRole("admin"), upload.single("backup"), (req, res) => {
    if (!req.file) {
        res.status(400).json({ error: "No backup file uploaded" });
        return;
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Connection", "keep-alive");
    req.setTimeout(0); // Disable timeout since migration can take a while

    const scriptPath = path.join(process.cwd(), "scripts", "migrate.ts");
    const child = spawn("npx", ["tsx", scriptPath, req.file.path], {
        cwd: process.cwd(),
    });

    child.stdout.on("data", (data) => {
        res.write(data.toString());
    });

    child.stderr.on("data", (data) => {
        res.write(data.toString());
    });

    child.on("close", (code) => {
        res.write(`\nProcess exited with code ${code}\n`);
        res.end();
    });
});

export { router as settingsRouter };
