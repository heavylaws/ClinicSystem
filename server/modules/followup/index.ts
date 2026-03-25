import { Router } from "express";
import { db } from "../../db/index.js";
import { followUps, patients } from "../../db/schema.js";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { requireAuth } from "../auth/index.js";

const router = Router();
router.use(requireAuth);

// ─── Get follow-ups for a patient ───────────────────────────────────

router.get("/patient/:patientId", async (req, res) => {
    try {
        const patientId = req.params.patientId as string;
        const result = await db
            .select()
            .from(followUps)
            .where(eq(followUps.patientId, patientId))
            .orderBy(desc(followUps.scheduledDate));
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Get upcoming follow-ups (all patients) ─────────────────────────

router.get("/upcoming", async (_req, res) => {
    try {
        const today = new Date().toISOString().split("T")[0];
        const result = await db
            .select({
                id: followUps.id,
                patientId: followUps.patientId,
                patientName: patients.firstName,
                patientLastName: patients.lastName,
                patientFileNumber: patients.fileNumber,
                scheduledDate: followUps.scheduledDate,
                reason: followUps.reason,
                status: followUps.status,
                notes: followUps.notes,
            })
            .from(followUps)
            .innerJoin(patients, eq(followUps.patientId, patients.id))
            .where(and(eq(followUps.status, "pending"), gte(followUps.scheduledDate, today)))
            .orderBy(followUps.scheduledDate);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Get overdue follow-ups ─────────────────────────────────────────

router.get("/overdue", async (_req, res) => {
    try {
        const today = new Date().toISOString().split("T")[0];
        const result = await db
            .select({
                id: followUps.id,
                patientId: followUps.patientId,
                patientName: patients.firstName,
                patientLastName: patients.lastName,
                patientFileNumber: patients.fileNumber,
                scheduledDate: followUps.scheduledDate,
                reason: followUps.reason,
                status: followUps.status,
            })
            .from(followUps)
            .innerJoin(patients, eq(followUps.patientId, patients.id))
            .where(and(eq(followUps.status, "pending"), lte(followUps.scheduledDate, today)))
            .orderBy(followUps.scheduledDate);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Create follow-up ──────────────────────────────────────────────

router.post("/", async (req, res) => {
    try {
        const { visitId, patientId, scheduledDate, reason, notes } = req.body;
        if (!visitId || !patientId || !scheduledDate) {
            return res.status(400).json({ error: "visitId, patientId, scheduledDate required" });
        }

        const [followUp] = await db
            .insert(followUps)
            .values({ visitId, patientId, scheduledDate, reason, notes })
            .returning();
        res.status(201).json(followUp);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Update follow-up status ────────────────────────────────────────

router.patch("/:id", async (req, res) => {
    try {
        const id = req.params.id as string;
        const { status, notes } = req.body;

        const updates: any = {};
        if (status) updates.status = status;
        if (notes !== undefined) updates.notes = notes;

        const [updated] = await db
            .update(followUps)
            .set(updates)
            .where(eq(followUps.id, id))
            .returning();

        if (!updated) return res.status(404).json({ error: "Follow-up not found" });
        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Delete follow-up ──────────────────────────────────────────────

router.delete("/:id", async (req, res) => {
    try {
        const id = req.params.id as string;
        await db.delete(followUps).where(eq(followUps.id, id));
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export { router as followUpRouter };
