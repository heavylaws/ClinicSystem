import { Router } from "express";
import { db } from "../../db/index.js";
import {
    visits,
    diagnoses,
    prescriptions,
    labOrders,
    procedureLogs,
    billings,
    patients,
} from "../../db/schema.js";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { insertVisitSchema, insertDiagnosisSchema, insertPrescriptionSchema, insertLabOrderSchema, insertProcedureSchema } from "../../../shared/types.js";
import { requireAuth } from "../auth/index.js";
import { broadcast } from "../../ws.js";
import { learnTerm } from "../autocomplete/index.js";

const router = Router();
router.use(requireAuth);

// ─── Get today's queue ──────────────────────────────────────────────

router.get("/queue", async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const result = await db
            .select({
                visit: visits,
                patientFirstName: patients.firstName,
                patientLastName: patients.lastName,
                patientFileNumber: patients.fileNumber,
            })
            .from(visits)
            .innerJoin(patients, eq(visits.patientId, patients.id))
            .where(sql`${visits.startedAt} >= ${today}`)
            .orderBy(visits.startedAt);

        const queue = result.map((r) => ({
            ...r.visit,
            patientName: `${r.patientFirstName} ${r.patientLastName}`,
            patientFileNumber: r.patientFileNumber,
        }));

        res.json(queue);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Get visits for a patient ───────────────────────────────────────

router.get("/patient/:patientId", async (req, res) => {
    try {
        const patientVisits = await db.query.visits.findMany({
            where: eq(visits.patientId, req.params.patientId),
            with: {
                diagnoses: true,
                prescriptions: true,
                labOrders: true,
                procedures: true,
                images: true,
                billing: {
                    with: {
                        payments: true,
                    },
                },
            },
            orderBy: [desc(visits.startedAt)],
        });

        res.json(patientVisits);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Get single visit with all details ──────────────────────────────

router.get("/:id", async (req, res) => {
    try {
        const visit = await db.query.visits.findFirst({
            where: eq(visits.id, req.params.id),
            with: {
                patient: true,
                diagnoses: true,
                prescriptions: true,
                labOrders: true,
                procedures: true,
                images: true,
                billing: {
                    with: {
                        payments: true,
                    },
                },
            },
        });

        if (!visit) return res.status(404).json({ error: "Visit not found" });
        res.json(visit);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Create visit (queue patient) ───────────────────────────────────

router.post("/", async (req, res) => {
    try {
        const data = insertVisitSchema.parse(req.body);

        // Calculate visit number for this patient
        const [{ count: prevCount }] = await db
            .select({ count: count() })
            .from(visits)
            .where(eq(visits.patientId, data.patientId));

        const [visit] = await db
            .insert(visits)
            .values({
                ...data,
                visitNumber: Number(prevCount) + 1,
                doctorId: (req.user as any)?.role === "doctor" ? (req.user as any).id : null,
                status: "queued",
            })
            .returning();

        // Update patient's updatedAt
        await db
            .update(patients)
            .set({ updatedAt: new Date() })
            .where(eq(patients.id, data.patientId));

        broadcast("queue:update", { action: "added", visit });
        res.status(201).json(visit);
    } catch (error: any) {
        if (error.name === "ZodError") return res.status(400).json({ error: error.errors });
        res.status(500).json({ error: error.message });
    }
});

// ─── Update visit status ────────────────────────────────────────────

router.patch("/:id/status", async (req, res) => {
    try {
        const { status } = req.body;
        const updateData: any = { status };

        if (status === "in_progress") {
            updateData.doctorId = (req.user as any)?.id;
        }
        if (status === "completed") {
            updateData.completedAt = new Date();
        }

        const [visit] = await db
            .update(visits)
            .set(updateData)
            .where(eq(visits.id, req.params.id))
            .returning();

        if (!visit) return res.status(404).json({ error: "Visit not found" });

        broadcast("queue:update", { action: "status_changed", visit });
        res.json(visit);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Delete queued visit (remove from queue) ────────────────────────

router.delete("/:id", async (req, res) => {
    try {
        // Only allow deleting visits that are still "queued"
        const visit = await db.query.visits.findFirst({
            where: eq(visits.id, req.params.id),
        });

        if (!visit) return res.status(404).json({ error: "Visit not found" });
        if (visit.status !== "queued") {
            return res.status(400).json({ error: "Only queued visits can be removed" });
        }

        await db.delete(visits).where(eq(visits.id, req.params.id));

        broadcast("queue:update", { action: "removed", visitId: req.params.id });
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Update visit clinical notes (auto-save) ────────────────────────

router.patch("/:id/notes", async (req, res) => {
    try {
        const { chiefComplaint, clinicalNotes, examination } = req.body;
        const [visit] = await db
            .update(visits)
            .set({
                chiefComplaint: chiefComplaint ?? undefined,
                clinicalNotes: clinicalNotes ?? undefined,
                examination: examination ?? undefined,
            })
            .where(eq(visits.id, req.params.id))
            .returning();

        if (!visit) return res.status(404).json({ error: "Visit not found" });
        res.json(visit);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Add diagnosis ──────────────────────────────────────────────────

router.post("/:id/diagnoses", async (req, res) => {
    try {
        const data = insertDiagnosisSchema.parse({ ...req.body, visitId: req.params.id });
        const [diagnosis] = await db.insert(diagnoses).values(data).returning();

        // Learn the term
        await learnTerm("diagnosis", data.name);

        res.status(201).json(diagnosis);
    } catch (error: any) {
        if (error.name === "ZodError") return res.status(400).json({ error: error.errors });
        res.status(500).json({ error: error.message });
    }
});

// ─── Delete diagnosis ───────────────────────────────────────────────

router.delete("/diagnoses/:diagId", async (req, res) => {
    try {
        await db.delete(diagnoses).where(eq(diagnoses.id, req.params.diagId));
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Add prescription ───────────────────────────────────────────────

router.post("/:id/prescriptions", async (req, res) => {
    try {
        const data = insertPrescriptionSchema.parse({ ...req.body, visitId: req.params.id });
        const [prescription] = await db.insert(prescriptions).values(data).returning();

        await learnTerm("medication", data.medicationName);

        res.status(201).json(prescription);
    } catch (error: any) {
        if (error.name === "ZodError") return res.status(400).json({ error: error.errors });
        res.status(500).json({ error: error.message });
    }
});

// ─── Delete prescription ────────────────────────────────────────────

router.delete("/prescriptions/:rxId", async (req, res) => {
    try {
        await db.delete(prescriptions).where(eq(prescriptions.id, req.params.rxId));
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Add lab order ──────────────────────────────────────────────────

router.post("/:id/lab-orders", async (req, res) => {
    try {
        const data = insertLabOrderSchema.parse({ ...req.body, visitId: req.params.id });
        const [order] = await db.insert(labOrders).values(data).returning();

        await learnTerm("lab_test", data.testName);

        res.status(201).json(order);
    } catch (error: any) {
        if (error.name === "ZodError") return res.status(400).json({ error: error.errors });
        res.status(500).json({ error: error.message });
    }
});

// ─── Delete lab order ───────────────────────────────────────────────

router.delete("/lab-orders/:labId", async (req, res) => {
    try {
        await db.delete(labOrders).where(eq(labOrders.id, req.params.labId));
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Add procedure ──────────────────────────────────────────────────

router.post("/:id/procedures", async (req, res) => {
    try {
        const data = insertProcedureSchema.parse({ ...req.body, visitId: req.params.id });
        const [proc] = await db.insert(procedureLogs).values({
            ...data,
            cost: data.cost || undefined,
        }).returning();

        await learnTerm("procedure", data.procedureName);

        res.status(201).json(proc);
    } catch (error: any) {
        if (error.name === "ZodError") return res.status(400).json({ error: error.errors });
        res.status(500).json({ error: error.message });
    }
});

// ─── Delete procedure ───────────────────────────────────────────────

router.delete("/procedures/:procId", async (req, res) => {
    try {
        await db.delete(procedureLogs).where(eq(procedureLogs.id, req.params.procId));
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export { router as visitRouter };
