import { db } from "../server/db/index.js";
import { patients } from "../server/db/schema.js";
import { ilike } from "drizzle-orm";

async function run() {
  const result = await db.query.patients.findMany({
      where: ilike(patients.firstName, "%boampong%")
  });
  console.log("Patient boampong:", result.map(p => ({
    firstName: p.firstName,
    fatherName: p.fatherName,
    lastName: p.lastName,
    phone: p.phone,
  })));
  process.exit();
}
run();
