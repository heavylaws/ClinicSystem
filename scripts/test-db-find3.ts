import { db } from "../server/db/index.js";
import { patients } from "../server/db/schema.js";
import { ilike } from "drizzle-orm";

async function run() {
  const result = await db.query.patients.findFirst({
      where: ilike(patients.firstName, "%mohamad%")
  });
  console.log("Patient mohamad:", {
    firstName: result?.firstName,
    fatherName: result?.fatherName,
    lastName: result?.lastName,
  });
  process.exit();
}
run();
