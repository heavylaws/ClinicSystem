import {
    pgTable,
    uuid,
    varchar,
    text,
    integer,
    boolean,
    timestamp,
    decimal,
    jsonb,
    serial,
    bigserial,
    inet,
    index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Users ──────────────────────────────────────────────────────────

export const users = pgTable("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    username: varchar("username", { length: 100 }).notNull().unique(),
    password: varchar("password", { length: 255 }).notNull(),
    displayName: varchar("display_name", { length: 200 }).notNull(),
    role: varchar("role", { length: 20 }).notNull().default("reception"), // admin, doctor, reception
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Patients ───────────────────────────────────────────────────────

export const patients = pgTable(
    "patients",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        legacyId: integer("legacy_id").unique(),
        legacyRaw: text("legacy_raw"),
        fileNumber: serial("file_number"),
        firstName: varchar("first_name", { length: 200 }).notNull(),
        lastName: varchar("last_name", { length: 200 }).notNull(),
        fatherName: varchar("father_name", { length: 200 }),
        gender: varchar("gender", { length: 10 }),
        dateOfBirth: varchar("date_of_birth", { length: 20 }),
        phone: varchar("phone", { length: 30 }),
        city: varchar("city", { length: 200 }),
        region: varchar("region", { length: 200 }),
        maritalStatus: varchar("marital_status", { length: 20 }),
        allergies: text("allergies"),
        chronicConditions: text("chronic_conditions"),
        insurance: varchar("insurance", { length: 300 }),
        notes: text("notes"),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (table) => [
        index("idx_patient_name").on(table.lastName, table.firstName),
        index("idx_patient_phone").on(table.phone),
        index("idx_patient_file_number").on(table.fileNumber),
    ]
);

// ─── Visits ─────────────────────────────────────────────────────────

export const visits = pgTable(
    "visits",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        patientId: uuid("patient_id")
            .notNull()
            .references(() => patients.id),
        doctorId: uuid("doctor_id").references(() => users.id),
        visitNumber: integer("visit_number").notNull().default(1),
        visitType: varchar("visit_type", { length: 50 }).default("consultation"),
        chiefComplaint: text("chief_complaint"),
        clinicalNotes: text("clinical_notes"),
        examination: text("examination"),
        status: varchar("status", { length: 20 }).notNull().default("queued"),
        startedAt: timestamp("started_at").notNull().defaultNow(),
        completedAt: timestamp("completed_at"),
    },
    (table) => [
        index("idx_visit_patient").on(table.patientId, table.startedAt),
        index("idx_visit_status").on(table.status),
        index("idx_visit_date").on(table.startedAt),
    ]
);

// ─── Diagnoses ──────────────────────────────────────────────────────

export const diagnoses = pgTable("diagnoses", {
    id: uuid("id").primaryKey().defaultRandom(),
    visitId: uuid("visit_id")
        .notNull()
        .references(() => visits.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 500 }).notNull(),
    icdCode: varchar("icd_code", { length: 20 }),
    description: text("description"),
    severity: varchar("severity", { length: 20 }),
});

// ─── Prescriptions ──────────────────────────────────────────────────

export const prescriptions = pgTable("prescriptions", {
    id: uuid("id").primaryKey().defaultRandom(),
    visitId: uuid("visit_id")
        .notNull()
        .references(() => visits.id, { onDelete: "cascade" }),
    medicationName: varchar("medication_name", { length: 500 }).notNull(),
    dosage: varchar("dosage", { length: 200 }),
    frequency: varchar("frequency", { length: 200 }),
    duration: varchar("duration", { length: 200 }),
    route: varchar("route", { length: 100 }),
    instructions: text("instructions"),
});

// ─── Lab Orders ─────────────────────────────────────────────────────

export const labOrders = pgTable("lab_orders", {
    id: uuid("id").primaryKey().defaultRandom(),
    visitId: uuid("visit_id")
        .notNull()
        .references(() => visits.id, { onDelete: "cascade" }),
    testName: varchar("test_name", { length: 500 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("ordered"),
    result: text("result"),
    orderedAt: timestamp("ordered_at").notNull().defaultNow(),
    resultedAt: timestamp("resulted_at"),
});

// ─── Procedures ─────────────────────────────────────────────────────

export const procedureLogs = pgTable("procedure_logs", {
    id: uuid("id").primaryKey().defaultRandom(),
    visitId: uuid("visit_id")
        .notNull()
        .references(() => visits.id, { onDelete: "cascade" }),
    procedureName: varchar("procedure_name", { length: 500 }).notNull(),
    details: text("details"),
    cost: decimal("cost", { precision: 15, scale: 2 }),
    performedAt: timestamp("performed_at").notNull().defaultNow(),
});

// ─── Billing ────────────────────────────────────────────────────────

export const billings = pgTable(
    "billings",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        visitId: uuid("visit_id")
            .notNull()
            .references(() => visits.id),
        totalAmount: decimal("total_amount", { precision: 15, scale: 2 })
            .notNull()
            .default("0"),
        paidAmount: decimal("paid_amount", { precision: 15, scale: 2 })
            .notNull()
            .default("0"),
        currency: varchar("currency", { length: 5 }).notNull().default("USD"),
        status: varchar("status", { length: 20 }).notNull().default("unpaid"),
        notes: text("notes"),
        createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => [
        index("idx_billing_status").on(table.status),
        index("idx_billing_date").on(table.createdAt),
    ]
);

// ─── Payments ───────────────────────────────────────────────────────

export const payments = pgTable("payments", {
    id: uuid("id").primaryKey().defaultRandom(),
    billingId: uuid("billing_id")
        .notNull()
        .references(() => billings.id, { onDelete: "cascade" }),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    method: varchar("method", { length: 30 }).default("cash"),
    paidAt: timestamp("paid_at").notNull().defaultNow(),
});

// ─── Patient Images ─────────────────────────────────────────────────

export const patientImages = pgTable("patient_images", {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
        .notNull()
        .references(() => patients.id, { onDelete: "cascade" }),
    visitId: uuid("visit_id").references(() => visits.id),
    filePath: varchar("file_path", { length: 1000 }).notNull(),
    legacyPath: varchar("legacy_path", { length: 1000 }),
    caption: text("caption"),
    capturedAt: timestamp("captured_at").notNull().defaultNow(),
});

// ─── Medical Terms (Autocomplete Knowledge Base) ────────────────────

export const medicalTerms = pgTable(
    "medical_terms",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        category: varchar("category", { length: 50 }).notNull(), // diagnosis, medication, lab_test, procedure, complaint
        term: varchar("term", { length: 500 }).notNull(),
        language: varchar("language", { length: 5 }).default("fr"),
        usageCount: integer("usage_count").notNull().default(1),
        isVerified: boolean("is_verified").notNull().default(false),
        firstUsed: timestamp("first_used").notNull().defaultNow(),
        lastUsed: timestamp("last_used").notNull().defaultNow(),
    },
    (table) => [
        index("idx_term_category").on(table.category),
        index("idx_term_search").on(table.category, table.term),
    ]
);

// ─── Appointments ───────────────────────────────────────────────────

export const appointments = pgTable(
    "appointments",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        patientId: uuid("patient_id")
            .notNull()
            .references(() => patients.id),
        doctorId: uuid("doctor_id").references(() => users.id),
        appointmentDate: varchar("appointment_date", { length: 10 }).notNull(), // YYYY-MM-DD
        timeSlot: varchar("time_slot", { length: 5 }).notNull(), // HH:MM
        duration: integer("duration").notNull().default(30), // minutes
        type: varchar("type", { length: 50 }).default("consultation"),
        status: varchar("status", { length: 20 }).notNull().default("scheduled"), // scheduled, confirmed, cancelled, completed
        notes: text("notes"),
        createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => [
        index("idx_appointment_date").on(table.appointmentDate),
        index("idx_appointment_patient").on(table.patientId),
        index("idx_appointment_doctor").on(table.doctorId, table.appointmentDate),
    ]
);

// ─── Settings ───────────────────────────────────────────────────────

export const settings = pgTable("settings", {
    id: uuid("id").primaryKey().defaultRandom(),
    key: varchar("key", { length: 100 }).notNull().unique(),
    value: text("value").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Follow-ups ─────────────────────────────────────────────────────

export const followUps = pgTable(
    "follow_ups",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        visitId: uuid("visit_id")
            .notNull()
            .references(() => visits.id, { onDelete: "cascade" }),
        patientId: uuid("patient_id")
            .notNull()
            .references(() => patients.id),
        scheduledDate: varchar("scheduled_date", { length: 10 }).notNull(),
        reason: text("reason"),
        status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, completed, missed
        notes: text("notes"),
        createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => [
        index("idx_followup_date").on(table.scheduledDate),
        index("idx_followup_patient").on(table.patientId),
    ]
);

// ─── Referrals ──────────────────────────────────────────────────────

export const referrals = pgTable("referrals", {
    id: uuid("id").primaryKey().defaultRandom(),
    visitId: uuid("visit_id")
        .notNull()
        .references(() => visits.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
        .notNull()
        .references(() => patients.id),
    referredTo: varchar("referred_to", { length: 300 }).notNull(),
    specialty: varchar("specialty", { length: 200 }),
    reason: text("reason"),
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, accepted, completed
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Audit Log ──────────────────────────────────────────────────────

export const auditLogs = pgTable(
    "audit_logs",
    {
        id: bigserial("id", { mode: "number" }).primaryKey(),
        userId: uuid("user_id").references(() => users.id),
        action: varchar("action", { length: 50 }).notNull(),
        entityType: varchar("entity_type", { length: 50 }).notNull(),
        entityId: uuid("entity_id"),
        oldValue: jsonb("old_value"),
        newValue: jsonb("new_value"),
        ipAddress: varchar("ip_address", { length: 45 }),
        createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => [
        index("idx_audit_entity").on(
            table.entityType,
            table.entityId,
            table.createdAt
        ),
        index("idx_audit_user").on(table.userId, table.createdAt),
    ]
);

// ─── Relations ──────────────────────────────────────────────────────

export const patientRelations = relations(patients, ({ many }) => ({
    visits: many(visits),
    images: many(patientImages),
    appointments: many(appointments),
    followUps: many(followUps),
    referrals: many(referrals),
}));

export const visitRelations = relations(visits, ({ one, many }) => ({
    patient: one(patients, {
        fields: [visits.patientId],
        references: [patients.id],
    }),
    doctor: one(users, {
        fields: [visits.doctorId],
        references: [users.id],
    }),
    diagnoses: many(diagnoses),
    prescriptions: many(prescriptions),
    labOrders: many(labOrders),
    procedures: many(procedureLogs),
    billing: one(billings),
    images: many(patientImages),
    followUps: many(followUps),
    referrals: many(referrals),
}));

export const appointmentRelations = relations(appointments, ({ one }) => ({
    patient: one(patients, {
        fields: [appointments.patientId],
        references: [patients.id],
    }),
    doctor: one(users, {
        fields: [appointments.doctorId],
        references: [users.id],
    }),
}));

export const followUpRelations = relations(followUps, ({ one }) => ({
    visit: one(visits, {
        fields: [followUps.visitId],
        references: [visits.id],
    }),
    patient: one(patients, {
        fields: [followUps.patientId],
        references: [patients.id],
    }),
}));

export const referralRelations = relations(referrals, ({ one }) => ({
    visit: one(visits, {
        fields: [referrals.visitId],
        references: [visits.id],
    }),
    patient: one(patients, {
        fields: [referrals.patientId],
        references: [patients.id],
    }),
}));

export const diagnosisRelations = relations(diagnoses, ({ one }) => ({
    visit: one(visits, {
        fields: [diagnoses.visitId],
        references: [visits.id],
    }),
}));

export const prescriptionRelations = relations(prescriptions, ({ one }) => ({
    visit: one(visits, {
        fields: [prescriptions.visitId],
        references: [visits.id],
    }),
}));

export const labOrderRelations = relations(labOrders, ({ one }) => ({
    visit: one(visits, {
        fields: [labOrders.visitId],
        references: [visits.id],
    }),
}));

export const procedureLogRelations = relations(procedureLogs, ({ one }) => ({
    visit: one(visits, {
        fields: [procedureLogs.visitId],
        references: [visits.id],
    }),
}));

export const billingRelations = relations(billings, ({ one, many }) => ({
    visit: one(visits, {
        fields: [billings.visitId],
        references: [visits.id],
    }),
    payments: many(payments),
}));

export const paymentRelations = relations(payments, ({ one }) => ({
    billing: one(billings, {
        fields: [payments.billingId],
        references: [billings.id],
    }),
}));

export const patientImageRelations = relations(patientImages, ({ one }) => ({
    patient: one(patients, {
        fields: [patientImages.patientId],
        references: [patients.id],
    }),
    visit: one(visits, {
        fields: [patientImages.visitId],
        references: [visits.id],
    }),
}));

// ─── Type Exports ───────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Patient = typeof patients.$inferSelect;
export type NewPatient = typeof patients.$inferInsert;
export type Visit = typeof visits.$inferSelect;
export type NewVisit = typeof visits.$inferInsert;
export type Diagnosis = typeof diagnoses.$inferSelect;
export type Prescription = typeof prescriptions.$inferSelect;
export type LabOrder = typeof labOrders.$inferSelect;
export type ProcedureLog = typeof procedureLogs.$inferSelect;
export type Billing = typeof billings.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type PatientImage = typeof patientImages.$inferSelect;
export type MedicalTerm = typeof medicalTerms.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type FollowUp = typeof followUps.$inferSelect;
export type Referral = typeof referrals.$inferSelect;
