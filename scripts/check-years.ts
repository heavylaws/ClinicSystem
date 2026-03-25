import { db } from "../server/db/index.js";
import { visits } from "../server/db/schema.js";
import { sql } from "drizzle-orm";

async function checkYears() {
    console.log("Checking visit year distribution...");

    const result = await db.execute(sql`
        SELECT 
            EXTRACT(YEAR FROM started_at) as year, 
            COUNT(*) as count 
        FROM visits 
        GROUP BY year 
        ORDER BY year DESC
    `);

    console.log(result.rows);
    process.exit(0);
}

checkYears().catch(console.error);
