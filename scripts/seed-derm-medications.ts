
import { db } from "../server/db";
import { medicalTerms } from "../server/db/schema";
import { eq, and } from "drizzle-orm";

// ─── Comprehensive Dermatology Medications ──────────────────────────

const DERM_MEDICATIONS = [
    // ════════════ Systemic Retinoids ════════════
    "Isotretinoin 10mg",
    "Isotretinoin 20mg",
    "Isotretinoin 40mg",
    "Acitretin 10mg",
    "Acitretin 25mg",

    // ════════════ Topical Retinoids ════════════
    "Tretinoin 0.025% Cream",
    "Tretinoin 0.05% Cream",
    "Tretinoin 0.1% Cream",
    "Adapalene 0.1% Gel",
    "Adapalene 0.3% Gel",
    "Tazarotene 0.05% Gel",
    "Tazarotene 0.1% Gel",
    "Trifarotene 0.005% Cream",

    // ════════════ Topical Corticosteroids (Low Potency) ════════════
    "Hydrocortisone 0.5% Cream",
    "Hydrocortisone 1% Cream",
    "Hydrocortisone 2.5% Cream",
    "Desonide 0.05% Cream",
    "Desonide 0.05% Lotion",

    // ════════════ Topical Corticosteroids (Medium Potency) ════════════
    "Betamethasone Valerate 0.1% Cream",
    "Betamethasone Valerate 0.1% Ointment",
    "Triamcinolone Acetonide 0.1% Cream",
    "Triamcinolone Acetonide 0.1% Ointment",
    "Fluocinolone Acetonide 0.025% Cream",
    "Mometasone Furoate 0.1% Cream",
    "Mometasone Furoate 0.1% Lotion",

    // ════════════ Topical Corticosteroids (High Potency) ════════════
    "Betamethasone Dipropionate 0.05% Cream",
    "Betamethasone Dipropionate 0.05% Ointment",
    "Fluocinonide 0.05% Cream",
    "Fluocinonide 0.05% Gel",
    "Desoximetasone 0.25% Cream",

    // ════════════ Topical Corticosteroids (Super High Potency) ════════════
    "Clobetasol Propionate 0.05% Cream",
    "Clobetasol Propionate 0.05% Ointment",
    "Clobetasol Propionate 0.05% Solution",
    "Halobetasol Propionate 0.05% Cream",

    // ════════════ Calcineurin Inhibitors ════════════
    "Tacrolimus 0.03% Ointment",
    "Tacrolimus 0.1% Ointment",
    "Pimecrolimus 1% Cream",

    // ════════════ Systemic Antibiotics ════════════
    "Doxycycline 50mg",
    "Doxycycline 100mg",
    "Minocycline 50mg",
    "Minocycline 100mg",
    "Azithromycin 250mg",
    "Azithromycin 500mg",
    "Amoxicillin 500mg",
    "Amoxicillin/Clavulanate 625mg",
    "Cephalexin 500mg",
    "Ciprofloxacin 500mg",
    "Trimethoprim/Sulfamethoxazole DS",
    "Rifampin 300mg",
    "Clindamycin 300mg",
    "Metronidazole 500mg",
    "Flucloxacillin 500mg",
    "Erythromycin 250mg",
    "Erythromycin 500mg",

    // ════════════ Topical Antibiotics ════════════
    "Clindamycin 1% Gel",
    "Clindamycin 1% Solution",
    "Clindamycin 1% Lotion",
    "Erythromycin 2% Solution",
    "Erythromycin 2% Gel",
    "Mupirocin 2% Cream",
    "Mupirocin 2% Ointment",
    "Fusidic Acid 2% Cream",
    "Fusidic Acid 2% Ointment",
    "Gentamicin 0.1% Cream",
    "Bacitracin Ointment",
    "Neomycin/Bacitracin/Polymyxin B Ointment",
    "Metronidazole 0.75% Gel",
    "Metronidazole 1% Cream",
    "Silver Sulfadiazine 1% Cream",

    // ════════════ Topical Acne Treatments ════════════
    "Benzoyl Peroxide 2.5% Gel",
    "Benzoyl Peroxide 5% Gel",
    "Benzoyl Peroxide 10% Gel",
    "Benzoyl Peroxide 5% Wash",
    "Benzoyl Peroxide/Clindamycin Gel",
    "Benzoyl Peroxide/Adapalene Gel",
    "Azelaic Acid 15% Gel",
    "Azelaic Acid 20% Cream",
    "Salicylic Acid 2% Solution",
    "Salicylic Acid 2% Cleanser",
    "Dapsone 5% Gel",
    "Dapsone 7.5% Gel",

    // ════════════ Systemic Antifungals ════════════
    "Terbinafine 250mg",
    "Itraconazole 100mg",
    "Fluconazole 50mg",
    "Fluconazole 150mg",
    "Fluconazole 200mg",
    "Griseofulvin 500mg",
    "Griseofulvin Ultramicrosize 250mg",
    "Voriconazole 200mg",

    // ════════════ Topical Antifungals ════════════
    "Ketoconazole 2% Cream",
    "Ketoconazole 2% Shampoo",
    "Clotrimazole 1% Cream",
    "Clotrimazole 1% Solution",
    "Miconazole 2% Cream",
    "Terbinafine 1% Cream",
    "Naftifine 1% Cream",
    "Ciclopirox 8% Nail Lacquer",
    "Ciclopirox 1% Cream",
    "Ciclopirox 1% Shampoo",
    "Sertaconazole 2% Cream",
    "Econazole 1% Cream",
    "Amorolfine 5% Nail Lacquer",
    "Selenium Sulfide 2.5% Shampoo",
    "Zinc Pyrithione Shampoo",

    // ════════════ Systemic Antivirals ════════════
    "Acyclovir 200mg",
    "Acyclovir 400mg",
    "Acyclovir 800mg",
    "Valacyclovir 500mg",
    "Valacyclovir 1000mg",
    "Famciclovir 250mg",
    "Famciclovir 500mg",

    // ════════════ Topical Antivirals ════════════
    "Acyclovir 5% Cream",
    "Penciclovir 1% Cream",
    "Imiquimod 5% Cream",
    "Imiquimod 3.75% Cream",

    // ════════════ Antihistamines ════════════
    "Cetirizine 10mg",
    "Levocetirizine 5mg",
    "Loratadine 10mg",
    "Desloratadine 5mg",
    "Fexofenadine 120mg",
    "Fexofenadine 180mg",
    "Hydroxyzine 10mg",
    "Hydroxyzine 25mg",
    "Diphenhydramine 25mg",
    "Chlorpheniramine 4mg",
    "Bilastine 20mg",
    "Rupatadine 10mg",
    "Ebastine 10mg",
    "Ebastine 20mg",

    // ════════════ Systemic Corticosteroids ════════════
    "Prednisolone 5mg",
    "Prednisolone 20mg",
    "Prednisone 5mg",
    "Prednisone 10mg",
    "Prednisone 20mg",
    "Methylprednisolone 4mg",
    "Methylprednisolone 16mg",
    "Dexamethasone 0.5mg",
    "Dexamethasone 4mg",
    "Triamcinolone 40mg/mL (Injectable)",
    "Betamethasone 6mg/mL (Injectable)",

    // ════════════ Immunosuppressants ════════════
    "Methotrexate 2.5mg",
    "Methotrexate 10mg",
    "Methotrexate 15mg (Injectable)",
    "Methotrexate 25mg (Injectable)",
    "Cyclosporine 25mg",
    "Cyclosporine 50mg",
    "Cyclosporine 100mg",
    "Azathioprine 50mg",
    "Mycophenolate Mofetil 500mg",
    "Hydroxychloroquine 200mg",
    "Dapsone 100mg",
    "Colchicine 0.5mg",
    "Thalidomide 50mg",
    "Apremilast 30mg",

    // ════════════ Biologics ════════════
    "Dupilumab 300mg (Injection)",
    "Secukinumab 150mg (Injection)",
    "Ustekinumab 45mg (Injection)",
    "Adalimumab 40mg (Injection)",
    "Etanercept 50mg (Injection)",
    "Infliximab (IV Infusion)",
    "Ixekizumab 80mg (Injection)",
    "Risankizumab 150mg (Injection)",
    "Guselkumab 100mg (Injection)",
    "Omalizumab 150mg (Injection)",
    "Rituximab (IV Infusion)",
    "Baricitinib 2mg",
    "Baricitinib 4mg",
    "Upadacitinib 15mg",
    "Upadacitinib 30mg",
    "Abrocitinib 100mg",
    "Abrocitinib 200mg",
    "Tofacitinib 5mg",
    "Deucravacitinib 6mg",

    // ════════════ Scabicides & Pediculicides ════════════
    "Permethrin 5% Cream",
    "Permethrin 1% Lotion (Head Lice)",
    "Ivermectin 3mg",
    "Ivermectin 6mg",
    "Ivermectin 12mg",
    "Ivermectin 1% Cream",
    "Benzyl Benzoate 25% Lotion",
    "Crotamiton 10% Cream",
    "Lindane 1% Lotion",
    "Malathion 0.5% Lotion",
    "Spinosad 0.9% Suspension",

    // ════════════ Wart Treatments ════════════
    "Salicylic Acid 17% Solution (Warts)",
    "Salicylic Acid 40% Plaster (Warts)",
    "Podophyllotoxin 0.5% Solution",
    "Podophyllin 25% Solution",
    "5-Fluorouracil 5% Cream",
    "5-Fluorouracil 0.5% Cream",
    "Cantharidin Solution",
    "Sinecatechins 15% Ointment",

    // ════════════ Depigmenting / Pigment Agents ════════════
    "Hydroquinone 2% Cream",
    "Hydroquinone 4% Cream",
    "Kojic Acid Cream",
    "Arbutin Cream",
    "Vitamin C Serum (L-Ascorbic Acid 15%)",
    "Tranexamic Acid 250mg",
    "Tranexamic Acid 500mg",
    "Methoxsalen 10mg (PUVA)",
    "Monobenzone 20% Cream",

    // ════════════ Hair Loss Treatments ════════════
    "Minoxidil 2% Solution",
    "Minoxidil 5% Solution",
    "Minoxidil 5% Foam",
    "Finasteride 1mg",
    "Dutasteride 0.5mg",
    "Spironolactone 25mg",
    "Spironolactone 50mg",
    "Spironolactone 100mg",
    "Biotin 5mg",
    "Biotin 10mg",
    "Iron Supplement (Ferrous Sulfate 325mg)",
    "Zinc Sulfate 220mg",

    // ════════════ Emollients & Moisturizers ════════════
    "Urea 10% Cream",
    "Urea 20% Cream",
    "Urea 40% Cream",
    "Lactic Acid 12% Cream",
    "Petrolatum Ointment (White Petrolatum)",
    "Aqueous Cream",
    "Cetaphil Moisturizing Cream",
    "Ceramide-based Moisturizer",
    "Colloidal Oatmeal Cream",
    "Glycerin/Paraffin Emollient",

    // ════════════ Sunscreens ════════════
    "Sunscreen SPF 30",
    "Sunscreen SPF 50+",
    "Sunscreen SPF 50+ (Tinted)",
    "Mineral Sunscreen (Zinc Oxide/Titanium Dioxide)",

    // ════════════ Keratolytics ════════════
    "Salicylic Acid 3% Ointment",
    "Salicylic Acid 6% Ointment",
    "Coal Tar 5% Ointment",
    "Coal Tar 2% Shampoo",
    "Calcipotriol 0.005% Ointment",
    "Calcipotriol/Betamethasone Ointment",
    "Anthralin 1% Cream",

    // ════════════ Antiseptics & Wound Care ════════════
    "Povidone-Iodine 10% Solution",
    "Chlorhexidine 4% Wash",
    "Hydrogen Peroxide 1% Cream",
    "Potassium Permanganate Solution",

    // ════════════ Local Anesthetics ════════════
    "Lidocaine 2% Injection",
    "Lidocaine/Prilocaine Cream (EMLA)",
    "Lidocaine 4% Cream",

    // ════════════ Miscellaneous Dermatology ════════════
    "Calamine Lotion",
    "Menthol/Camphor Lotion",
    "Capsaicin 0.025% Cream",
    "Capsaicin 0.075% Cream",
    "Brimonidine 0.33% Gel (Rosacea)",
    "Oxymetazoline 1% Cream (Rosacea)",
    "Eflornithine 13.9% Cream (Hirsutism)",
    "Aluminum Chloride 20% Solution (Hyperhidrosis)",
    "Glycopyrrolate 1% Cloth (Hyperhidrosis)",
    "Diclofenac 3% Gel (Actinic Keratosis)",
    "Ingenol Mebutate 0.015% Gel",
    "Retapamulin 1% Ointment",
    "Crisaborole 2% Ointment",
    "Ruxolitinib 1.5% Cream",
    "Tapinarof 1% Cream",
    "Roflumilast 0.3% Cream",
    "Botulinum Toxin Type A (Botox) 100U",
    "Botulinum Toxin Type A (Dysport) 300U",
    "Hyaluronic Acid Filler",
    "Calcium Hydroxylapatite Filler",
    "Poly-L-Lactic Acid Filler",
    "Intralesional Triamcinolone 10mg/mL",
    "Intralesional Triamcinolone 40mg/mL",
    "Intralesional 5-Fluorouracil 50mg/mL",
    "Intralesional Bleomycin",
    "Folic Acid 5mg",
    "Vitamin D3 1000IU",
    "Vitamin D3 50000IU",
    "Omega-3 Fish Oil 1000mg",
    "Pantothenic Acid (Vitamin B5) 500mg",
    "Nicotinamide (Vitamin B3) 500mg",
    "Zinc Picolinate 50mg",
];

async function seedMedications() {
    console.log("💊 Starting dermatology medications seed...\n");
    let added = 0;
    let skipped = 0;

    for (const term of DERM_MEDICATIONS) {
        const existing = await db.query.medicalTerms.findFirst({
            where: and(
                eq(medicalTerms.category, "medication"),
                eq(medicalTerms.term, term)
            ),
        });

        if (!existing) {
            await db.insert(medicalTerms).values({
                category: "medication",
                term,
                usageCount: 1,
                isVerified: true,
            });
            added++;
        } else {
            skipped++;
        }
    }

    console.log(`✅ Seeding complete!`);
    console.log(`   ➕ Added: ${added} new medications`);
    console.log(`   ⏭️  Skipped: ${skipped} (already existed)`);
    console.log(`   📦 Total in list: ${DERM_MEDICATIONS.length}`);
    process.exit(0);
}

seedMedications().catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
});
