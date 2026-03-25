import { db } from "../server/db/index.js";
import { patients } from "../server/db/schema.js";
import { ilike, and } from "drizzle-orm";

async function run() {
  const result = await db.query.patients.findMany({
      where: and(ilike(patients.firstName, "mohamad"), ilike(patients.fatherName, "sahily"))
  });
  console.log("firstName = mohamad, fatherName = sahily:", result);
  process.exit();
}
run();
