// Temporary storage for rewrite
const CHUNK_SIZE = 5000;

function chunkArray<T>(arr: T[], size: number): T[][] {
    const chunked: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        chunked.push(arr.slice(i, i + size));
    }
    return chunked;
}

// Memory mapping logic
const visitMap = new Map<string, string>(); // patientId_date -> visitId
const diagSet = new Set<string>(); // visitId_name
const rxSet = new Set<string>(); // visitId_name

// Load existing visits
const existingVisits = await db.select().from(visits);
for (const v of existingVisits) {
    const dStr = v.startedAt.toISOString().split("T")[0];
    visitMap.set(`${v.patientId}_${dStr}`, v.id);
}

// Load existing diagnoses
const existingDiags = await db.select({ visitId: diagnoses.visitId, name: diagnoses.name }).from(diagnoses);
for (const d of existingDiags) {
    diagSet.add(`${d.visitId}_${d.name}`);
}

// Load existing prescriptions
const existingRxs = await db.select({ visitId: prescriptions.visitId, name: prescriptions.medicationName }).from(prescriptions);
for (const r of existingRxs) {
    if (r.name) rxSet.add(`${r.visitId}_${r.name}`);
}
