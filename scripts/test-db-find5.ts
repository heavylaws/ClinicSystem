import { db } from "../server/db/index.js";
import { patients } from "../server/db/schema.js";
import { ilike, and } from "drizzle-orm";

async function run() {
  const result = await db.query.patients.findFirst({
      where: and(ilike(patients.firstName, "%mohamad%"), ilike(patients.lastName, "%sahily%"))
  });
  console.log("Patient mohamad sahily:", {
    firstName: result?.firstName,
    fatherName: result?.fatherName,
    lastName: result?.lastName,
  });
  process.exit();
}
run();
