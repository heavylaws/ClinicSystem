import { db } from "../server/db/index.js";
import { visits } from "../server/db/schema.js";
import { count, isNotNull, desc } from "drizzle-orm";

async function check() {
    console.log("Checking visits...");
    const allVisits = await db.select().from(visits).limit(5);
    console.log("Sample visits:", allVisits);

    const [{ count: total }] = await db.select({ count: count() }).from(visits);
    console.log("Total visits:", total);

    const latest = await db.select().from(visits).orderBy(desc(visits.startedAt)).limit(5);
    console.log("Latest visits:", latest.map(v => ({ id: v.id, date: v.startedAt })));

    process.exit(0);
}

check().catch(console.error);
