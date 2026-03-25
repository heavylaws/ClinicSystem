import { db } from "../server/db/index.js";
import { patients } from "../server/db/schema.js";
import { ilike, or } from "drizzle-orm";

async function run() {
  const result = await db.query.patients.findFirst({
      where: or(ilike(patients.firstName, "%mohamad sahily%"), ilike(patients.fatherName, "%mohamad sahily%"), ilike(patients.lastName, "%mohamad sahily%"))
  });
  console.log("Patient mohamad sahily:", {
    firstName: result?.firstName,
    fatherName: result?.fatherName,
    lastName: result?.lastName,
  });
  process.exit();
}
run();
