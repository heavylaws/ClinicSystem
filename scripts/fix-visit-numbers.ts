import { db } from "../server/db/index.js";
import { visits } from "../server/db/schema.js";
import { sql } from "drizzle-orm";

async function fixVisitNumbers() {
    console.log("Fixing visit numbers...");

    // Execute the update in a single SQL statement for efficiency
    const result = await db.execute(sql`
        WITH CTE AS (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY patient_id ORDER BY started_at ASC) as rn
          FROM visits
        )
        UPDATE visits
        SET visit_number = CTE.rn
        FROM CTE
        WHERE visits.id = CTE.id;
    `);

    console.log("Visit numbers updated.");

    // Check results again
    const distro = await db.execute(sql`
        SELECT visit_number, COUNT(*) 
        FROM visits 
        GROUP BY visit_number 
        ORDER BY visit_number ASC 
        LIMIT 10
    `);

    console.log("New visit number distribution:");
    console.table(distro.rows);

    process.exit(0);
}

fixVisitNumbers().catch(console.error);
