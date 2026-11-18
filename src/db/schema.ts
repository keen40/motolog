import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { PartLine } from "../lib/types";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () => text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`);

// ---------------------------------------------------------------------------
// People. Users are created automatically the first time they open the app
// (identity comes from Tailscale / SSO headers).
// ---------------------------------------------------------------------------

export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(), // login name, e.g. name@example.com or name@github
  name: text("name"),
  avatarUrl: text("avatar_url"),
  createdAt: createdAt(),
});

export const meta = sqliteTable("meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// ---------------------------------------------------------------------------
// Reference catalogue (shared by everyone on the server)
// ---------------------------------------------------------------------------

export const vehicleModels = sqliteTable(
  "vehicle_models",
  {
    id: id(),
    vehicleType: text("vehicle_type").notNull().default("motorcycle"),
    category: text("category").notNull().default("mx"),
    make: text("make").notNull(),
    model: text("model").notNull(),
    yearFrom: integer("year_from").notNull(),
    yearTo: integer("year_to").notNull(),
    engineCc: integer("engine_cc"),
    stroke: integer("stroke"),
    summaryEn: text("summary_en"),
    summaryHu: text("summary_hu"),
    partsCatalogUrl: text("parts_catalog_url"),
    ownersManualUrl: text("owners_manual_url"),
    /** Factory suspension/carb setup: { source, values: { main_jet: "450", ... } } – see lib/tuning.ts. */
    stockSetup: text("stock_setup", { mode: "json" }).$type<{ source: string; values: Record<string, string> }>(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("vehicle_models_unique").on(t.make, t.model, t.yearFrom, t.yearTo)],
);

export const modelSpecs = sqliteTable(
  "model_specs",
  {
    id: id(),
    modelId: text("model_id").notNull().references(() => vehicleModels.id, { onDelete: "cascade" }),
    seedKey: text("seed_key"),
    specGroup: text("spec_group").notNull(),
    zone: text("zone"),
    labelEn: text("label_en").notNull(),
    labelHu: text("label_hu").notNull(),
    value: text("value").notNull(),
    source: text("source"),
    isSeed: integer("is_seed", { mode: "boolean" }).notNull().default(false),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("model_specs_model").on(t.modelId), uniqueIndex("model_specs_seed").on(t.modelId, t.seedKey)],
);

export const specVerifications = sqliteTable(
  "spec_verifications",
  {
    specId: text("spec_id").notNull().references(() => modelSpecs.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.specId, t.userId] })],
);

export const serviceIntervals = sqliteTable(
  "service_intervals",
  {
    id: id(),
    modelId: text("model_id").notNull().references(() => vehicleModels.id, { onDelete: "cascade" }),
    taskKey: text("task_key").notNull(),
    zone: text("zone").notNull(),
    labelEn: text("label_en").notNull(),
    labelHu: text("label_hu").notNull(),
    intervalHours: real("interval_hours"),
    intervalKm: real("interval_km"),
    intervalMonths: integer("interval_months"),
    notesEn: text("notes_en"),
    notesHu: text("notes_hu"),
  },
  (t) => [uniqueIndex("service_intervals_task").on(t.modelId, t.taskKey)],
);

export const fitmentParts = sqliteTable(
  "fitment_parts",
  {
    id: id(),
    modelId: text("model_id").notNull().references(() => vehicleModels.id, { onDelete: "cascade" }),
    seedKey: text("seed_key"),
    zone: text("zone").notNull(),
    category: text("category").notNull(),
    brand: text("brand").notNull(),
    name: text("name").notNull(),
    partNumber: text("part_number"),
    isOem: integer("is_oem", { mode: "boolean" }).notNull().default(false),
    searchQuery: text("search_query").notNull(),
    infoUrl: text("info_url"),
    notesEn: text("notes_en"),
    notesHu: text("notes_hu"),
    isSeed: integer("is_seed", { mode: "boolean" }).notNull().default(false),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("fitment_parts_model").on(t.modelId), uniqueIndex("fitment_parts_seed").on(t.modelId, t.seedKey)],
);

export const shops = sqliteTable("shops", {
  id: id(),
  name: text("name").notNull().unique(),
  country: text("country").notNull(),
  shipsTo: text("ships_to", { mode: "json" }).$type<string[]>().notNull(),
  language: text("language").notNull(),
  homepage: text("homepage").notNull(),
  searchUrlTemplate: text("search_url_template").notNull(), // {q} → URL-encoded query
  sortOrder: integer("sort_order").notNull().default(100),
});

// ---------------------------------------------------------------------------
// Garage
// ---------------------------------------------------------------------------

export const vehicles = sqliteTable(
  "vehicles",
  {
    id: id(),
    ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    modelId: text("model_id").references(() => vehicleModels.id, { onDelete: "set null" }),
    make: text("make").notNull(),
    model: text("model").notNull(),
    year: integer("year").notNull(),
    nickname: text("nickname"),
    vin: text("vin"),
    engineHours: real("engine_hours"),
    odometerKm: real("odometer_km"),
    purchaseDate: text("purchase_date"),
    notes: text("notes"),
    photoId: text("photo_id"),
    createdAt: createdAt(),
  },
  (t) => [index("vehicles_owner").on(t.ownerId)],
);

/** Sharing is by login email so you can share before the other person has opened the app. */
export const vehicleShares = sqliteTable(
  "vehicle_shares",
  {
    vehicleId: text("vehicle_id").notNull().references(() => vehicles.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role", { enum: ["viewer", "editor"] }).notNull().default("viewer"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.vehicleId, t.email] }), index("vehicle_shares_email").on(t.email)],
);

export const vehicleEvents = sqliteTable(
  "vehicle_events",
  {
    id: id(),
    vehicleId: text("vehicle_id").notNull().references(() => vehicles.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
    kind: text("kind", { enum: ["service", "mod", "repair", "plan"] }).notNull(),
    planStatus: text("plan_status", { enum: ["idea", "ordered", "done"] }),
    zone: text("zone").notNull().default("other"),
    taskKey: text("task_key"),
    title: text("title").notNull(),
    description: text("description"),
    eventDate: text("event_date"),
    engineHours: real("engine_hours"),
    odometerKm: real("odometer_km"),
    cost: real("cost"),
    currency: text("currency").notNull().default("HUF"),
    parts: text("parts", { mode: "json" }).$type<PartLine[]>().notNull().default(sql`'[]'`),
    createdAt: createdAt(),
  },
  (t) => [index("vehicle_events_vehicle").on(t.vehicleId, t.eventDate)],
);

/** Files live in DATA_DIR/photos/<filename>; access is checked through the vehicle. */
export const photos = sqliteTable(
  "photos",
  {
    id: id(),
    vehicleId: text("vehicle_id").notNull().references(() => vehicles.id, { onDelete: "cascade" }),
    eventId: text("event_id").references(() => vehicleEvents.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    mime: text("mime").notNull(),
    uploadedBy: text("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("photos_vehicle").on(t.vehicleId), index("photos_event").on(t.eventId)],
);

// ---------------------------------------------------------------------------
// Tuning sheets: a snapshot of carb / suspension / chassis settings plus the
// conditions they were used in. Setting keys are defined in lib/tuning.ts.
// ---------------------------------------------------------------------------

export const tuningSheets = sqliteTable(
  "tuning_sheets",
  {
    id: id(),
    vehicleId: text("vehicle_id").notNull().references(() => vehicles.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    sheetDate: text("sheet_date"),
    engineHours: real("engine_hours"),
    track: text("track"),
    surface: text("surface"),
    weather: text("weather"),
    tempC: real("temp_c"),
    altitudeM: real("altitude_m"),
    settings: text("settings", { mode: "json" }).$type<Record<string, string>>().notNull().default({}),
    rating: integer("rating"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: text("updated_at"),
  },
  (t) => [index("tuning_sheets_vehicle").on(t.vehicleId, t.sheetDate)],
);
