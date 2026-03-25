import { Router } from "express";
import { db } from "../../db/index.js";
import { referrals, patients } from "../../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../auth/index.js";

const router = Router();
router.use(requireAuth);

// ─── Get referrals for a patient ────────────────────────────────────

router.get("/patient/:patientId", async (req, res) => {
    try {
        const patientId = req.params.patientId as string;
        const result = await db
            .select()
            .from(referrals)
            .where(eq(referrals.patientId, patientId))
            .orderBy(desc(referrals.createdAt));
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Get all pending referrals ──────────────────────────────────────

router.get("/pending", async (_req, res) => {
    try {
        const result = await db
            .select({
                id: referrals.id,
                patientId: referrals.patientId,
                patientName: patients.firstName,
                patientLastName: patients.lastName,
                patientFileNumber: patients.fileNumber,
                referredTo: referrals.referredTo,
                specialty: referrals.specialty,
                reason: referrals.reason,
                status: referrals.status,
                createdAt: referrals.createdAt,
            })
            .from(referrals)
            .innerJoin(patients, eq(referrals.patientId, patients.id))
            .where(eq(referrals.status, "pending"))
            .orderBy(desc(referrals.createdAt));
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Create referral ────────────────────────────────────────────────

router.post("/", async (req, res) => {
    try {
        const { visitId, patientId, referredTo, specialty, reason, notes } = req.body;
        if (!visitId || !patientId || !referredTo) {
            return res.status(400).json({ error: "visitId, patientId, referredTo required" });
        }

        const [referral] = await db
            .insert(referrals)
            .values({ visitId, patientId, referredTo, specialty, reason, notes })
            .returning();
        res.status(201).json(referral);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Update referral status ─────────────────────────────────────────

router.patch("/:id", async (req, res) => {
    try {
        const id = req.params.id as string;
        const { status, notes } = req.body;

        const updates: any = {};
        if (status) updates.status = status;
        if (notes !== undefined) updates.notes = notes;

        const [updated] = await db
            .update(referrals)
            .set(updates)
            .where(eq(referrals.id, id))
            .returning();

        if (!updated) return res.status(404).json({ error: "Referral not found" });
        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Delete referral ────────────────────────────────────────────────

router.delete("/:id", async (req, res) => {
    try {
        const id = req.params.id as string;
        await db.delete(referrals).where(eq(referrals.id, id));
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export { router as referralRouter };
