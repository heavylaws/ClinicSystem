import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { db } from "../server/db/index.js";
import {
    patients,
    visits,
    diagnoses,
    prescriptions,
    appointments,
    labOrders,
} from "../server/db/schema.js";
import { sql } from "drizzle-orm";

const EXPORT_DIR = join(process.cwd(), "bu_backup", "exported");
const DRY_RUN = process.argv.includes("--dry-run");

// ─── Helpers ────────────────────────────────────────────────────────

function readJSON(filename: string): any[] | null {
    const filepath = join(EXPORT_DIR, filename);
    if (!existsSync(filepath)) return null;
    try {
        const raw = readFileSync(filepath, "utf-8").trim();
        if (!raw || raw === "[]") return null;
        return JSON.parse(raw);
    } catch (e: any) {
        console.error(`  ✗ Error reading ${filename}: ${e.message}`);
        return null;
    }
}

function clean(val: any): string | null {
    if (val === null || val === undefined || val === "") return null;
    return String(val).trim();
}

/**
 * Convert a date string like "2013-10-23" to a Date at UTC midnight.
 * CRITICAL: We use "YYYY-MM-DDT00:00:00.000Z" to force UTC midnight,
 * avoiding the timezone offset issue that caused missing data.
 */
function cleanDateUTC(val: any): Date | null {
    if (!val) return null;
    const s = String(val).trim();
    // If it's already a full ISO string, parse directly
    if (s.includes("T")) {
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
    }
    // For date-only strings like "2013-10-23", force UTC midnight
    const d = new Date(s + "T00:00:00.000Z");
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Extract the date part from a JS Date as YYYY-MM-DD, using UTC to avoid timezone drift.
 */
function dateKeyUTC(d: Date): string {
    return d.toISOString().split("T")[0];
}

/**
 * Extract the date part from a PostgreSQL timestamp (which may have been stored with timezone offset).
 * We adjust by looking at the UTC hours — if the time is 21:00-23:59 UTC, the original local date
 * was the NEXT day (UTC+1 to UTC+3 timezone).
 */
function dateKeyFromDB(d: Date): string {
    const utcHours = d.getUTCHours();
    // If stored as e.g. 2013-10-22T21:00:00Z, the original date was 2013-10-23 (local UTC+3)
    if (utcHours >= 21) {
        const adjusted = new Date(d);
        adjusted.setUTCDate(adjusted.getUTCDate() + 1);
        return adjusted.toISOString().split("T")[0];
    }
    return d.toISOString().split("T")[0];
}

function chunkArray<T>(arr: T[], size: number): T[][] {
    const chunked: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        chunked.push(arr.slice(i, i + size));
    }
    return chunked;
}

// ─── Main Merge ─────────────────────────────────────────────────────

async function merge() {
    console.time("Total Merge Time");
    console.log("═══════════════════════════════════════════════════");
    console.log("  DermClinic — Backup Data Merge (Additive Only)");
    console.log("═══════════════════════════════════════════════════");
    console.log(`  Mode: ${DRY_RUN ? "🔍 DRY RUN (no changes)" : "⚡ LIVE MERGE"}`);
    console.log(`  Export directory: ${EXPORT_DIR}\n`);

    if (!existsSync(EXPORT_DIR)) {
        console.error(`✗ Export directory not found: ${EXPORT_DIR}`);
        process.exit(1);
    }

    // ─── Build In-Memory Caches ─────────────────────────────────────

    console.log("🔄 Building in-memory caches...");

    // 1. Legacy patient map: legacyId → pgPatientId
    const legacyMap = new Map<number, string>();
    const existingPatients = await db
        .select({ id: patients.id, legacyId: patients.legacyId })
        .from(patients);
    for (const p of existingPatients) {
        if (p.legacyId) legacyMap.set(p.legacyId, p.id);
    }
    console.log(`  ✓ ${legacyMap.size} legacy patient links`);

    // 2. Visit map: "pgPatientId_YYYY-MM-DD" → visitId
    //    FIXED: Use dateKeyFromDB() to correctly handle timezone offset
    const visitMap = new Map<string, string>();
    const existingVisits = await db
        .select({ id: visits.id, patientId: visits.patientId, startedAt: visits.startedAt })
        .from(visits);
    for (const v of existingVisits) {
        if (v.startedAt) {
            const dateStr = dateKeyFromDB(v.startedAt);
            const key = `${v.patientId}_${dateStr}`;
            visitMap.set(key, v.id);
        }
    }
    console.log(`  ✓ ${visitMap.size} existing visits indexed`);

    // 3. Existing diagnoses: "visitId_name" → true
    const diagSet = new Set<string>();
    const existingDiags = await db
        .select({ visitId: diagnoses.visitId, name: diagnoses.name })
        .from(diagnoses);
    for (const d of existingDiags) {
        diagSet.add(`${d.visitId}_${d.name}`);
    }
    console.log(`  ✓ ${diagSet.size} existing diagnoses indexed`);

    // 4. Existing prescriptions: "visitId_name" → true
    const rxSet = new Set<string>();
    const existingRxs = await db
        .select({ visitId: prescriptions.visitId, medicationName: prescriptions.medicationName })
        .from(prescriptions);
    for (const r of existingRxs) {
        if (r.medicationName) rxSet.add(`${r.visitId}_${r.medicationName}`);
    }
    console.log(`  ✓ ${rxSet.size} existing prescriptions indexed`);

    // 5. Existing appointments: "pgPatientId_date_time" → true
    const apptSet = new Set<string>();
    const existingAppts = await db
        .select({
            patientId: appointments.patientId,
            appointmentDate: appointments.appointmentDate,
            timeSlot: appointments.timeSlot,
        })
        .from(appointments);
    for (const a of existingAppts) {
        apptSet.add(`${a.patientId}_${a.appointmentDate}_${a.timeSlot}`);
    }
    console.log(`  ✓ ${apptSet.size} existing appointments indexed`);

    // 6. Existing lab orders: "visitId_testName" → true
    const labSet = new Set<string>();
    const existingLabs = await db
        .select({ visitId: labOrders.visitId, testName: labOrders.testName })
        .from(labOrders);
    for (const l of existingLabs) {
        labSet.add(`${l.visitId}_${l.testName}`);
    }
    console.log(`  ✓ ${labSet.size} existing lab orders indexed`);

    // Also build a reverse map for finding visits by legacy patient + date
    // legacyId_date → pgPatientId_date (for quick lookup)
    const legacyVisitLookup = (legacyId: number, dateStr: string): string | undefined => {
        const pgPatientId = legacyMap.get(legacyId);
        if (!pgPatientId) return undefined;
        return visitMap.get(`${pgPatientId}_${dateStr}`);
    };

    let stats = {
        diagInserted: 0,
        diagSkipped: 0,
        diagNoVisit: 0,
        rxInserted: 0,
        rxSkipped: 0,
        rxNoVisit: 0,
        apptInserted: 0,
        apptSkipped: 0,
        labInserted: 0,
        labSkipped: 0,
        visitCreated: 0,
    };

    // ─── 1. Merge Missing Diagnoses ─────────────────────────────────

    console.log("\n🔄 Merging diagnoses...");
    const diagData = readJSON("Diagnostic.json") || [];

    if (diagData.length > 0) {
        const newDiags: { visitId: string; name: string; description: string | null }[] = [];
        const missingVisitsToCreate = new Map<string, { patientId: string; date: Date }>();

        for (const row of diagData) {
            const legacyPatientId = Number(row.P_ID);
            const pgPatientId = legacyMap.get(legacyPatientId);
            if (!pgPatientId) continue;

            const diagDate = cleanDateUTC(row.Diag_Date);
            if (!diagDate) continue;

            const dateStr = dateKeyUTC(diagDate);
            const vCacheKey = `${pgPatientId}_${dateStr}`;

            let visitId = visitMap.get(vCacheKey);

            if (!visitId) {
                // Need to create the visit for this date
                if (!missingVisitsToCreate.has(vCacheKey)) {
                    missingVisitsToCreate.set(vCacheKey, { patientId: pgPatientId, date: diagDate });
                }
                // Will be resolved after visit creation
            }

            const diagName = clean(row.Diag_Desc);
            const diagClinic = clean(row.Diag_Clinic);

            if (diagName) {
                newDiags.push({
                    visitId: vCacheKey, // Placeholder, will be resolved
                    name: diagName,
                    description: diagClinic,
                });
            }
            // If only Diag_Clinic exists without Diag_Desc, store clinic as name
            if (!diagName && diagClinic) {
                newDiags.push({
                    visitId: vCacheKey,
                    name: diagClinic.slice(0, 500),
                    description: null,
                });
            }
        }

        // Create missing visits
        if (missingVisitsToCreate.size > 0) {
            console.log(`  Creating ${missingVisitsToCreate.size} missing visits for unmatched diagnostics...`);
            if (!DRY_RUN) {
                const entries = Array.from(missingVisitsToCreate.entries());
                const chunks = chunkArray(entries, 2000);
                for (const chunk of chunks) {
                    const insertData = chunk.map(([_, info]) => ({
                        patientId: info.patientId,
                        visitType: "consultation",
                        status: "completed",
                        chiefComplaint: "Imported History",
                        startedAt: info.date,
                        completedAt: info.date,
                    }));
                    const returned = await db
                        .insert(visits)
                        .values(insertData)
                        .returning({ id: visits.id, patientId: visits.patientId, startedAt: visits.startedAt });

                    for (let i = 0; i < returned.length; i++) {
                        const v = returned[i];
                        const cacheKey = chunk[i][0];
                        visitMap.set(cacheKey, v.id);
                        stats.visitCreated++;
                    }
                }
            } else {
                // In dry-run, just mark them as resolved with placeholder
                for (const [key] of missingVisitsToCreate) {
                    visitMap.set(key, "dry-run-placeholder");
                }
            }
        }

        // Now resolve and deduplicate diagnoses
        const finalDiags: { visitId: string; name: string; description: string | null }[] = [];
        for (const d of newDiags) {
            const realVisitId = visitMap.get(d.visitId);
            if (!realVisitId || realVisitId === "pending") {
                stats.diagNoVisit++;
                continue;
            }
            const dedupKey = `${realVisitId}_${d.name}`;
            if (diagSet.has(dedupKey)) {
                stats.diagSkipped++;
                continue;
            }
            diagSet.add(dedupKey);
            finalDiags.push({ visitId: realVisitId, name: d.name, description: d.description });
        }

        console.log(`  Ready to insert: ${finalDiags.length} diagnoses`);
        console.log(`  Skipped (duplicates): ${stats.diagSkipped}`);
        console.log(`  No matching visit: ${stats.diagNoVisit}`);

        if (!DRY_RUN && finalDiags.length > 0) {
            const chunks = chunkArray(finalDiags, 5000);
            for (const chunk of chunks) {
                await db.insert(diagnoses).values(chunk);
                stats.diagInserted += chunk.length;
            }
            console.log(`  ✓ Inserted ${stats.diagInserted} diagnoses`);
        }
    }

    // ─── 2. Merge Missing Prescriptions ─────────────────────────────

    console.log("\n🔄 Merging prescriptions...");
    const rxData = readJSON("Medicine.json") || [];

    if (rxData.length > 0) {
        const newRxs: { visitId: string; medicationName: string }[] = [];
        const missingVisitsForRx = new Map<string, { patientId: string; date: Date }>();

        for (const row of rxData) {
            const legacyPatientId = Number(row.P_ID);
            const pgPatientId = legacyMap.get(legacyPatientId);
            if (!pgPatientId) continue;

            const rxDate = cleanDateUTC(row.Med_Date);
            if (!rxDate) continue;

            const dateStr = dateKeyUTC(rxDate);
            const vCacheKey = `${pgPatientId}_${dateStr}`;

            if (!visitMap.has(vCacheKey)) {
                if (!missingVisitsForRx.has(vCacheKey)) {
                    missingVisitsForRx.set(vCacheKey, { patientId: pgPatientId, date: rxDate });
                }
            }

            const medName = clean(row.Med_desc);
            if (medName) {
                newRxs.push({ visitId: vCacheKey, medicationName: medName });
            }
        }

        // Create missing visits for prescriptions
        if (missingVisitsForRx.size > 0) {
            // Filter out visits already created in the diagnosis step
            const trulyMissing = new Map<string, { patientId: string; date: Date }>();
            for (const [key, val] of missingVisitsForRx) {
                if (!visitMap.has(key)) {
                    trulyMissing.set(key, val);
                }
            }

            if (trulyMissing.size > 0) {
                console.log(`  Creating ${trulyMissing.size} missing visits for unmatched prescriptions...`);
                if (!DRY_RUN) {
                    const entries = Array.from(trulyMissing.entries());
                    const chunks = chunkArray(entries, 2000);
                    for (const chunk of chunks) {
                        const insertData = chunk.map(([_, info]) => ({
                            patientId: info.patientId,
                            visitType: "consultation",
                            status: "completed",
                            chiefComplaint: "Imported History",
                            startedAt: info.date,
                            completedAt: info.date,
                        }));
                        const returned = await db
                            .insert(visits)
                            .values(insertData)
                            .returning({ id: visits.id, patientId: visits.patientId, startedAt: visits.startedAt });
                        for (let i = 0; i < returned.length; i++) {
                            visitMap.set(chunk[i][0], returned[i].id);
                            stats.visitCreated++;
                        }
                    }
                } else {
                    for (const [key] of trulyMissing) {
                        visitMap.set(key, "dry-run-placeholder");
                    }
                }
            }
        }

        // Resolve and deduplicate
        const finalRxs: { visitId: string; medicationName: string }[] = [];
        for (const r of newRxs) {
            const realVisitId = visitMap.get(r.visitId);
            if (!realVisitId || realVisitId === "pending") {
                stats.rxNoVisit++;
                continue;
            }
            const dedupKey = `${realVisitId}_${r.medicationName}`;
            if (rxSet.has(dedupKey)) {
                stats.rxSkipped++;
                continue;
            }
            rxSet.add(dedupKey);
            finalRxs.push({ visitId: realVisitId, medicationName: r.medicationName });
        }

        console.log(`  Ready to insert: ${finalRxs.length} prescriptions`);
        console.log(`  Skipped (duplicates): ${stats.rxSkipped}`);

        if (!DRY_RUN && finalRxs.length > 0) {
            const chunks = chunkArray(finalRxs, 5000);
            for (const chunk of chunks) {
                await db.insert(prescriptions).values(chunk);
                stats.rxInserted += chunk.length;
            }
            console.log(`  ✓ Inserted ${stats.rxInserted} prescriptions`);
        }
    }

    // ─── 3. Merge Missing Appointments ──────────────────────────────

    console.log("\n🔄 Merging appointments...");
    const apptData = readJSON("Appointment.json") || [];

    if (apptData.length > 0) {
        const newAppts: any[] = [];

        for (const row of apptData) {
            const legacyPatientId = Number(row.P_ID);
            const pgPatientId = legacyMap.get(legacyPatientId);
            if (!pgPatientId) continue;

            const apptDate = clean(row.AP_Date);
            if (!apptDate) continue;

            // Parse time — format is "HH:MM:SS", we need "HH:MM"
            let timeSlot = "09:00";
            if (row.AP_Time) {
                const timeParts = String(row.AP_Time).split(":");
                timeSlot = `${(timeParts[0] || "09").padStart(2, "0")}:${(timeParts[1] || "00").padStart(2, "0")}`;
            }

            const dedupKey = `${pgPatientId}_${apptDate}_${timeSlot}`;
            if (apptSet.has(dedupKey)) {
                stats.apptSkipped++;
                continue;
            }
            apptSet.add(dedupKey);

            const isCompleted = String(row.AP_Close || "").toLowerCase() === "yes";

            newAppts.push({
                patientId: pgPatientId,
                appointmentDate: apptDate,
                timeSlot: timeSlot,
                type: "consultation",
                status: isCompleted ? "completed" : "scheduled",
                notes: clean(row.AP_Comment),
            });
        }

        console.log(`  Ready to insert: ${newAppts.length} appointments`);
        console.log(`  Skipped (duplicates): ${stats.apptSkipped}`);

        if (!DRY_RUN && newAppts.length > 0) {
            const chunks = chunkArray(newAppts, 2000);
            for (const chunk of chunks) {
                await db.insert(appointments).values(chunk);
                stats.apptInserted += chunk.length;
            }
            console.log(`  ✓ Inserted ${stats.apptInserted} appointments`);
        }
    }

    // ─── 4. Merge Missing Lab Tests ─────────────────────────────────

    console.log("\n🔄 Merging lab tests...");
    const testData = readJSON("Test.json") || [];

    if (testData.length > 0) {
        // Tests have no date — find each patient's latest visit (or earliest)
        // Build a map: pgPatientId → latest visit ID
        const latestVisitByPatient = new Map<string, string>();
        for (const v of existingVisits) {
            latestVisitByPatient.set(v.patientId, v.id);
        }

        const newLabs: any[] = [];

        for (const row of testData) {
            const legacyPatientId = Number(row.P_ID);
            const pgPatientId = legacyMap.get(legacyPatientId);
            if (!pgPatientId) continue;

            const testDesc = clean(row.Tst_Desc);
            if (!testDesc) continue;

            // Find any visit for this patient to attach to
            const visitId = latestVisitByPatient.get(pgPatientId);
            if (!visitId) continue;

            const dedupKey = `${visitId}_${testDesc.slice(0, 500)}`;
            if (labSet.has(dedupKey)) {
                stats.labSkipped++;
                continue;
            }
            labSet.add(dedupKey);

            newLabs.push({
                visitId: visitId,
                testName: testDesc.slice(0, 500),
                status: "completed",
                result: testDesc,
            });
        }

        console.log(`  Ready to insert: ${newLabs.length} lab tests`);
        console.log(`  Skipped (duplicates): ${stats.labSkipped}`);

        if (!DRY_RUN && newLabs.length > 0) {
            const chunks = chunkArray(newLabs, 2000);
            for (const chunk of chunks) {
                await db.insert(labOrders).values(chunk);
                stats.labInserted += chunk.length;
            }
            console.log(`  ✓ Inserted ${stats.labInserted} lab tests`);
        }
    }

    // ─── Summary ────────────────────────────────────────────────────

    console.timeEnd("Total Merge Time");

    const [pCount] = await db.select({ count: sql`count(*)`.mapWith(Number) }).from(patients);
    const [vCount] = await db.select({ count: sql`count(*)`.mapWith(Number) }).from(visits);
    const [dCount] = await db.select({ count: sql`count(*)`.mapWith(Number) }).from(diagnoses);
    const [rCount] = await db.select({ count: sql`count(*)`.mapWith(Number) }).from(prescriptions);
    const [aCount] = await db.select({ count: sql`count(*)`.mapWith(Number) }).from(appointments);
    const [lCount] = await db.select({ count: sql`count(*)`.mapWith(Number) }).from(labOrders);

    console.log("\n═══════════════════════════════════════════════════");
    console.log(`  Merge Summary ${DRY_RUN ? "(DRY RUN — nothing was changed)" : ""}`);
    console.log("═══════════════════════════════════════════════════");
    console.log(`  Visits created:        ${stats.visitCreated}`);
    console.log(`  Diagnoses inserted:    ${DRY_RUN ? newDiagCount(diagData, stats) : stats.diagInserted}`);
    console.log(`  Prescriptions inserted:${DRY_RUN ? " (dry-run)" : ` ${stats.rxInserted}`}`);
    console.log(`  Appointments inserted: ${DRY_RUN ? " (dry-run)" : ` ${stats.apptInserted}`}`);
    console.log(`  Lab tests inserted:    ${DRY_RUN ? " (dry-run)" : ` ${stats.labInserted}`}`);
    console.log("───────────────────────────────────────────────────");
    console.log(`  Total patients:     ${pCount?.count || 0}`);
    console.log(`  Total visits:       ${vCount?.count || 0}`);
    console.log(`  Total diagnoses:    ${dCount?.count || 0}`);
    console.log(`  Total prescriptions:${rCount?.count || 0}`);
    console.log(`  Total appointments: ${aCount?.count || 0}`);
    console.log(`  Total lab orders:   ${lCount?.count || 0}`);
    console.log("═══════════════════════════════════════════════════\n");

    process.exit(0);
}

function newDiagCount(data: any[], stats: any): string {
    return ` ~${data.length - stats.diagSkipped - stats.diagNoVisit} (estimated)`;
}

merge().catch((e) => {
    console.error(`\n❌ Fatal Error: ${e.message}`);
    console.error(e.stack);
    process.exit(1);
});
