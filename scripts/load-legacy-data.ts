import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { db } from "../server/db/index.js";
import { patients, visits, diagnoses, prescriptions } from "../server/db/schema.js";
import { sql } from "drizzle-orm";

const EXPORT_DIR = process.argv[2] || join(process.cwd(), "bu_backup", "exported");

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

function cleanDate(val: any): Date | null {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
    const chunked: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        chunked.push(arr.slice(i, i + size));
    }
    return chunked;
}

// ─── Main Migration ─────────────────────────────────────────────────

async function migrate() {
    console.time("Total Migration Time");
    console.log("═══════════════════════════════════════════════════");
    console.log("  DermClinic — Legacy Data Loader (Optimized)");
    console.log("═══════════════════════════════════════════════════");
    console.log(`\nExport directory: ${EXPORT_DIR}`);

    if (!existsSync(EXPORT_DIR)) {
        console.error(`\n✗ Export directory not found: ${EXPORT_DIR}`);
        console.log("  Run npm run db:restore first");
        process.exit(1);
    }

    // List files
    const files = readdirSync(EXPORT_DIR).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
    files.forEach((f) => {
        const data = readFileSync(join(EXPORT_DIR, f), "utf-8").trim();
        const count = data.startsWith("[") ? JSON.parse(data).length : 0;
        console.log(`  ${f.replace(".json", "")} — ${count} rows`);
    });

    // ─── In-Memory Caching ──────────────────────────────────────────
    console.log("\n🔄 Building In-Memory Caches...");

    // 1. Existing Patients Cache
    const legacyMap = new Map<number, string>(); // legacyId -> pgPatientId
    const existingLegacyIds = new Set<number>();
    const existingPatients = await db.select({ id: patients.id, legacyId: patients.legacyId }).from(patients);
    for (const p of existingPatients) {
        if (p.legacyId) {
            legacyMap.set(p.legacyId, p.id);
            existingLegacyIds.add(p.legacyId);
        }
    }
    console.log(`  Loaded ${legacyMap.size} legacy patient links`);

    // 2. Existing Visits Cache
    const visitMap = new Map<string, string>(); // patientId_date -> visitId
    const existingVisits = await db.select({ id: visits.id, patientId: visits.patientId, startedAt: visits.startedAt }).from(visits);
    for (const v of existingVisits) {
        if (v.startedAt) {
            const dateStr = v.startedAt.toISOString().split("T")[0];
            visitMap.set(`${v.patientId}_${dateStr}`, v.id);
        }
    }
    console.log(`  Loaded ${visitMap.size} existing visits`);

    // 3. Existing Diagnoses Cache
    const diagSet = new Set<string>(); // visitId_name
    const existingDiags = await db.select({ visitId: diagnoses.visitId, name: diagnoses.name }).from(diagnoses);
    for (const d of existingDiags) {
        diagSet.add(`${d.visitId}_${d.name}`);
    }
    console.log(`  Loaded ${diagSet.size} existing diagnoses`);

    // 4. Existing Prescriptions Cache
    const rxSet = new Set<string>(); // visitId_name
    const existingRxs = await db.select({ visitId: prescriptions.visitId, medicationName: prescriptions.medicationName }).from(prescriptions);
    for (const r of existingRxs) {
        if (r.medicationName) rxSet.add(`${r.visitId}_${r.medicationName}`);
    }
    console.log(`  Loaded ${rxSet.size} existing prescriptions`);


    // ─── 1. Load Patients ────────────────────────────────────────────

    console.log("\n\n🔄 Processing patients...");
    console.time("Patients Query");
    const patientFiles = files.filter((f) => /patient|مريض|marid/i.test(f));
    const patientData = readJSON("Patients.json") || readJSON("Patient.json") || (patientFiles.length > 0 ? readJSON(patientFiles[0]) : []) || [];

    if (patientData.length > 0) {
        const sample = patientData[0];
        const keys = Object.keys(sample);
        const find = (patterns: string[]) => keys.find((k) => patterns.some((p) => k.toLowerCase().includes(p.toLowerCase())));

        const mapping = {
            id: find(["PatientID", "ID", "Id", "patient_id", "P_ID"]),
            firstName: find(["FirstName", "first_name", "الاسم", "Name", "P_FN", "FN"]),
            lastName: find(["LastName", "last_name", "FamilyName", "الكنية", "العائلة", "P_LN", "LN"]),
            fatherName: find(["FatherName", "father_name", "اسم_الاب", "Father", "P_MN", "MN", "MiddleName"]),
            gender: find(["Gender", "Sex", "الجنس"]),
            phone: find(["Phone", "Tel", "Mobile", "الهاتف", "PhoneNumber"]),
            city: find(["City", "Address", "المدينة", "المنطقة"]),
            maritalStatus: find(["MaritalStatus", "marital_status", "الحالة"]),
            allergies: find(["Allergies", "Allergy", "الحساسية"]),
            chronicConditions: find(["ChronicConditions", "Chronic", "الامراض"]),
            notes: find(["Notes", "Remarks", "ملاحظات", "Summary"]),
        };

        const newPatientsToInsert: any[] = [];
        let skipped = 0;

        for (const row of patientData) {
            const lid = row[mapping.id!] ? Number(row[mapping.id!]) : null;
            if (lid && existingLegacyIds.has(lid)) {
                skipped++;
                continue;
            }

            let firstName = clean(row[mapping.firstName!]);
            let lastName = clean(row[mapping.lastName!]);

            if (firstName && !lastName && firstName.includes(" ")) {
                const parts = firstName.split(" ");
                firstName = parts[0];
                lastName = parts.slice(1).join(" ");
            }

            if (!firstName) {
                skipped++;
                continue;
            }

            newPatientsToInsert.push({
                legacyId: lid,
                legacyRaw: JSON.stringify(row),
                firstName: firstName,
                lastName: lastName || "—",
                fatherName: clean(row[mapping.fatherName!]),
                gender: clean(row[mapping.gender!]),
                phone: clean(row[mapping.phone!]),
                city: clean(row[mapping.city!]),
                maritalStatus: clean(row[mapping.maritalStatus!]),
                allergies: clean(row[mapping.allergies!]),
                chronicConditions: clean(row[mapping.chronicConditions!]),
                notes: clean(row[mapping.notes!]),
            });
        }

        console.log(`  Prepared ${newPatientsToInsert.length} patients for DB insert (${skipped} existing/invalid skipped)...`);

        const chunks = chunkArray(newPatientsToInsert, 2000);
        let imported = 0;
        for (const chunk of chunks) {
            const returned = await db.insert(patients).values(chunk).returning({ id: patients.id, legacyId: patients.legacyId });
            for (const p of returned) {
                if (p.legacyId) {
                    legacyMap.set(p.legacyId, p.id);
                    existingLegacyIds.add(p.legacyId);
                }
            }
            imported += returned.length;
        }
        console.log(`  ✓ Inserted ${imported} new patients`);
    }
    console.timeEnd("Patients Query");

    // ─── 2. Load Visits ──────────────────────────────────────────────

    console.log("\n🔄 Processing visits...");
    console.time("Visits Query");
    const visitData = readJSON("Visits.json") || readJSON("Visit.json") || readJSON("Consultations.json") || [];

    // We will build arrays for quick batched insertions
    const newVisitsToInsert: any[] = [];
    const visitRefsToUpdate: any[] = []; // Temporary holding place for linking diags/rxs to newly created visits later

    if (visitData.length > 0) {
        const sample = visitData[0];
        const keys = Object.keys(sample);
        const find = (patterns: string[]) => keys.find((k) => patterns.some((p) => k.toLowerCase().includes(p.toLowerCase())));

        const vMapping = {
            patientId: find(["PatientID", "patient_id", "PatientId", "P_ID"]),
            complaint: find(["Complaint", "ChiefComplaint", "Reason", "السبب"]),
            notes: find(["Notes", "ClinicalNotes", "ملاحظات", "Description"]),
            date: find(["Date", "VisitDate", "CreatedAt", "التاريخ"]),
            diagnosis: find(["Diagnosis", "Diagnostic", "التشخيص"]),
            treatment: find(["Treatment", "Medication", "العلاج", "Prescription"]),
        };

        for (const row of visitData) {
            const legacyPatientId = Number(row[vMapping.patientId!]);
            const pgPatientId = legacyMap.get(legacyPatientId);
            if (!pgPatientId) continue;

            const visitDate = cleanDate(row[vMapping.date!]);
            if (!visitDate) continue;

            const dateStr = visitDate.toISOString().split("T")[0];
            const cacheKey = `${pgPatientId}_${dateStr}`;

            if (!visitMap.has(cacheKey)) {
                // We need to create it. We generate an ID for the map so child dependencies can link to it later
                newVisitsToInsert.push({
                    _cacheKey: cacheKey,
                    patientId: pgPatientId,
                    visitType: "consultation",
                    status: "completed",
                    chiefComplaint: clean(row[vMapping.complaint!]),
                    clinicalNotes: clean(row[vMapping.notes!]),
                    startedAt: visitDate,
                    completedAt: visitDate,
                });
                // Optimistically prevent duplicates in this very iteration
                visitMap.set(cacheKey, "pending");
            }

            // Link diags and treatments attached directly to the visit row
            visitRefsToUpdate.push({
                cacheKey: cacheKey,
                diagText: clean(row[vMapping.diagnosis!]),
                treatText: clean(row[vMapping.treatment!])
            });
        }

        console.log(`  Prepared ${newVisitsToInsert.length} visits for DB insert...`);
        const chunks = chunkArray(newVisitsToInsert, 2000);
        let imported = 0;
        for (const chunk of chunks) {
            // Strip out our temporary _cacheKey before inserting
            const insertChunk = chunk.map(c => {
                const { _cacheKey, ...rest } = c;
                return rest;
            });
            const returned = await db.insert(visits).values(insertChunk).returning({ id: visits.id, patientId: visits.patientId, startedAt: visits.startedAt });
            for (const v of returned) {
                if (v.startedAt) {
                    const dateStr = v.startedAt.toISOString().split("T")[0];
                    visitMap.set(`${v.patientId}_${dateStr}`, v.id); // Update pending with real ID
                }
            }
            imported += returned.length;
        }
        console.log(`  ✓ Inserted ${imported} new visits`);

        // Now resolve attached Diags and Treatments from Visits table
        const newDiagsMain: any[] = [];
        const newRxsMain: any[] = [];

        for (const ref of visitRefsToUpdate) {
            const visitId = visitMap.get(ref.cacheKey);
            if (!visitId || visitId === "pending") continue;

            if (ref.diagText) {
                const dCacheKey = `${visitId}_${ref.diagText}`;
                if (!diagSet.has(dCacheKey)) {
                    newDiagsMain.push({ visitId, name: ref.diagText });
                    diagSet.add(dCacheKey);
                }
            }
            if (ref.treatText) {
                const rCacheKey = `${visitId}_${ref.treatText}`;
                if (!rxSet.has(rCacheKey)) {
                    newRxsMain.push({ visitId, medicationName: ref.treatText });
                    rxSet.add(rCacheKey);
                }
            }
        }

        // Insert Diags Main
        if (newDiagsMain.length > 0) {
            const dChunks = chunkArray(newDiagsMain, 5000);
            let dImp = 0;
            for (const chunk of dChunks) {
                await db.insert(diagnoses).values(chunk);
                dImp += chunk.length;
            }
            console.log(`  ✓ Inserted ${dImp} diagnoses derived from visits table`);
        }
        // Insert Rxs Main
        if (newRxsMain.length > 0) {
            const rChunks = chunkArray(newRxsMain, 5000);
            let rImp = 0;
            for (const chunk of rChunks) {
                await db.insert(prescriptions).values(chunk);
                rImp += chunk.length;
            }
            console.log(`  ✓ Inserted ${rImp} prescriptions derived from visits table`);
        }
    }
    console.timeEnd("Visits Query");

    // ─── 3. Load Standalone Diagnoses ─────────────────────────────────

    console.log("\n🔄 Processing standalone diagnoses...");
    console.time("Diagnoses Query");
    const diagData = readJSON("Diagnoses.json") || readJSON("Diagnostic.json") || [];
    if (diagData.length > 0) {
        const sample = diagData[0];
        const dKeys = Object.keys(sample);
        const findD = (patterns: string[]) => dKeys.find((k) => patterns.some((p) => k.toLowerCase().includes(p.toLowerCase())));

        const dMapping = {
            patientId: findD(["PatientID", "patient_id", "PatientId", "P_ID"]),
            date: findD(["Date", "VisitDate", "CreatedAt", "التاريخ", "D_Date", "Diag_Date"]),
            diagnosis: findD(["Diagnosis", "Diagnostic", "التشخيص", "Value", "Result", "Diag_Desc"]),
            notes: findD(["Notes", "Description", "ملاحظات", "Diag_Clinic", "Clinic"]),
        };

        const newDiagsToInsert: any[] = [];
        const missingVisitsToInsert: any[] = [];

        for (const row of diagData) {
            const legacyPatientId = Number(row[dMapping.patientId!]);
            const pgPatientId = legacyMap.get(legacyPatientId);
            if (!pgPatientId) continue;

            const diagDate = cleanDate(row[dMapping.date!]);
            if (!diagDate) continue;

            const dateStr = diagDate.toISOString().split("T")[0];
            const vCacheKey = `${pgPatientId}_${dateStr}`;

            let visitId = visitMap.get(vCacheKey);

            // If the visit doesn't exist, we must create it
            if (!visitId) {
                missingVisitsToInsert.push({
                    _cacheKey: vCacheKey,
                    patientId: pgPatientId,
                    visitType: "consultation",
                    status: "completed",
                    chiefComplaint: "Imported History (Diag)",
                    startedAt: diagDate,
                    completedAt: diagDate,
                });
                visitMap.set(vCacheKey, "pending");
                visitId = "pending"; // We will resolve this below
            }

            const diagText = clean(row[dMapping.diagnosis!]);
            if (diagText) {
                // Link them temporarily with pending placeholder if visit is missing
                newDiagsToInsert.push({
                    _vCacheKey: vCacheKey,
                    name: diagText,
                    description: clean(row[dMapping.notes!]),
                });
            }
        }

        // Insert missing visits first so we can get their IDs
        if (missingVisitsToInsert.length > 0) {
            const chunks = chunkArray(missingVisitsToInsert, 2000);
            for (const chunk of chunks) {
                const insertChunk = chunk.map(c => { const { _cacheKey, ...rest } = c; return rest; });
                const returned = await db.insert(visits).values(insertChunk).returning({ id: visits.id, patientId: visits.patientId, startedAt: visits.startedAt });
                for (const v of returned) {
                    if (v.startedAt) {
                        const dStr = v.startedAt.toISOString().split("T")[0];
                        visitMap.set(`${v.patientId}_${dStr}`, v.id); // Resolve pending
                    }
                }
            }
        }

        // Now resolve visit IDs and check duplicate Diags
        const finalDiags: any[] = [];
        for (const pd of newDiagsToInsert) {
            const realVisitId = visitMap.get(pd._vCacheKey);
            if (!realVisitId || realVisitId === "pending") continue;

            const dKey = `${realVisitId}_${pd.name}`;
            if (!diagSet.has(dKey)) {
                finalDiags.push({
                    visitId: realVisitId,
                    name: pd.name,
                    description: pd.description
                });
                diagSet.add(dKey);
            }
        }

        // Batch insert Diags
        console.log(`  Prepared ${finalDiags.length} standalone diagnoses for DB insert...`);
        if (finalDiags.length > 0) {
            const chunks = chunkArray(finalDiags, 5000);
            let imported = 0;
            for (const chunk of chunks) {
                await db.insert(diagnoses).values(chunk);
                imported += chunk.length;
            }
            console.log(`  ✓ Inserted ${imported} standalone diagnoses`);
        }
    }
    console.timeEnd("Diagnoses Query");

    // ─── 4. Load Standalone Prescriptions ─────────────────────────────

    console.log("\n🔄 Processing standalone prescriptions...");
    console.time("Prescriptions Query");
    const rxData = readJSON("Prescriptions.json") || readJSON("Medicine.json") || [];

    if (rxData.length > 0) {
        const sample = rxData[0];
        const rKeys = Object.keys(sample);
        const findR = (patterns: string[]) => rKeys.find((k) => patterns.some((p) => k.toLowerCase().includes(p.toLowerCase())));

        const rMapping = {
            patientId: findR(["PatientID", "patient_id", "PatientId", "P_ID"]),
            date: findR(["Date", "VisitDate", "CreatedAt", "التاريخ", "R_Date", "Med_Date"]),
            medication: findR(["Medication", "Medicine", "Drug", "Name", "الدواء", "Med_desc"]),
            dosage: findR(["Dosage", "Dose", "الجرعة"]),
            instructions: findR(["Instructions", "Note", "ملاحظات"]),
        };

        const newRxsToInsert: any[] = [];
        const missingVisitsToInsert: any[] = [];

        for (const row of rxData) {
            const legacyPatientId = Number(row[rMapping.patientId!]);
            const pgPatientId = legacyMap.get(legacyPatientId);
            if (!pgPatientId) continue;

            const rxDate = cleanDate(row[rMapping.date!]);
            if (!rxDate) continue;

            const dateStr = rxDate.toISOString().split("T")[0];
            const vCacheKey = `${pgPatientId}_${dateStr}`;

            let visitId = visitMap.get(vCacheKey);

            if (!visitId) {
                missingVisitsToInsert.push({
                    _cacheKey: vCacheKey,
                    patientId: pgPatientId,
                    visitType: "consultation",
                    status: "completed",
                    chiefComplaint: "Imported History (Rx)",
                    startedAt: rxDate,
                    completedAt: rxDate,
                });
                visitMap.set(vCacheKey, "pending");
                visitId = "pending";
            }

            const medName = clean(row[rMapping.medication!]);
            if (medName) {
                newRxsToInsert.push({
                    _vCacheKey: vCacheKey,
                    medicationName: medName,
                    dosage: clean(row[rMapping.dosage!]),
                    instructions: clean(row[rMapping.instructions!]),
                });
            }
        }

        // Insert missing visits first
        if (missingVisitsToInsert.length > 0) {
            const chunks = chunkArray(missingVisitsToInsert, 2000);
            for (const chunk of chunks) {
                const insertChunk = chunk.map(c => { const { _cacheKey, ...rest } = c; return rest; });
                const returned = await db.insert(visits).values(insertChunk).returning({ id: visits.id, patientId: visits.patientId, startedAt: visits.startedAt });
                for (const v of returned) {
                    if (v.startedAt) {
                        const dStr = v.startedAt.toISOString().split("T")[0];
                        visitMap.set(`${v.patientId}_${dStr}`, v.id); // Resolve pending
                    }
                }
            }
        }

        // Resolve visit IDs and check duplicate Rxs
        const finalRxs: any[] = [];
        for (const pr of newRxsToInsert) {
            const realVisitId = visitMap.get(pr._vCacheKey);
            if (!realVisitId || realVisitId === "pending") continue;

            const rKey = `${realVisitId}_${pr.medicationName}`;
            if (!rxSet.has(rKey)) {
                finalRxs.push({
                    visitId: realVisitId,
                    medicationName: pr.medicationName,
                    dosage: pr.dosage,
                    instructions: pr.instructions
                });
                rxSet.add(rKey);
            }
        }

        // Batch insert Prescriptions
        console.log(`  Prepared ${finalRxs.length} standalone prescriptions for DB insert...`);
        if (finalRxs.length > 0) {
            const chunks = chunkArray(finalRxs, 5000);
            let imported = 0;
            for (const chunk of chunks) {
                await db.insert(prescriptions).values(chunk);
                imported += chunk.length;
            }
            console.log(`  ✓ Inserted ${imported} standalone prescriptions`);
        }
    }
    console.timeEnd("Prescriptions Query");

    // ─── Summary ──────────────────────────────────────────────────

    console.timeEnd("Total Migration Time");

    // Using standard Drizzle count for cross-compatibility
    const [pCount] = await db.select({ count: sql`count(*)`.mapWith(Number) }).from(patients);
    const [vCount] = await db.select({ count: sql`count(*)`.mapWith(Number) }).from(visits);
    const [dCount] = await db.select({ count: sql`count(*)`.mapWith(Number) }).from(diagnoses);
    const [rCount] = await db.select({ count: sql`count(*)`.mapWith(Number) }).from(prescriptions);

    console.log("═══════════════════════════════════════════════════");
    console.log("  Migration Summary");
    console.log("═══════════════════════════════════════════════════");
    console.log(`  Patients in database: ${pCount?.count || 0}`);
    console.log(`  Visits in database:   ${vCount?.count || 0}`);
    console.log(`  Diagnoses:            ${dCount?.count || 0}`);
    console.log(`  Prescriptions:        ${rCount?.count || 0}`);
    console.log("═══════════════════════════════════════════════════\n");
    process.exit(0);
}

migrate().catch((e) => {
    console.error(`\n❌ Fatal Error: ${e.message}`);
    process.exit(1);
});
