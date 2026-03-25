import { Router } from "express";
import { db } from "../../db/index.js";
import { patients, visits } from "../../db/schema.js";
import { eq, ilike, or, and, sql, desc, count } from "drizzle-orm";
import { insertPatientSchema } from "../../../shared/types.js";
import { requireAuth } from "../auth/index.js";

const router = Router();
router.use(requireAuth);

// ─── Search patients (fuzzy) ────────────────────────────────────────

router.get("/search", async (req, res) => {
    try {
        const { firstName, middleName, lastName, lastVisit, q } = req.query;

        // If no params, return empty
        if (!firstName && !middleName && !lastName && !lastVisit && (!q || (q as string).length < 1)) {
            return res.json([]);
        }

        const conditions = [];

        if (firstName) conditions.push(ilike(patients.firstName, `%${firstName}%`));
        if (middleName) conditions.push(ilike(patients.fatherName, `%${middleName}%`)); // Assuming fatherName is mapped to middleName conceptually in this context, or is the middle name
        if (lastName) conditions.push(ilike(patients.lastName, `%${lastName}%`));

        if (q) {
            const queryStr = q as string;
            const words = queryStr.trim().split(/\s+/).filter(w => w.length > 0);

            // For each word in the query, it must match AT LEAST ONE of the following fields:
            const wordConditions = words.map(word => {
                const pattern = `%${word}%`;
                return or(
                    ilike(patients.firstName, pattern),
                    ilike(patients.lastName, pattern),
                    ilike(patients.fatherName, pattern),
                    ilike(patients.phone, pattern),
                    sql`CAST(${patients.fileNumber} AS TEXT) LIKE ${pattern}`
                );
            });

            // Ensure ALL words in the search query find a match across the fields
            if (wordConditions.length > 0) {
                conditions.push(and(...wordConditions));
            }
        }

        // Date filter requires joining with visits or using a subquery/EXISTS
        // Simpler approach: Filter by patients who have a visit on that date
        let dateCondition = undefined;
        if (lastVisit) {
            // This is a bit complex with just a WHERE clause on patients table.
            // We need to check if ANY visit matches the date.
            // Using a subquery for existence
            const searchDate = new Date(lastVisit as string);
            const startOfDay = new Date(searchDate.setHours(0, 0, 0, 0));
            const endOfDay = new Date(searchDate.setHours(23, 59, 59, 999));

            // We use key 'in' query for simplicity with the current Drizzle setup
            // "patient.id IN (SELECT patientId FROM visits WHERE startedAt BETWEEN start and end)"

            // However, constructing this purely with the query builder's `inArray` might be tricky without a separate query execution.
            // Let's use `exists` if possible, or just exact match on the patient's computed lastVisit if we had it, but we don't store it on patient.
            // A raw SQL within the where clause is often easiest for "id IN (...)"

            // Constructing the condition:
            dateCondition = sql`EXISTS (
                SELECT 1 FROM ${visits} 
                WHERE ${visits.patientId} = ${patients.id} 
                AND ${visits.startedAt} >= ${startOfDay.toISOString()} 
                AND ${visits.startedAt} <= ${endOfDay.toISOString()}
             )`;

            conditions.push(dateCondition);
        }

        const result = await db
            .select({
                patient: patients,
                visitCount: count(visits.id),
            })
            .from(patients)
            .leftJoin(visits, eq(visits.patientId, patients.id))
            .where(and(...conditions))
            .groupBy(patients.id)
            .orderBy(patients.lastName, patients.firstName)
            .limit(50);

        // Flatten result
        const flattened = result.map(({ patient, visitCount }) => ({
            ...patient,
            visitCount,
        }));

        res.json(flattened);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Get patient by ID with visit count ─────────────────────────────

router.get("/:id", async (req, res) => {
    try {
        const [patient] = await db
            .select()
            .from(patients)
            .where(eq(patients.id, req.params.id))
            .limit(1);

        if (!patient) return res.status(404).json({ error: "Patient not found" });

        // Get visit count
        const [{ count: visitCount }] = await db
            .select({ count: count() })
            .from(visits)
            .where(eq(visits.patientId, patient.id));

        res.json({ ...patient, visitCount: Number(visitCount) });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── List recent patients ───────────────────────────────────────────

router.get("/", async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 30;
        const offset = (page - 1) * limit;

        // Subquery to get the latest visit date for each patient
        const lastVisitSq = db
            .select({
                patientId: visits.patientId,
                lastVisit: sql<Date>`MAX(${visits.startedAt})`.as("lastVisit"),
            })
            .from(visits)
            .groupBy(visits.patientId)
            .as("last_visits");

        const result = await db
            .select({
                patient: patients,
                lastVisit: lastVisitSq.lastVisit,
            })
            .from(patients)
            .leftJoin(lastVisitSq, eq(patients.id, lastVisitSq.patientId))
            .orderBy(sql`${lastVisitSq.lastVisit} DESC NULLS LAST`, desc(patients.updatedAt))
            .limit(limit)
            .offset(offset);

        const [{ count: total }] = await db.select({ count: count() }).from(patients);

        // Flatten the result for the frontend
        const flattened = result.map(({ patient, lastVisit }) => ({
            ...patient,
            lastVisit: lastVisit, // Explicitly return lastVisit
            updatedAt: patient.updatedAt, // Keep original updatedAt
        }));

        res.json({ patients: flattened, total: Number(total), page, limit });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Create patient ─────────────────────────────────────────────────

router.post("/", async (req, res) => {
    try {
        const data = insertPatientSchema.parse(req.body);
        const [patient] = await db.insert(patients).values(data).returning();
        res.status(201).json(patient);
    } catch (error: any) {
        if (error.name === "ZodError") {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: error.message });
    }
});

// ─── Update patient ─────────────────────────────────────────────────

router.put("/:id", async (req, res) => {
    try {
        const data = insertPatientSchema.partial().parse(req.body);
        const [patient] = await db
            .update(patients)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(patients.id, req.params.id))
            .returning();

        if (!patient) return res.status(404).json({ error: "Patient not found" });
        res.json(patient);
    } catch (error: any) {
        if (error.name === "ZodError") {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: error.message });
    }
});

export { router as patientRouter };
