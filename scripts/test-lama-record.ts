import { db } from "../server/db/index.js";
import { patients } from "../server/db/schema.js";
import { and, eq, ilike } from "drizzle-orm";

async function run() {
  const result = await db.query.patients.findFirst({
      where: and(eq(patients.firstName, "lama"), eq(patients.lastName, "abou eid"))
  });
  console.log("Patient lama:", result);
  process.exit();
}
run();
