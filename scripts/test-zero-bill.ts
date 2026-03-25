import { db } from "../server/db/index.js";
import { billings } from "../server/db/schema.js";
import { eq } from "drizzle-orm";

async function run() {
  const result = await db.select().from(billings).where(eq(billings.totalAmount, "0.00"));
  console.log("Bills with 0.00:", result.length);
  if (result.length > 0) {
      console.log(result[result.length - 1]);
  }
  process.exit();
}
run();
