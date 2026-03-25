
import { db } from "../server/db";
import { medicalTerms } from "../server/db/schema";
import { eq } from "drizzle-orm";

async function verify() {
    console.log("🔍 Verifying medical terms...");
    const terms = await db.select().from(medicalTerms).where(eq(medicalTerms.category, 'diagnosis')).limit(10);
    console.log("Found terms:", terms);
    process.exit(0);
}

verify().catch(console.error);
