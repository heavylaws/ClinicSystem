import { db } from "../server/db/index.js";
import { patients } from "../server/db/schema.js";
import { eq } from "drizzle-orm";

async function run() {
  const result = await db.query.patients.findFirst({
      where: eq(patients.phone, "81769100")
  });
  console.log("Patient with phone 81769100:", JSON.stringify(result, null, 2));
  process.exit();
}
run();
