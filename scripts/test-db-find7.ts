import { db } from "../server/db/index.js";
import { patients } from "../server/db/schema.js";
import { ilike, or } from "drizzle-orm";

async function run() {
  const result = await db.query.patients.findMany({
      where: or(ilike(patients.firstName, "%sahily%"), ilike(patients.lastName, "%sahily%"))
  });
  console.log("ALL sahily:", result.map(p => ({
    firstName: p.firstName,
    fatherName: p.fatherName,
    lastName: p.lastName,
    phone: p.phone,
  })));
  process.exit();
}
run();
