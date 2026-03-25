import { Router } from "express";
import { db } from "../../db/index.js";
import { appointments, patients, users } from "../../db/schema.js";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { insertAppointmentSchema } from "../../../shared/types.js";
import { requireAuth } from "../auth/index.js";

const router = Router();
router.use(requireAuth);

// ─── List appointments by date (or date range) ─────────────────────

router.get("/", async (req, res) => {
    try {
        const { date, from, to } = req.query as Record<string, string>;

        let dateFrom = date || from || new Date().toISOString().split("T")[0];
        let dateTo = date || to || dateFrom;

        const result = await db
            .select({
                appointment: appointments,
                patientFirstName: patients.firstName,
                patientLastName: patients.lastName,
                patientPhone: patients.phone,
                doctorName: users.displayName,
            })
            .from(appointments)
            .leftJoin(patients, eq(appointments.patientId, patients.id))
            .leftJoin(users, eq(appointments.doctorId, users.id))
            .where(
                and(
                    gte(appointments.appointmentDate, dateFrom),
                    lte(appointments.appointmentDate, dateTo)
                )
            )
            .orderBy(appointments.appointmentDate, appointments.timeSlot);

        const flattened = result.map(({ appointment, patientFirstName, patientLastName, patientPhone, doctorName }) => ({
            ...appointment,
            patientName: `${patientFirstName || ""} ${patientLastName || ""}`.trim(),
            patientPhone,
            doctorName,
        }));

        res.json(flattened);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Get upcoming appointments for a patient ────────────────────────

router.get("/patient/:patientId", async (req, res) => {
    try {
        const today = new Date().toISOString().split("T")[0];
        const result = await db.query.appointments.findMany({
            where: and(
                eq(appointments.patientId, req.params.patientId),
                gte(appointments.appointmentDate, today)
            ),
            orderBy: [appointments.appointmentDate, appointments.timeSlot],
        });
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Create appointment ─────────────────────────────────────────────

router.post("/", async (req, res) => {
    try {
        const data = insertAppointmentSchema.parse(req.body);
        const [appointment] = await db.insert(appointments).values(data).returning();
        res.status(201).json(appointment);
    } catch (error: any) {
        if (error.name === "ZodError") return res.status(400).json({ error: error.errors });
        res.status(500).json({ error: error.message });
    }
});

// ─── Update appointment ─────────────────────────────────────────────

router.put("/:id", async (req, res) => {
    try {
        const data = insertAppointmentSchema.partial().parse(req.body);
        const [appointment] = await db
            .update(appointments)
            .set(data)
            .where(eq(appointments.id, req.params.id))
            .returning();

        if (!appointment) return res.status(404).json({ error: "Appointment not found" });
        res.json(appointment);
    } catch (error: any) {
        if (error.name === "ZodError") return res.status(400).json({ error: error.errors });
        res.status(500).json({ error: error.message });
    }
});

// ─── Update appointment status ──────────────────────────────────────

router.patch("/:id/status", async (req, res) => {
    try {
        const { status } = req.body;
        const [appointment] = await db
            .update(appointments)
            .set({ status })
            .where(eq(appointments.id, req.params.id))
            .returning();

        if (!appointment) return res.status(404).json({ error: "Appointment not found" });
        res.json(appointment);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Delete appointment ─────────────────────────────────────────────

router.delete("/:id", async (req, res) => {
    try {
        await db.delete(appointments).where(eq(appointments.id, req.params.id));
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export { router as appointmentRouter };
