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
        const { firstName, middleName, lastName, lastVisit, q, sortBy, order } = req.query;

        // If no params, return empty
        if (!firstName && !middleName && !lastName && !lastVisit && (!q || (q as string).length < 1)) {
            return res.json([]);
        }

        const conditions = [];
        const isSearchMode = !!(firstName || middleName || lastName || lastVisit || q);

        if (firstName) conditions.push(ilike(patients.firstName, `%${firstName}%`));
        if (middleName) conditions.push(ilike(patients.fatherName, `%${middleName}%`));
        if (lastName) conditions.push(ilike(patients.lastName, `%${lastName}%`));

        if (q) {
            const queryStr = q as string;
            const words = queryStr.trim().split(/\s+/).filter(w => w.length > 0);
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
            if (wordConditions.length > 0) {
                conditions.push(and(...wordConditions));
            }
        }

        if (lastVisit) {
            const searchDate = new Date(lastVisit as string);
            const startOfDay = new Date(searchDate.setHours(0, 0, 0, 0));
            const endOfDay = new Date(searchDate.setHours(23, 59, 59, 999));
            conditions.push(sql`EXISTS (
                SELECT 1 FROM ${visits} 
                WHERE ${visits.patientId} = ${patients.id} 
                AND ${visits.startedAt} >= ${startOfDay.toISOString()} 
                AND ${visits.startedAt} <= ${endOfDay.toISOString()}
             )`);
        }

        // Sorting logic
        const sortOrder = order === "desc" ? desc : (t: any) => t;
        let orderByClause: any[] = [];

        // Relevance scoring for search
        if (isSearchMode && !sortBy) {
            // Default search sorting: prioritize "starts with"
            const searchVal = (firstName as string) || (q as string);
            if (searchVal) {
                orderByClause.push(sql`CASE WHEN ${patients.firstName} ILIKE ${searchVal + "%"} THEN 0 ELSE 1 END`);
            }
            orderByClause.push(patients.firstName, patients.lastName);
        } else {
            if (sortBy === "name") {
                orderByClause = [sortOrder(patients.firstName), sortOrder(patients.lastName)];
            } else if (sortBy === "fileNumber") {
                orderByClause = [sortOrder(patients.fileNumber)];
            } else if (sortBy === "phone") {
                orderByClause = [sortOrder(patients.phone)];
            } else if (sortBy === "city") {
                orderByClause = [sortOrder(patients.city)];
            } else if (sortBy === "updatedAt") {
                orderByClause = [sortOrder(patients.updatedAt)];
            } else if (sortBy === "visits") {
                orderByClause = [sortOrder(count(visits.id))];
            } else if (sortBy === "lastVisit") {
                orderByClause = [sortOrder(sql`MAX(${visits.startedAt})`)];
            } else {
                // Default fallback
                orderByClause = [patients.firstName, patients.lastName];
            }
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
            .orderBy(...orderByClause)
            .limit(100);

        const flattened = result.map(({ patient, visitCount }) => ({
            ...patient,
            visitCount: Number(visitCount),
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
        const sortBy = (req.query.sortBy as string) || "lastVisit";
        const order = (req.query.order as string) || "desc";
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

        // Subquery to get the total visit count for each patient
        const visitCountSq = db
            .select({
                patientId: visits.patientId,
                count: count().as("visitCount"),
            })
            .from(visits)
            .groupBy(visits.patientId)
            .as("visit_counts");

        // Sorting logic for list
        const sortOrder = order === "desc" ? desc : (t: any) => t;
        let orderByClause: any[] = [sql`${lastVisitSq.lastVisit} DESC NULLS LAST`, desc(patients.updatedAt)];

        if (sortBy === "name") {
            orderByClause = [sortOrder(patients.lastName), sortOrder(patients.firstName)];
        } else if (sortBy === "fileNumber") {
            orderByClause = [sortOrder(patients.fileNumber)];
        } else if (sortBy === "phone") {
            orderByClause = [sortOrder(patients.phone)];
        } else if (sortBy === "city") {
            orderByClause = [sortOrder(patients.city)];
        } else if (sortBy === "lastVisit") {
            orderByClause = [sortOrder(lastVisitSq.lastVisit)];
        } else if (sortBy === "visits") {
            orderByClause = [sortOrder(visitCountSq.count)];
        }

        const result = await db
            .select({
                patient: patients,
                lastVisit: lastVisitSq.lastVisit,
                visitCount: visitCountSq.count,
            })
            .from(patients)
            .leftJoin(lastVisitSq, eq(patients.id, lastVisitSq.patientId))
            .leftJoin(visitCountSq, eq(patients.id, visitCountSq.patientId))
            .orderBy(...orderByClause)
            .limit(limit)
            .offset(offset);

        const [{ count: total }] = await db.select({ count: count() }).from(patients);

        const flattened = result.map(({ patient, lastVisit, visitCount }) => ({
            ...patient,
            lastVisit: lastVisit,
            visitCount: Number(visitCount || 0),
            updatedAt: patient.updatedAt,
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
