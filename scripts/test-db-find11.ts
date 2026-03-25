import { db } from "../server/db/index.js";
import { patients } from "../server/db/schema.js";
import { inArray } from "drizzle-orm";

async function run() {
  const result = await db.query.patients.findMany({
      where: inArray(patients.firstName, ["boampong", "ababesh"])
  });
  console.log("Without fatherName:", result.map(p => `${p.firstName} ${p.lastName} ${p.phone}`));
  console.log("With fatherName:", result.map(p => `${p.firstName} ${p.fatherName ? p.fatherName + " " : ""}${p.lastName} ${p.phone}`));
  process.exit();
}
run();
