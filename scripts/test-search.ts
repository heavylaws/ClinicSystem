import { db } from "../server/db/index.js";
import { patients } from "../server/db/schema.js";
import { eq, ilike, or, and, sql } from "drizzle-orm";

async function run() {
  const q = "fatima mansour";
  const words = q.trim().split(/\s+/).filter(w => w.length > 0);
  const wordConditions = words.map(word => {
      const pattern = `%${word}%`;
      return or(
          ilike(patients.firstName, pattern),
          ilike(patients.lastName, pattern),
          ilike(patients.fatherName, pattern),
          ilike(patients.phone, pattern),
          sql`CAST(${patients.fileNumber} AS TEXT) LIKE ${pattern}`
      );
  });
  
  const results = await db
      .select({
          firstName: patients.firstName,
          fatherName: patients.fatherName,
          lastName: patients.lastName,
      })
      .from(patients)
      .where(and(...wordConditions))
      .limit(5);
      
  console.log("Results for 'fatima mansour':", results);
  process.exit();
}
run();
