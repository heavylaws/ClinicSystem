import { db } from "../server/db/index.js";
import { patients } from "../server/db/schema.js";
import { ilike, and } from "drizzle-orm";

async function run() {
  const result = await db.query.patients.findMany({
      where: ilike(patients.firstName, "mohamad sahily")
  });
  console.log("firstName = mohamad sahily:", result);
  process.exit();
}
run();
