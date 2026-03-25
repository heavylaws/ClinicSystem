
import { db } from "../server/db";
import { diagnoses, prescriptions, labOrders, procedureLogs, medicalTerms } from "../server/db/schema";
import { sql, eq } from "drizzle-orm";

async function importTerms() {
    console.log("📥 Starting OPTIMIZED import of past medical terms...");

    const processCategory = async (category: string, table: any, column: any) => {
        console.log(`  • Processing ${category}...`);

        // 1. Aggregate existing usage counts from clinical table
        const storedTerms = await db
            .select({
                term: column,
                count: sql<number>`count(*)::int`,
            })
            .from(table)
            .groupBy(column);

        console.log(`    → Found ${storedTerms.length} unique terms in ${category} records`);

        let newTerms = 0;
        let updatedTerms = 0;

        for (const { term, count } of storedTerms) {
            if (!term || term.trim().length < 2) continue;
            const normalizedTerm = term.trim();

            // Check if term exists in medical_terms (case-insensitive)
            const existing = await db.query.medicalTerms.findFirst({
                where: sql`LOWER(${medicalTerms.term}) = LOWER(${normalizedTerm}) AND ${medicalTerms.category} = ${category}`
            });

            if (existing) {
                // Update count: existing count + new observations from clinical history
                // We carefully avoid double counting if we run this script multiple times by only adding IF the clinical count is significant
                // A simple heuristic for migration: set usageCount to at least the clinical count
                if (existing.usageCount <= count) {
                    await db
                        .update(medicalTerms)
                        .set({
                            usageCount: sql`${medicalTerms.usageCount} + ${count}`
                        })
                        .where(eq(medicalTerms.id, existing.id));
                    updatedTerms++;
                }
            } else {
                // Insert new term
                await db.insert(medicalTerms).values({
                    category,
                    term: normalizedTerm,
                    usageCount: count,
                    isVerified: false // Imported terms are unverified by default
                });
                newTerms++;
            }
        }
        console.log(`    ✓ Added ${newTerms} new terms, Updated ${updatedTerms} existing terms`);
    };

    await processCategory("diagnosis", diagnoses, diagnoses.name);
    await processCategory("medication", prescriptions, prescriptions.medicationName);
    await processCategory("lab_test", labOrders, labOrders.testName);
    await processCategory("procedure", procedureLogs, procedureLogs.procedureName);

    console.log("✅ Import complete!");
    process.exit(0);
}

importTerms().catch((err) => {
    console.error("❌ Import failed:", err);
    process.exit(1);
});
