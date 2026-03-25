import { db } from "../server/db/index.js";
import { patients } from "../server/db/schema.js";
import { inArray } from "drizzle-orm";

async function run() {
  const result = await db.query.patients.findMany({
      where: inArray(patients.firstName, ["lama", "younes"])
  });
  console.log("Other patients:", result.map(p => ({
    firstName: p.firstName,
    fatherName: p.fatherName,
    lastName: p.lastName
  })));
  process.exit();
}
run();
