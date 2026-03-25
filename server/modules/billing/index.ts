import { Router } from "express";
import { db } from "../../db/index.js";
import { billings, payments, visits, patients } from "../../db/schema.js";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";
import { insertBillingSchema, insertPaymentSchema } from "../../../shared/types.js";
import { requireAuth } from "../auth/index.js";
import { broadcast } from "../../ws.js";

const router = Router();
router.use(requireAuth);

// ─── Get billing for a visit ────────────────────────────────────────

router.get("/visit/:visitId", async (req, res) => {
    try {
        const billing = await db.query.billings.findFirst({
            where: eq(billings.visitId, req.params.visitId),
            with: { payments: true },
        });
        res.json(billing || null);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Billing summary (default: today, or filtered by date) ──────────

router.get("/", async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let start = new Date();
        let end = new Date();

        if (startDate) {
            // Parse as local date explicitly
            const [year, month, day] = (startDate as string).split("-").map(Number);
            start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
        } else {
            const tempStart = new Date();
            start = new Date(Date.UTC(tempStart.getFullYear(), tempStart.getMonth(), tempStart.getDate(), 0, 0, 0, 0));
        }

        if (endDate) {
            const [year, month, day] = (endDate as string).split("-").map(Number);
            end = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
        } else {
            const tempEnd = new Date();
            end = new Date(Date.UTC(tempEnd.getFullYear(), tempEnd.getMonth(), tempEnd.getDate(), 23, 59, 59, 999));
        }

        const results = await db
            .select({
                billing: billings,
                patientFirstName: patients.firstName,
                patientLastName: patients.lastName,
            })
            .from(billings)
            .innerJoin(visits, eq(billings.visitId, visits.id))
            .innerJoin(patients, eq(visits.patientId, patients.id))
            .where(
                and(
                    gte(billings.createdAt, start),
                    lte(billings.createdAt, end)
                )
            )
            .orderBy(desc(billings.createdAt));

        const items = results.map((r) => ({
            ...r.billing,
            patientName: `${r.patientFirstName} ${r.patientLastName}`,
        }));

        // Calculate totals
        const totalBilled = items.reduce((sum, b) => sum + Number(b.totalAmount), 0);
        const totalPaid = items.reduce((sum, b) => sum + Number(b.paidAmount), 0);

        res.json({ items, totalBilled, totalPaid, outstanding: totalBilled - totalPaid });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Create or update billing ───────────────────────────────────────

router.post("/", async (req, res) => {
    try {
        const data = insertBillingSchema.parse(req.body);

        // Check if billing already exists for this visit
        const [existing] = await db
            .select()
            .from(billings)
            .where(eq(billings.visitId, data.visitId))
            .limit(1);

        const isZeroBill = Number(data.totalAmount) === 0;

        let billing;
        if (existing) {
            [billing] = await db
                .update(billings)
                .set({
                    totalAmount: data.totalAmount,
                    currency: data.currency,
                    notes: data.notes,
                    status: isZeroBill ? "paid" : existing.status,
                    paidAmount: isZeroBill ? data.totalAmount : existing.paidAmount,
                })
                .where(eq(billings.id, existing.id))
                .returning();
        } else {
            [billing] = await db.insert(billings).values({
                ...data,
                status: isZeroBill ? "paid" : "unpaid",
                paidAmount: isZeroBill ? data.totalAmount : "0",
            }).returning();
        }

        broadcast("billing:update", billing);
        res.status(201).json(billing);
    } catch (error: any) {
        if (error.name === "ZodError") return res.status(400).json({ error: error.errors });
        res.status(500).json({ error: error.message });
    }
});

// ─── Record payment ─────────────────────────────────────────────────

router.post("/payments", async (req, res) => {
    try {
        const data = insertPaymentSchema.parse(req.body);
        const [payment] = await db.insert(payments).values(data).returning();

        // Update billing paid amount
        const [billing] = await db
            .select()
            .from(billings)
            .where(eq(billings.id, data.billingId))
            .limit(1);

        if (billing) {
            const allPayments = await db
                .select()
                .from(payments)
                .where(eq(payments.billingId, billing.id));

            const totalPaid = allPayments.reduce((sum, p) => sum + Number(p.amount), 0);

            await db
                .update(billings)
                .set({
                    paidAmount: totalPaid.toString(),
                    status: totalPaid >= Number(billing.totalAmount) ? "paid" : "partial",
                })
                .where(eq(billings.id, billing.id));
        }

        broadcast("billing:update", { billingId: data.billingId });
        res.status(201).json(payment);
    } catch (error: any) {
        if (error.name === "ZodError") return res.status(400).json({ error: error.errors });
        res.status(500).json({ error: error.message });
    }
});

export { router as billingRouter };
