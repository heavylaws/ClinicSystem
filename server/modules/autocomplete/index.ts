import { Router } from "express";
import { db } from "../../db/index.js";
import { medicalTerms } from "../../db/schema.js";
import { eq, and, ilike, desc, sql } from "drizzle-orm";
import { autocompleteQuerySchema } from "../../../shared/types.js";
import { requireAuth } from "../auth/index.js";

const router = Router();
router.use(requireAuth);

// ─── Autocomplete query ─────────────────────────────────────────────

router.get("/", async (req, res) => {
    try {
        const { category, query, limit } = autocompleteQuerySchema.parse({
            category: req.query.category,
            query: req.query.q,
            limit: req.query.limit ? parseInt(req.query.limit as string) : 8,
        });

        // Use ILIKE for pattern matching (pg_trgm for fuzzy matching can be added later)
        const results = await db
            .select({
                id: medicalTerms.id,
                term: medicalTerms.term,
                usageCount: medicalTerms.usageCount,
                category: medicalTerms.category,
            })
            .from(medicalTerms)
            .where(
                and(
                    eq(medicalTerms.category, category),
                    ilike(medicalTerms.term, `%${query}%`)
                )
            )
            .orderBy(desc(medicalTerms.usageCount))
            .limit(limit);

        res.json(results);
    } catch (error: any) {
        if (error.name === "ZodError") return res.status(400).json({ error: error.errors });
        res.status(500).json({ error: error.message });
    }
});

// ─── Get popular terms by category ──────────────────────────────────

router.get("/popular/:category", async (req, res) => {
    try {
        const results = await db
            .select({
                term: medicalTerms.term,
                usageCount: medicalTerms.usageCount,
            })
            .from(medicalTerms)
            .where(eq(medicalTerms.category, req.params.category))
            .orderBy(desc(medicalTerms.usageCount))
            .limit(20);

        res.json(results);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Learn a term (exported for use by other modules) ───────────────

export async function learnTerm(category: string, term: string) {
    const normalizedTerm = term.trim().toLowerCase();
    if (!normalizedTerm || normalizedTerm.length < 2) return;

    try {
        // Check if term exists
        const [existing] = await db
            .select()
            .from(medicalTerms)
            .where(
                and(
                    eq(medicalTerms.category, category),
                    sql`LOWER(${medicalTerms.term}) = ${normalizedTerm}`
                )
            )
            .limit(1);

        if (existing) {
            // Increment usage count
            await db
                .update(medicalTerms)
                .set({
                    usageCount: existing.usageCount + 1,
                    lastUsed: new Date(),
                })
                .where(eq(medicalTerms.id, existing.id));
        } else {
            // Insert new term (preserve original casing)
            await db.insert(medicalTerms).values({
                category,
                term: term.trim(),
                usageCount: 1,
            });
        }
    } catch (error) {
        // Non-critical: log but don't fail the request
        console.error("Failed to learn term:", error);
    }
}

export { router as autocompleteRouter };
