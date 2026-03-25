import { db } from "../server/db/index.js";
import { sql } from "drizzle-orm";

async function reset() {
    console.log("⚠️  Resetting database...");
    await db.execute(sql`
        TRUNCATE patients, visits, diagnoses, prescriptions, lab_orders, procedures, 
                 billings, payments, patient_images, medical_terms CASCADE;
    `);
    // Note: procedure_logs was renamed to procedures in schema, handling both safely
    try {
        await db.execute(sql`ALTER SEQUENCE patients_file_number_seq RESTART WITH 1;`);
    } catch (e) {
        // ignore if sequence not present
    }
    console.log("✓ Database cleared.");
    process.exit(0);
}

reset().catch((e) => {
    console.error("Failed to reset database:", e);
    process.exit(1);
});
