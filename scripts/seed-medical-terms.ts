
import { db } from "../server/db";
import { medicalTerms } from "../server/db/schema";
import { eq, and } from "drizzle-orm";

const DIAGNOSES = [
    "Acne Vulgaris",
    "Acne Rosacea",
    "Atopic Dermatitis (Eczema)",
    "Psoriasis",
    "Seborrheic Dermatitis",
    "Alopecia Areata",
    "Androgenetic Alopecia",
    "Tinea Corporis",
    "Tinea Pedis",
    "Tinea Capitis",
    "Onychomycosis",
    "Vitiligo",
    "Melasma",
    "Urticaria",
    "Contact Dermatitis",
    "Scabies",
    "Lichen Planus",
    "Keloid",
    "Hypertrophic Scar",
    "Basal Cell Carcinoma",
    "Squamous Cell Carcinoma",
    "Melanoma",
    "Actinic Keratosis",
    "Seborrheic Keratosis",
    "Warts (Verruca Vulgaris)",
    "Molluscum Contagiosum",
    "Herpes Zoster (Shingles)",
    "Herpes Simplex",
    "Impetigo",
    "Folliculitis",
    "Cellulitis",
    "Erysipelas",
    "Pityriasis Rosea",
    "Pityriasis Versicolor",
    "Hidradenitis Suppurativa",
    "Hyperhidrosis",
    "Telogen Effluvium",
    "Xanthelasma",
    "Lipoma",
    "Epidermal Cyst",
];

const MEDICATIONS = [
    "Doxycycline 100mg",
    "Minocycline 100mg",
    "Isotretinoin 10mg",
    "Isotretinoin 20mg",
    "Isotretinoin 40mg",
    "Prednisolone 5mg",
    "Prednisolone 20mg",
    "Methylprednisolone",
    "Betamethasone Cream",
    "Mometasone Furoate Cream",
    "Clobetasol Propionate Ointment",
    "Hydrocortisone 1% Cream",
    "Tacrolimus 0.1% Ointment",
    "Pimecrolimus 1% Cream",
    "Adapalene 0.1% Gel",
    "Tretinoin 0.025% Cream",
    "Tretinoin 0.05% Cream",
    "Benzoyl Peroxide 2.5% Gel",
    "Benzoyl Peroxide 5% Gel",
    "Clindamycin 1% Solution",
    "Erythromycin 2% Solution",
    "Azelaic Acid 20% Cream",
    "Ketoconazole 2% Shampoo",
    "Ketoconazole 2% Cream",
    "Terbinafine 250mg",
    "Itraconazole 100mg",
    "Fluconazole 150mg",
    "Acyclovir 400mg",
    "Valacyclovir 500mg",
    "Fexofenadine 180mg",
    "Levocetirizine 5mg",
    "Desloratadine 5mg",
    "Hydroxyzine 25mg",
    "Permethrin 5% Cream",
    "Ivermectin 12mg",
    "Mupirocin 2% Ointment",
    "Fusidic Acid Cream",
    "Minoxidil 5% Solution",
    "Finasteride 1mg",
    "Sunscreen SPF 50+",
    "Moisturizing Cream",
];

const LAB_TESTS = [
    "CBC (Complete Blood Count)",
    "Liver Function Test (LFT)",
    "Lipid Profile",
    "Renal Function Test (RFT)",
    "Blood Glucose (Random)",
    "Blood Glucose (Fasting)",
    "HbA1c",
    "Thyroid Function Test (TFT)",
    "Serum Ferritin",
    "Vitamin D Level",
    "Vitamin B12 Level",
    "Hormonal Profile (FSH, LH, Prolactin)",
    "Testosterone (Total & Free)",
    "DHEAS",
    "ANA (Antinuclear Antibody)",
    "IgE Level",
    "Skin Scraping for Fungus (KOH)",
    "Skin Biopsy",
    "Culture and Sensitivity (Pus/Swab)",
    "Urine Routine Analysis",
    "Pregnancy Test (Beta-HCG)",
    "CRP (C-Reactive Protein)",
    "ESR (Erythrocyte Sedimentation Rate)",
    "Hepatitis B Surface Antigen",
    "Hepatitis C Antibody",
    "HIV Screen",
    "VDRL / RPR",
];

const PROCEDURES = [
    "Consultation",
    "Follow-up Consultation",
    "Skin Biopsy (Punch)",
    "Skin Biopsy (Shave)",
    "Excision of Lesion",
    "Cryotherapy (Liquid Nitrogen)",
    "Electrocautery",
    "Radiofrequency Ablation",
    "Laser Hair Removal (Face)",
    "Laser Hair Removal (Axilla)",
    "Laser Hair Removal (Body)",
    "CO2 Fractional Laser (Acne Scars)",
    "Q-Switched Nd:YAG Laser (Pigmentation)",
    "Laser Tattoo Removal",
    "Chemical Peel (Glycolic Acid)",
    "Chemical Peel (Salicylic Acid)",
    "TCA Cross",
    "Microneedling (Dermapen)",
    "PRP (Platelet-Rich Plasma) for Face",
    "PRP (Platelet-Rich Plasma) for Hair",
    "Mesotherapy (Hair)",
    "Mesotherapy (Face)",
    "Botox Injection (Forehead)",
    "Botox Injection (Crow's Feet)",
    "Botox Injection (Glabella)",
    "Botox for Hyperhidrosis",
    "Dermal Filler (Lips)",
    "Dermal Filler (Nasolabial Folds)",
    "Dermal Filler (Cheeks)",
    "Incision and Drainage (Abscess)",
    "Intralesional Steroid Injection",
    "Comedone Extraction",
    "Milia Extraction",
    "Mole Removal",
    "Skin Tag Removal",
];

const COMPLAINTS = [
    "Acne / Pimples",
    "Hair Loss",
    "Itching",
    "Rash",
    "Dark Spots / Pigmentation",
    "Mole Check",
    "Warts",
    "Skin Tag",
    "Eczema flare-up",
    "Psoriasis flare-up",
    "Nail problem",
    "Dandruff",
    "Excessive Sweating",
    "Wrinkles / Anti-aging",
    "Scar treatment",
    "Skin growth",
    "Dry skin",
    "Oily skin",
    "Sunburn",
    "Insect bite reaction",
];

async function seedCategory(category: string, terms: string[]) {
    console.log(`Seeding ${category}...`);
    let added = 0;

    for (const term of terms) {
        // Check if exists to avoid duplicates (naive approach is fine for seeding)
        const existing = await db.query.medicalTerms.findFirst({
            where: and(
                eq(medicalTerms.category, category),
                eq(medicalTerms.term, term)
            )
        });

        if (!existing) {
            await db.insert(medicalTerms).values({
                category,
                term,
                usageCount: 1,
                isVerified: true
            });
            added++;
        }
    }

    console.log(`  + Added ${added} new terms for ${category}`);
}

async function main() {
    console.log("🌱 Starting medical terms seed...");

    await seedCategory("diagnosis", DIAGNOSES);
    await seedCategory("medication", MEDICATIONS);
    await seedCategory("lab_test", LAB_TESTS);
    await seedCategory("procedure", PROCEDURES);
    await seedCategory("complaint", COMPLAINTS);

    console.log("✅ Seeding complete!");
    process.exit(0);
}

main().catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
});
