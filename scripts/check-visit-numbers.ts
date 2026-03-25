import { db } from "../server/db/index.js";
import { visits } from "../server/db/schema.js";
import { sql, desc } from "drizzle-orm";

async function checkVisitNumbers() {
    console.log("Checking visit numbers...");

    // 1. Find a patient with > 1 visit
    const patientCounts = await db.execute(sql`
        SELECT patient_id, COUNT(*) as c 
        FROM visits 
        GROUP BY patient_id 
        HAVING COUNT(*) > 1 
        LIMIT 5
    `);

    if (patientCounts.rows.length === 0) {
        console.log("No patients with > 1 visit found?! Something is wrong.");
        process.exit(0);
    }

    const pid = patientCounts.rows[0].patient_id;
    console.log(`Checking patient ${pid} with ${patientCounts.rows[0].c} visits:`);

    const pVisits = await db.execute(sql`
        SELECT id, visit_number, started_at 
        FROM visits 
        WHERE patient_id = ${pid} 
        ORDER BY started_at ASC
    `);

    console.table(pVisits.rows);

    // 2. Check overall distribution of visit_number
    const distro = await db.execute(sql`
        SELECT visit_number, COUNT(*) 
        FROM visits 
        GROUP BY visit_number 
        ORDER BY visit_number ASC 
        LIMIT 10
    `);

    console.log("Visit number distribution:");
    console.table(distro.rows);

    process.exit(0);
}

checkVisitNumbers().catch(console.error);
