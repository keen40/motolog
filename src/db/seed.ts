import { eq, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as s from "./schema";

/**
 * Reference data: shops that sell to Hungary + Yamaha YZ125 (2001).
 * Seeded specs are flagged is_seed and shown as "unverified" until riders confirm them against their manual.
 * Bump SEED_VERSION when you change this file; rows are upserted by stable keys, so user data and
 * confirmations survive re-seeding.
 */
export const SEED_VERSION = "1";

const SHOPS = [
  { name: "gmoto.hu", country: "HU", shipsTo: ["HU"], language: "hu", homepage: "https://gmoto.hu", searchUrlTemplate: "https://gmoto.hu/search?query={q}", sortOrder: 10 },
  { name: "gmoto.cz", country: "CZ", shipsTo: ["CZ", "SK", "HU"], language: "cs", homepage: "https://gmoto.cz", searchUrlTemplate: "https://gmoto.cz/search?query={q}", sortOrder: 20 },
  { name: "FC-Moto", country: "DE", shipsTo: ["DE", "AT", "HU", "CZ", "SK", "PL", "RO"], language: "hu", homepage: "https://www.fc-moto.com/hu-hu/", searchUrlTemplate: "https://www.fc-moto.com/hu-hu/search?search={q}", sortOrder: 30 },
  { name: "Motoshop.hu", country: "HU", shipsTo: ["HU"], language: "hu", homepage: "https://www.motoshop.hu", searchUrlTemplate: "https://www.motoshop.hu/shop_searchcomplex.php?search={q}", sortOrder: 40 },
  { name: "eBay", country: "EU", shipsTo: ["HU", "CZ", "SK", "DE", "AT"], language: "en", homepage: "https://www.ebay.de", searchUrlTemplate: "https://www.ebay.de/sch/i.html?_nkw={q}", sortOrder: 90 },
];

type SpecSeed = [key: string, group: string, zone: string, en: string, hu: string, value: string, source?: string];
type IntervalSeed = [task: string, zone: string, en: string, hu: string, hours: number, notesEn?: string, notesHu?: string];
type PartSeed = [key: string, zone: string, category: string, brand: string, name: string, query: string, url?: string, notesEn?: string, notesHu?: string];

const YZ125_2001 = {
  model: {
    vehicleType: "motorcycle",
    category: "mx",
    make: "Yamaha",
    model: "YZ125",
    yearFrom: 2001,
    yearTo: 2001,
    engineCc: 125,
    stroke: 2,
    summaryEn: "Liquid-cooled 125cc two-stroke motocross bike with YPVS power valve, 6-speed gearbox and Kayaba suspension.",
    summaryHu: "125 köbcentis, folyadékhűtéses kétütemű motocross motor YPVS kipufogó-vezérléssel, 6 sebességes váltóval és Kayaba futóművel.",
    partsCatalogUrl: "https://www.cmsnl.com/yamaha-yz125_model16889/",
    ownersManualUrl: "https://www.yamaha-motor.eu/gb/en/service-support/owner-manuals/",
  },
  specs: [
    ["engine_type", "engine", "engine", "Engine type", "Motor típusa", "Liquid-cooled 2-stroke single, reed valve, YPVS power valve"],
    ["displacement", "engine", "engine", "Displacement", "Hengerűrtartalom", "124.9 cm³"],
    ["bore_stroke", "engine", "engine", "Bore × stroke", "Furat × löket", "54.0 × 54.5 mm"],
    ["gearbox", "drivetrain", "drivetrain", "Gearbox", "Váltó", "6-speed, wet multi-plate clutch"],
    ["fuel", "fuel", "fuel", "Fuel", "Üzemanyag", "Premium unleaded (95+) premixed with 2-stroke oil"],
    ["premix", "fuel", "fuel", "Premix ratio", "Keverési arány", "30:1 (Yamalube 2R or equivalent racing 2T oil)"],
    ["tank", "fuel", "fuel", "Fuel tank capacity", "Tank térfogata", "≈ 8.0 L"],
    ["carb", "fuel", "intake", "Carburettor", "Karburátor", "38 mm flat-slide (check model year: Mikuni TMX38 / Keihin PWK38)", "Seed data – check"],
    ["plug", "ignition", "electrical", "Spark plug", "Gyertya", "NGK BR9EG"],
    ["plug_gap", "ignition", "electrical", "Spark plug gap", "Elektródatávolság", "0.7–0.8 mm"],
    ["trans_oil", "fluids", "engine", "Transmission oil", "Váltóolaj", "SAE 10W-30 4T / gear oil, ≈ 0.7 L at oil change"],
    ["coolant", "fluids", "engine", "Coolant", "Hűtőfolyadék", "Ethylene-glycol coolant 50/50 with distilled water, ≈ 1.0 L"],
    ["chain", "drivetrain", "drivetrain", "Chain size", "Lánc mérete", "520"],
    ["gearing", "drivetrain", "drivetrain", "Stock gearing", "Gyári áttétel", "13T front / 48–51T rear (check model year)", "Seed data – check"],
    ["chain_slack", "drivetrain", "drivetrain", "Chain slack", "Lánc belógása", "≈ 40–50 mm (check swingarm label)", "Seed data – check"],
    ["tyre_f", "wheels", "wheels", "Front tyre", "Első gumi", "80/100-21"],
    ["tyre_r", "wheels", "wheels", "Rear tyre", "Hátsó gumi", "100/90-19"],
    ["tyre_pressure", "wheels", "wheels", "Tyre pressure (MX)", "Guminyomás (MX)", "≈ 1.0 bar (100 kPa) front & rear"],
    ["fork", "suspension", "suspension_front", "Front fork", "Első villa", "Kayaba upside-down, adjustable compression & rebound"],
    ["shock", "suspension", "suspension_rear", "Rear shock", "Hátsó rugóstag", "Kayaba monoshock, link type, fully adjustable"],
    ["brakes", "brakes", "brakes", "Brakes", "Fékek", "Hydraulic single disc front & rear"],
    ["brake_fluid", "brakes", "brakes", "Brake fluid", "Fékfolyadék", "DOT 4"],
  ] as SpecSeed[],
  intervals: [
    ["air_filter", "intake", "Clean & oil air filter", "Légszűrő tisztítás, olajozás", 2, "After every ride in dusty conditions.", "Poros körülmények után minden menet után."],
    ["transmission_oil", "engine", "Change transmission oil", "Váltóolaj csere", 8, "Typical racing interval – check your manual.", "Tipikus versenyintervallum – ellenőrizd a kézikönyvben."],
    ["spark_plug", "electrical", "Inspect / replace spark plug", "Gyertya ellenőrzés / csere", 10],
    ["chain", "drivetrain", "Clean, lube & adjust chain", "Lánc tisztítás, kenés, feszítés", 3],
    ["top_end", "engine", "Top-end rebuild (piston & rings)", "Felsőrész felújítás (dugattyú, gyűrűk)", 20, "Racing use: 10–20 h. Trail riding: longer.", "Versenyhasználat: 10–20 óra. Túrázás: hosszabb."],
    ["fork_oil", "suspension_front", "Fork oil & seals service", "Villaolaj és szimering szerviz", 30],
    ["shock_service", "suspension_rear", "Rear shock service", "Hátsó rugóstag szerviz", 40],
    ["coolant", "engine", "Replace coolant", "Hűtőfolyadék csere", 50, "Or once per year.", "Vagy évente."],
    ["brake_fluid", "brakes", "Replace brake fluid", "Fékfolyadék csere", 50, "Or once per year.", "Vagy évente."],
    ["reeds", "intake", "Inspect reed valves", "Membránszelep ellenőrzés", 20],
  ] as IntervalSeed[],
  parts: [
    ["fmf_pipe", "exhaust", "Expansion chamber", "FMF", "Fatty / Gnarly pipe", "FMF YZ125 pipe", "https://www.fmfracing.com", "Check year range on FMF fitment finder.", "Ellenőrizd az évjáratot az FMF oldalán."],
    ["pc_pipe", "exhaust", "Expansion chamber", "Pro Circuit", "Platinum pipe", "Pro Circuit YZ125 pipe", "https://www.procircuit.com"],
    ["fmf_silencer", "exhaust", "Silencer", "FMF", "Shorty / TurbineCore silencer", "FMF YZ125 silencer", "https://www.fmfracing.com"],
    ["did_chain", "drivetrain", "Chain", "D.I.D", "520 DMA2 / ERT3 chain", "DID 520 chain", "https://www.didchain.com", "Count links / measure before ordering.", "Rendelés előtt számold meg a szemeket."],
    ["jt_sprockets", "drivetrain", "Sprockets", "JT Sprockets", "Front & rear sprocket 520", "JT sprocket YZ125", "https://www.jtsprockets.com"],
    ["supersprox", "drivetrain", "Sprockets", "Supersprox", "Stealth rear sprocket", "Supersprox YZ125", "https://www.supersprox.com"],
    ["ngk_plug", "electrical", "Spark plug", "NGK", "BR9EG", "NGK BR9EG", "https://www.ngk.de"],
    ["polisport", "plastics", "Plastic kit", "Polisport", "Restyle / OEM-style plastic kit", "Polisport YZ125 plastic kit", "https://www.polisport.com", "Restyle kits fit older frames with a newer look.", "A restyle kit régi vázra modern kinézetet ad."],
    ["ufo", "plastics", "Plastic kit", "UFO Plast", "Plastic kit", "UFO plast YZ125", "https://www.ufoplast.com"],
    ["graphics", "plastics", "Graphics", "Various", "Decal / graphics kit", "YZ125 2001 graphics kit", undefined, "Make sure the kit matches your plastic shape (OEM vs restyle).", "Ügyelj rá, hogy a matrica a műanyagodhoz illjen (gyári vagy restyle)."],
    ["wiseco", "engine", "Piston kit", "Wiseco", "Piston kit 54 mm", "Wiseco piston YZ125", "https://www.wiseco.com", "Measure bore – oversize may apply after rebuilds.", "Mérd meg a furatot – felújítás után túlméret lehet."],
    ["vertex", "engine", "Piston kit", "Vertex", "Cast piston kit", "Vertex piston YZ125", "https://www.vertexpistons.com"],
    ["athena", "engine", "Gasket kit", "Athena", "Top-end gasket kit", "Athena top end gasket YZ125", "https://www.athena.eu"],
    ["boyesen", "intake", "Reed valve", "Boyesen", "Reed cage / Power reeds", "Boyesen YZ125 reed", "https://www.boyesen.com"],
    ["twinair", "intake", "Air filter", "Twin Air", "Air filter", "Twin Air YZ125 filter", "https://www.twinair.com"],
    ["ebc", "brakes", "Brake pads", "EBC", "MXS / R-series brake pads", "EBC brake pads YZ125", "https://www.ebcbrakes.com"],
    ["renthal", "controls", "Handlebar", "Renthal", "Fatbar / Twinwall handlebar", "Renthal fatbar", "https://www.renthal.com", "Needs oversize clamps if switching from 22 mm bars.", "22 mm-es kormányról váltva oversize bilincs kell."],
    ["tyres", "wheels", "Tyres", "Michelin / Dunlop", "MX tyre 80/100-21 & 100/90-19", "80/100-21 motocross"],
  ] as PartSeed[],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function seed(db: BetterSQLite3Database<any>) {
  const current = db.select().from(s.meta).where(eq(s.meta.key, "seed_version")).get();
  if (current?.value === SEED_VERSION) return;

  db.transaction((tx) => {
    for (const shop of SHOPS) {
      tx.insert(s.shops).values(shop).onConflictDoUpdate({ target: s.shops.name, set: shop }).run();
    }

    const m = YZ125_2001;
    const model = tx
      .insert(s.vehicleModels)
      .values(m.model)
      .onConflictDoUpdate({ target: [s.vehicleModels.make, s.vehicleModels.model, s.vehicleModels.yearFrom, s.vehicleModels.yearTo], set: m.model })
      .returning({ id: s.vehicleModels.id })
      .get();

    for (const [seedKey, specGroup, zone, labelEn, labelHu, value, source] of m.specs) {
      const row = { modelId: model.id, seedKey, specGroup, zone, labelEn, labelHu, value, source: source ?? "Seed data – verify", isSeed: true };
      tx.insert(s.modelSpecs).values(row).onConflictDoUpdate({ target: [s.modelSpecs.modelId, s.modelSpecs.seedKey], set: row }).run();
    }
    for (const [taskKey, zone, labelEn, labelHu, intervalHours, notesEn, notesHu] of m.intervals) {
      const row = { modelId: model.id, taskKey, zone, labelEn, labelHu, intervalHours, notesEn: notesEn ?? null, notesHu: notesHu ?? null };
      tx.insert(s.serviceIntervals).values(row).onConflictDoUpdate({ target: [s.serviceIntervals.modelId, s.serviceIntervals.taskKey], set: row }).run();
    }
    for (const [seedKey, zone, category, brand, name, searchQuery, infoUrl, notesEn, notesHu] of m.parts) {
      const row = { modelId: model.id, seedKey, zone, category, brand, name, searchQuery, infoUrl: infoUrl ?? null, notesEn: notesEn ?? null, notesHu: notesHu ?? null, isSeed: true };
      tx.insert(s.fitmentParts).values(row).onConflictDoUpdate({ target: [s.fitmentParts.modelId, s.fitmentParts.seedKey], set: row }).run();
    }

    tx.insert(s.meta)
      .values({ key: "seed_version", value: SEED_VERSION })
      .onConflictDoUpdate({ target: s.meta.key, set: { value: sql`excluded.value` } })
      .run();
  });
}
