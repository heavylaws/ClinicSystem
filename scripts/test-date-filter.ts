import { db } from "../server/db/index.js";
import { billings, visits, patients } from "../server/db/schema.js";
import { eq, desc, and, gte, lte } from "drizzle-orm";

async function run() {
  const startDate = "2026-02-26";
  const endDate = "2026-02-26";
  let start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  let end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  
  console.log("Start:", start);
  console.log("End:", end);

  const results = await db
      .select({
          billingId: billings.id,
          createdAt: billings.createdAt,
          totalAmount: billings.totalAmount,
      })
      .from(billings)
      .where(and(gte(billings.createdAt, start), lte(billings.createdAt, end)));
      
  console.log("Filtered bills:", results);
  process.exit();
}
run();
