import { eq, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as s from "./schema";

/**
 * Reference data: shops that sell to Hungary + Yamaha YZ125 (2001).
 * Specs come from Yamaha's owner's service manual (page cited in each source); part numbers are
 * fitment listings from several retailers. Bump SEED_VERSION when you change this file: rows are
 * upserted by stable keys, values riders corrected are left alone, and rows removed here are deleted.
 */
export const SEED_VERSION = "3";

const SHOPS = [
  { name: "gmoto.hu", country: "HU", shipsTo: ["HU"], language: "hu", homepage: "https://gmoto.hu", searchUrlTemplate: "https://gmoto.hu/search?query={q}", sortOrder: 10 },
  { name: "gmoto.cz", country: "CZ", shipsTo: ["CZ", "SK", "HU"], language: "cs", homepage: "https://gmoto.cz", searchUrlTemplate: "https://gmoto.cz/search?query={q}", sortOrder: 20 },
  { name: "FC-Moto", country: "DE", shipsTo: ["DE", "AT", "HU", "CZ", "SK", "PL", "RO"], language: "hu", homepage: "https://www.fc-moto.com/hu-hu/", searchUrlTemplate: "https://www.fc-moto.com/hu-hu/search?search={q}", sortOrder: 30 },
  { name: "Motoshop.hu", country: "HU", shipsTo: ["HU"], language: "hu", homepage: "https://www.motoshop.hu", searchUrlTemplate: "https://www.motoshop.hu/shop_searchcomplex.php?search={q}", sortOrder: 40 },
  { name: "eBay", country: "EU", shipsTo: ["HU", "CZ", "SK", "DE", "AT"], language: "en", homepage: "https://www.ebay.de", searchUrlTemplate: "https://www.ebay.de/sch/i.html?_nkw={q}", sortOrder: 90 },
];

type SpecSeed = [key: string, group: string, zone: string, en: string, hu: string, value: string, source: string];
type IntervalSeed = {
  task: string;
  zone: string;
  en: string;
  hu: string;
  hours?: number;
  months?: number;
  notesEn: string;
  notesHu: string;
};
type PartSeed = {
  key: string;
  zone: string;
  category: string;
  brand: string;
  name: string;
  partNumber?: string;
  oem?: boolean;
  query: string;
  url?: string;
  notesEn?: string;
  notesHu?: string;
};

/** Yamaha YZ125N1 / YZ125LC (2001) owner's service manual, 1st edition June 2000 – covers EU (5MV2) and US (5MV1) bikes. */
const M = (page: string) => `Service manual p. ${page}`;
// Race-based manual intervals are converted at roughly 2 riding hours per race day.
const RACE_H = 2;

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
    summaryEn: "Liquid-cooled 125cc two-stroke motocross bike (model code 5MV2 in Europe) with YPVS power valve, Mikuni TMX 38 carb, 6-speed gearbox and 46 mm fork.",
    summaryHu: "125 köbcentis, folyadékhűtéses kétütemű motocross motor (európai típuskód: 5MV2) YPVS kipufogó-vezérléssel, Mikuni TMX 38 karburátorral, 6 sebességes váltóval és 46 mm-es villával.",
    partsCatalogUrl: "https://www.cmsnl.com/yamaha-yz125_model16889/",
    ownersManualUrl: "https://www.manualslib.com/manual/945223/Yamaha-Yz125n1.html?page=34",
  },
  specs: [
    ["engine_type", "engine", "engine", "Engine type", "Motor típusa", "Liquid-cooled 2-stroke single, forward inclined, reed valve, YPVS power valve", M("2-1")],
    ["displacement", "engine", "engine", "Displacement", "Hengerűrtartalom", "124 cm³", M("2-1")],
    ["bore_stroke", "engine", "engine", "Bore × stroke", "Furat × löket", "54 × 54.5 mm", M("2-1")],
    ["compression", "engine", "engine", "Compression ratio", "Kompresszióviszony", "8.7–10.8 : 1 (varies with YPVS)", M("2-1")],
    ["cylinder_bore", "engine", "engine", "Cylinder bore", "Hengerfurat", "54.000–54.014 mm (wear limit 54.1 mm)", M("2-3")],
    ["piston", "engine", "engine", "Piston size / clearance", "Dugattyú mérete / hézag", "53.957–53.972 mm, measured 17.5 mm from the skirt bottom; clearance 0.040–0.045 mm (limit 0.1 mm)", M("2-3")],
    ["ring_gap", "engine", "engine", "Piston ring end gap", "Gyűrűhézag", "0.5–0.7 mm installed (limit 1.2 mm)", M("2-3")],
    ["clutch_plates", "drivetrain", "engine", "Clutch plates", "Kuplungtárcsák", "8 friction plates 2.9–3.1 mm (limit 2.8 mm); 5 springs 40.1 mm free length (limit 38.1 mm)", M("2-3")],
    ["gearbox", "drivetrain", "drivetrain", "Gearbox", "Váltó", "Constant mesh 6-speed, wet multi-plate clutch, kick start", M("2-2")],
    ["fuel", "fuel", "fuel", "Fuel", "Üzemanyag", "Premium unleaded, RON 95 or higher, premixed", M("2-1")],
    ["premix", "fuel", "fuel", "Premix ratio", "Keverési arány", "30:1 (Yamalube 2-R)", M("2-1")],
    ["tank", "fuel", "fuel", "Fuel tank capacity", "Tank térfogata", "8.0 L", M("2-1")],
    ["carb", "fuel", "intake", "Carburettor", "Karburátor", "Mikuni TMX 38SS (ID mark 5MV2 10 in Europe, 5MV1 00 in the USA)", M("2-2, 2-4")],
    ["jetting_eu", "fuel", "intake", "Stock jetting (Europe)", "Gyári fúvókázás (Európa)", "Main #450 · needle 6BHY1-75, clip 3 · pilot #30 · air screw 1½ turns out · cutaway 5.75 · starter jet #80 · fuel level 13.5–14.5 mm", M("2-4")],
    ["jetting_us", "fuel", "intake", "Stock jetting (USA/CDN)", "Gyári fúvókázás (USA/CDN)", "Main #460 · needle 6BGK9-75, clip 3 · pilot #25 · air screw 1¼ turns out · cutaway 5.75", M("2-4")],
    ["reeds", "fuel", "intake", "Reed valve", "Membránszelep", "Reed thickness 0.42 mm, stopper height 8.2–8.6 mm (bend limit 0.2 mm)", M("2-4")],
    ["plug", "ignition", "electrical", "Spark plug", "Gyertya", "NGK BR9EG", M("2-2")],
    ["plug_gap", "ignition", "electrical", "Spark plug gap", "Elektródatávolság", "0.5–0.6 mm", M("2-2")],
    ["ignition", "ignition", "electrical", "Ignition", "Gyújtás", "CDI magneto", M("2-2")],
    ["trans_oil", "fluids", "engine", "Transmission oil", "Váltóolaj", "Yamalube 4 (10W-30) or SAE 10W-30 SE motor oil – 0.65 L at an oil change, 0.70 L after a rebuild", M("2-1")],
    ["coolant", "fluids", "engine", "Coolant capacity", "Hűtőfolyadék mennyisége", "1.00 L incl. all hoses (radiators 0.63 L); cap opens at 95–125 kPa", M("2-1, 2-4")],
    ["air_filter_oil", "fluids", "intake", "Air filter oil", "Légszűrőolaj", "Foam air-filter oil (or engine mixing oil)", M("2-4")],
    ["chain", "drivetrain", "drivetrain", "Drive chain", "Lánc", "DID 520DMA2 SDH, 111 links + joint", M("2-8")],
    ["gearing", "drivetrain", "drivetrain", "Stock gearing", "Gyári áttétel", "13T front / 48T rear (3.692)", M("2-2")],
    ["chain_slack", "drivetrain", "drivetrain", "Chain slack", "Lánc belógása", "40–50 mm", M("2-8")],
    ["chain_wear", "drivetrain", "drivetrain", "Chain wear limit", "Lánc kopási határ", "10 links (pin to pin): max 152.5 mm", M("2-8")],
    ["tyre_f", "wheels", "wheels", "Front tyre / rim", "Első gumi / felni", "80/100-21 51M, tube type · rim 21 × 1.60", M("2-2, 2-8")],
    ["tyre_r", "wheels", "wheels", "Rear tyre / rim", "Hátsó gumi / felni", "100/90-19 57M, tube type · rim 19 × 1.85", M("2-2, 2-8")],
    ["tyre_pressure", "wheels", "wheels", "Tyre pressure", "Guminyomás", "100 kPa (1.0 bar, 15 psi) front & rear", M("2-2")],
    ["fork", "suspension", "suspension_front", "Front fork", "Első villa", "Telescopic, 46 mm tubes, 300 mm travel, spring 4.10 N/mm", M("2-2, 2-7")],
    ["fork_oil", "suspension", "suspension_front", "Fork oil", "Villaolaj", "Yamaha Suspension Oil “01”, 573 cm³; level 135 mm (80–150 mm) from the top of the outer tube, fully compressed, no spring", M("2-7")],
    ["shock", "suspension", "suspension_rear", "Rear shock", "Hátsó rugóstag", "Link-type Monocross, 315 mm wheel travel; spring ≈ 48.0 N/mm (Europe), 46.0 N/mm (USA); gas 1,000 kPa", M("2-2, 2-7")],
    ["brakes", "brakes", "brakes", "Brakes", "Fékek", "Single disc front 250 × 3.0 mm, rear 240 × 4.0 mm", M("2-8")],
    ["brake_pads", "brakes", "brakes", "Brake pad thickness", "Fékbetét vastagság", "New: front 4.4 mm, rear 6.4 mm – replace at 1.0 mm", M("2-8")],
    ["brake_fluid", "brakes", "brakes", "Brake fluid", "Fékfolyadék", "DOT 4", M("2-8")],
    ["axle_torque", "chassis", "wheels", "Axle & sprocket torque", "Tengely- és lánckerék-nyomaték", "Front axle nut 105 Nm · rear axle nut 125 Nm · rear sprocket bolts 42 Nm", M("2-9, 2-10")],
    ["weight", "dimensions", "frame", "Weight", "Tömeg", "95.0 kg with oil and a full tank", M("2-1")],
    ["dimensions", "dimensions", "frame", "Seat height / wheelbase", "Ülésmagasság / tengelytáv", "994 mm / 1,444 mm (Europe); ground clearance 400 mm", M("2-1")],
  ] as SpecSeed[],
  intervals: [
    { task: "air_filter", zone: "intake", en: "Clean & oil air filter", hu: "Légszűrő tisztítás, olajozás", hours: 1 * RACE_H, notesEn: "Manual: after every race. Foam air-filter oil.", notesHu: "Kézikönyv: minden verseny után. Habszivacs-szűrőolaj." },
    { task: "chain", zone: "drivetrain", en: "Lube, adjust & check chain", hu: "Lánc kenés, feszítés, ellenőrzés", hours: 1 * RACE_H, notesEn: "Manual: every race. Slack 40–50 mm.", notesHu: "Kézikönyv: minden verseny. Belógás 40–50 mm." },
    { task: "spark_plug", zone: "electrical", en: "Inspect & clean spark plug", hu: "Gyertya ellenőrzés, tisztítás", hours: 1 * RACE_H, notesEn: "Manual: every race; replace as required (NGK BR9EG, gap 0.5–0.6 mm).", notesHu: "Kézikönyv: minden verseny; csere szükség szerint (NGK BR9EG, 0,5–0,6 mm)." },
    { task: "piston_rings", zone: "engine", en: "Replace piston rings", hu: "Dugattyúgyűrű csere", hours: 3 * RACE_H, notesEn: "Manual: every 3rd race (≈ 2 h per race).", notesHu: "Kézikönyv: minden 3. verseny (≈ 2 óra/verseny)." },
    { task: "shock_service", zone: "suspension_rear", en: "Grease rear shock", hu: "Hátsó rugóstag zsírozás", hours: 3 * RACE_H, notesEn: "Manual: every 3rd race, molybdenum disulfide grease; inspect every race.", notesHu: "Kézikönyv: minden 3. verseny, molibdén-diszulfidos zsír; ellenőrzés minden verseny." },
    { task: "wheel_bearings", zone: "wheels", en: "Inspect wheel bearings", hu: "Kerékcsapágyak ellenőrzése", hours: 3 * RACE_H, notesEn: "Manual: every 3rd race.", notesHu: "Kézikönyv: minden 3. verseny." },
    { task: "top_end", zone: "engine", en: "Replace piston (top-end)", hu: "Dugattyú csere (felsőrész)", hours: 5 * RACE_H, notesEn: "Manual: every 5th race (≈ 2 h per race); trail riding can stretch this.", notesHu: "Kézikönyv: minden 5. verseny (≈ 2 óra/verseny); túrázásnál hosszabb lehet." },
    { task: "transmission_oil", zone: "engine", en: "Change transmission oil", hu: "Váltóolaj csere", hours: 5 * RACE_H, notesEn: "Manual: every 5th race and after break-in. 0.65 L SAE 10W-30.", notesHu: "Kézikönyv: minden 5. verseny és bejáratás után. 0,65 l SAE 10W-30." },
    { task: "silencer", zone: "exhaust", en: "Clean silencer", hu: "Kipufogódob tisztítás", hours: 5 * RACE_H, notesEn: "Manual: every 5th race.", notesHu: "Kézikönyv: minden 5. verseny." },
    { task: "fork_oil", zone: "suspension_front", en: "Change fork oil", hu: "Villaolaj csere", hours: 5 * RACE_H, notesEn: "Manual: every 5th race. Suspension oil “01”; seals as required.", notesHu: "Kézikönyv: minden 5. verseny. „01” villaolaj; szimering szükség szerint." },
    { task: "steering_head", zone: "frame", en: "Clean & grease steering head", hu: "Kormánycsapágy tisztítás, zsírozás", hours: 5 * RACE_H, notesEn: "Manual: every 5th race, lithium grease.", notesHu: "Kézikönyv: minden 5. verseny, lítiumos zsír." },
    { task: "brake_fluid", zone: "brakes", en: "Replace brake fluid", hu: "Fékfolyadék csere", months: 12, notesEn: "Manual: every year. DOT 4.", notesHu: "Kézikönyv: évente. DOT 4." },
    { task: "coolant", zone: "engine", en: "Replace coolant", hu: "Hűtőfolyadék csere", months: 24, notesEn: "Manual: every two years. 1.0 L.", notesHu: "Kézikönyv: kétévente. 1,0 l." },
  ] as IntervalSeed[],
  parts: [
    { key: "fmf_pipe", zone: "exhaust", category: "Expansion chamber", brand: "FMF", name: "Fatty pipe", partNumber: "024041", query: "FMF Fatty YZ125 024041", url: "https://www.fmfracing.com", notesEn: "Listed for YZ125 2000–2004.", notesHu: "YZ125 2000–2004-hez listázva." },
    { key: "pc_pipe", zone: "exhaust", category: "Expansion chamber", brand: "Pro Circuit", name: "Platinum pipe", query: "Pro Circuit YZ125 2001 pipe", url: "https://www.procircuit.com", notesEn: "Pick the 2000–2004 version.", notesHu: "A 2000–2004-es változatot válaszd." },
    { key: "fmf_silencer", zone: "exhaust", category: "Silencer", brand: "FMF", name: "Shorty / TurbineCore silencer", query: "FMF YZ125 2001 silencer", url: "https://www.fmfracing.com", notesEn: "Pick the 2000–2004 version.", notesHu: "A 2000–2004-es változatot válaszd." },
    { key: "did_chain", zone: "drivetrain", category: "Chain", brand: "D.I.D", name: "520DMA2 chain", partNumber: "520DMA2", oem: true, query: "DID 520DMA2", url: "https://www.didchain.com", notesEn: "Stock chain: 111 links + joint. Count yours before ordering.", notesHu: "Gyári lánc: 111 szem + patent. Rendelés előtt számold meg." },
    { key: "jt_sprockets", zone: "drivetrain", category: "Sprockets", brand: "JT Sprockets", name: "Front sprocket 13T, 520", partNumber: "JTF564.13", query: "JTF564 13", url: "https://www.jtsprockets.com", notesEn: "Listed for YZ125 1987–2004.", notesHu: "YZ125 1987–2004-hez listázva." },
    { key: "jt_rear", zone: "drivetrain", category: "Sprockets", brand: "JT Sprockets", name: "Rear sprocket 48T, 520", partNumber: "JTR251.48", query: "JTR251 48", url: "https://www.jtsprockets.com", notesEn: "Fits Yamaha YZ from 1999 on; stock size is 48T.", notesHu: "1999-től Yamaha YZ-re; gyári méret 48T." },
    { key: "supersprox", zone: "drivetrain", category: "Sprockets", brand: "Supersprox", name: "Stealth rear sprocket (JTR251 size)", query: "Supersprox Stealth Yamaha YZ125 48", url: "https://www.supersprox.com" },
    { key: "ngk_plug", zone: "electrical", category: "Spark plug", brand: "NGK", name: "BR9EG", partNumber: "BR9EG", oem: true, query: "NGK BR9EG", url: "https://www.ngk.de", notesEn: "Gap 0.5–0.6 mm.", notesHu: "Elektródatávolság 0,5–0,6 mm." },
    { key: "polisport", zone: "plastics", category: "Plastic kit", brand: "Polisport", name: "OEM-style plastic kit 2000–2001", partNumber: "90108", query: "Polisport 90108 YZ125", url: "https://www.polisport.com", notesEn: "Fits 2000–2001. Polisport's restyle kits are mostly listed for 2002+, so check fitment before buying one for a 2001.", notesHu: "2000–2001-hez. A Polisport restyle kitek többnyire 2002+ évjáratra vannak listázva, 2001-re vásárlás előtt ellenőrizd." },
    { key: "ufo", zone: "plastics", category: "Plastic kit", brand: "UFO Plast", name: "Plastic kit 2000–2001", query: "UFO plast YZ125 2000 2001", url: "https://www.ufoplast.com" },
    { key: "graphics", zone: "plastics", category: "Graphics", brand: "Various", name: "Decal / graphics kit", query: "YZ125 2000 2001 graphics kit", notesEn: "Match it to your plastics: 2000–2001 shape or the restyle kit you fitted.", notesHu: "A műanyagodhoz illeszd: 2000–2001-es forma vagy a felszerelt restyle kit." },
    { key: "wiseco", zone: "engine", category: "Piston kit", brand: "Wiseco", name: "Pro-Lite top-end kit 54.00 mm", partNumber: "PK1348", query: "Wiseco PK1348", url: "https://www.wiseco.com", notesEn: "Standard bore is 54.000–54.014 mm – measure the cylinder before ordering.", notesHu: "Gyári furat 54,000–54,014 mm – rendelés előtt mérd meg a hengert." },
    { key: "vertex", zone: "engine", category: "Piston kit", brand: "Vertex", name: "Cast piston kit", query: "Vertex piston YZ125 2001", url: "https://www.vertexpistons.com", notesEn: "Vertex kits come in size grades (A/B/C) – match your cylinder.", notesHu: "A Vertex dugattyúk méretosztályosak (A/B/C) – a hengerhez illeszd." },
    { key: "athena", zone: "engine", category: "Gasket kit", brand: "Athena", name: "Top-end gasket kit", query: "Athena top end gasket YZ125 2001", url: "https://www.athena.eu" },
    { key: "boyesen", zone: "intake", category: "Reed valve", brand: "Boyesen", name: "Power reeds / RAD valve", query: "Boyesen YZ125 2001 reed", url: "https://www.boyesen.com" },
    { key: "twinair", zone: "intake", category: "Air filter", brand: "Twin Air", name: "Air filter", partNumber: "152213", query: "Twin Air 152213", url: "https://www.twinair.com", notesEn: "Listed for YZ125 1997 on.", notesHu: "YZ125 1997-től listázva." },
    { key: "ebc", zone: "brakes", category: "Brake pads", brand: "EBC", name: "Front brake pads", partNumber: "FA185", query: "EBC FA185", url: "https://www.ebcbrakes.com", notesEn: "Listed for YZ125 1998–2007. R = sintered, X = carbon.", notesHu: "YZ125 1998–2007-hez listázva. R = szinterezett, X = karbon." },
    { key: "ebc_rear", zone: "brakes", category: "Brake pads", brand: "EBC", name: "Rear brake pads", partNumber: "FA131", query: "EBC FA131", url: "https://www.ebcbrakes.com", notesEn: "Listed for YZ125 1998–2002.", notesHu: "YZ125 1998–2002-höz listázva." },
    { key: "renthal", zone: "controls", category: "Handlebar", brand: "Renthal", name: "Fatbar / Twinwall handlebar", query: "Renthal fatbar", url: "https://www.renthal.com", notesEn: "Stock bars are 7/8\" (22 mm); a Fatbar needs oversize (28.6 mm) clamps.", notesHu: "A gyári kormány 22 mm-es; a Fatbarhoz 28,6 mm-es bilincs kell." },
    { key: "tyres", zone: "wheels", category: "Tyres", brand: "Michelin / Dunlop", name: "MX tyres 80/100-21 & 100/90-19", query: "80/100-21 motocross", notesEn: "Tube type. 100 kPa (1.0 bar) is the manual's starting pressure.", notesHu: "Belsős. A kézikönyv szerinti kiinduló nyomás 100 kPa (1,0 bar)." },
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

    // Specs: never overwrite a value a rider corrected (is_seed = false). If a seed value changes,
    // earlier confirmations were for the old value, so they are cleared.
    const existing = tx.select().from(s.modelSpecs).where(eq(s.modelSpecs.modelId, model.id)).all();
    for (const [seedKey, specGroup, zone, labelEn, labelHu, value, source] of m.specs) {
      const old = existing.find((x) => x.seedKey === seedKey);
      if (old && !old.isSeed) continue;
      const row = { modelId: model.id, seedKey, specGroup, zone, labelEn, labelHu, value, source, isSeed: true };
      tx.insert(s.modelSpecs).values(row).onConflictDoUpdate({ target: [s.modelSpecs.modelId, s.modelSpecs.seedKey], set: row }).run();
      if (old && old.value !== value) tx.delete(s.specVerifications).where(eq(s.specVerifications.specId, old.id)).run();
    }
    const specKeys = m.specs.map(([k]) => k);
    for (const old of existing) {
      if (old.isSeed && old.seedKey && !specKeys.includes(old.seedKey)) tx.delete(s.modelSpecs).where(eq(s.modelSpecs.id, old.id)).run();
    }

    for (const i of m.intervals) {
      const row = {
        modelId: model.id,
        taskKey: i.task,
        zone: i.zone,
        labelEn: i.en,
        labelHu: i.hu,
        intervalHours: i.hours ?? null,
        intervalMonths: i.months ?? null,
        notesEn: i.notesEn,
        notesHu: i.notesHu,
      };
      tx.insert(s.serviceIntervals).values(row).onConflictDoUpdate({ target: [s.serviceIntervals.modelId, s.serviceIntervals.taskKey], set: row }).run();
    }
    const taskKeys = m.intervals.map((i) => i.task);
    for (const old of tx.select().from(s.serviceIntervals).where(eq(s.serviceIntervals.modelId, model.id)).all()) {
      if (!taskKeys.includes(old.taskKey)) tx.delete(s.serviceIntervals).where(eq(s.serviceIntervals.id, old.id)).run();
    }

    for (const p of m.parts) {
      const row = {
        modelId: model.id,
        seedKey: p.key,
        zone: p.zone,
        category: p.category,
        brand: p.brand,
        name: p.name,
        partNumber: p.partNumber ?? null,
        isOem: p.oem ?? false,
        searchQuery: p.query,
        infoUrl: p.url ?? null,
        notesEn: p.notesEn ?? null,
        notesHu: p.notesHu ?? null,
        isSeed: true,
      };
      tx.insert(s.fitmentParts).values(row).onConflictDoUpdate({ target: [s.fitmentParts.modelId, s.fitmentParts.seedKey], set: row }).run();
    }
    const partKeys = m.parts.map((p) => p.key);
    for (const old of tx.select().from(s.fitmentParts).where(eq(s.fitmentParts.modelId, model.id)).all()) {
      if (old.isSeed && old.seedKey && !partKeys.includes(old.seedKey)) tx.delete(s.fitmentParts).where(eq(s.fitmentParts.id, old.id)).run();
    }

    tx.insert(s.meta)
      .values({ key: "seed_version", value: SEED_VERSION })
      .onConflictDoUpdate({ target: s.meta.key, set: { value: sql`excluded.value` } })
      .run();
  });
}
