import { db } from "../server/db/index.js";
import { billings, visits, patients } from "../server/db/schema.js";
import { eq, desc, and, gte, lte } from "drizzle-orm";

async function run() {
  const results = await db
      .select({
          billingId: billings.id,
          totalAmount: billings.totalAmount,
          patientFirstName: patients.firstName,
      })
      .from(billings)
      .innerJoin(visits, eq(billings.visitId, visits.id))
      .innerJoin(patients, eq(visits.patientId, patients.id))
      .where(eq(billings.totalAmount, "0.00"));
      
  console.log("Joined 0.00 bills:", results);
  process.exit();
}
run();
