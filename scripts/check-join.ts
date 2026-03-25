import { db } from "../server/db/index.js";
import { patients, visits } from "../server/db/schema.js";
import { eq, sql, desc } from "drizzle-orm";

async function checkJoin() {
    console.log("Checking join...");

    // 1. Get a patient with visits
    const visit = await db.select().from(visits).limit(1);
    const pid = visit[0].patientId;
    console.log("Patient ID from visit:", pid);

    const patient = await db.select().from(patients).where(eq(patients.id, pid));
    console.log("Patient found:", patient.length > 0);

    // 2. Run the exact query logic
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
            id: patients.id,
            name: patients.firstName,
            lastVisit: lastVisitSq.lastVisit,
        })
        .from(patients)
        .leftJoin(lastVisitSq, eq(patients.id, lastVisitSq.patientId))
        .where(eq(patients.id, pid))
        .limit(1);

    console.log("Join result for patient:", result);

    process.exit(0);
}

checkJoin().catch(console.error);
