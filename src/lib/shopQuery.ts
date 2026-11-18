/**
 * Shop searches in the shop's own language. Hungarian shops (gmoto.hu, Motoshop) match their own
 * product names, so "Athena tömítés" finds gaskets where "Athena top end gasket" finds variator
 * rollers. We build: brand + the part type in the shop's language + part number + model.
 */

type Lang = "hu" | "cs" | "de" | "en";

/** Part types we know, by English keyword(s) → word used in shop product names. */
const TERMS: { match: RegExp; hu: string; cs: string; de: string }[] = [
  { match: /air ?filter/, hu: "légszűrő", cs: "vzduchový filtr", de: "Luftfilter" },
  { match: /oil filter/, hu: "olajszűrő", cs: "olejový filtr", de: "Ölfilter" },
  { match: /brake pad/, hu: "fékbetét", cs: "brzdové destičky", de: "Bremsbeläge" },
  { match: /brake disc|brake rotor/, hu: "féktárcsa", cs: "brzdový kotouč", de: "Bremsscheibe" },
  { match: /front sprocket/, hu: "első lánckerék", cs: "řetězové kolečko", de: "Ritzel" },
  { match: /rear sprocket/, hu: "hátsó lánckerék", cs: "řetězová rozeta", de: "Kettenrad" },
  { match: /sprocket/, hu: "lánckerék", cs: "rozeta", de: "Kettenrad" },
  { match: /chain/, hu: "lánc", cs: "řetěz", de: "Kette" },
  { match: /spark ?plug/, hu: "gyertya", cs: "svíčka", de: "Zündkerze" },
  { match: /piston ring/, hu: "dugattyúgyűrű", cs: "pístní kroužek", de: "Kolbenring" },
  { match: /piston|top[- ]end kit/, hu: "dugattyú", cs: "píst", de: "Kolben" },
  { match: /gasket/, hu: "tömítés", cs: "těsnění", de: "Dichtsatz" },
  { match: /clutch|friction plate/, hu: "kuplung lamella", cs: "lamely spojky", de: "Kupplungslamellen" },
  { match: /reed/, hu: "membrán", cs: "membrána", de: "Membran" },
  { match: /main jet/, hu: "főfúvóka", cs: "hlavní tryska", de: "Hauptdüse" },
  { match: /slow jet|pilot jet/, hu: "alapjárati fúvóka", cs: "volnoběžná tryska", de: "Leerlaufdüse" },
  { match: /silencer|muffler/, hu: "hangtompító", cs: "tlumič výfuku", de: "Schalldämpfer" },
  { match: /expansion chamber|exhaust pipe|\bpipe\b|exhaust/, hu: "kipufogó", cs: "výfuk", de: "Auspuff" },
  { match: /plastic/, hu: "idom szett", cs: "sada plastů", de: "Plastikkit" },
  { match: /graphic|decal/, hu: "matrica szett", cs: "polepy", de: "Dekor" },
  { match: /handlebar|\bbars?\b/, hu: "kormány", cs: "řídítka", de: "Lenker" },
  { match: /grip/, hu: "markolat", cs: "gripy", de: "Griffe" },
  { match: /fork seal|seal/, hu: "szimering", cs: "gufera", de: "Simmerring" },
  { match: /radiator/, hu: "hűtő", cs: "chladič", de: "Kühler" },
  { match: /tyre|tire/, hu: "gumi", cs: "pneumatika", de: "Reifen" },
];

export type QueryPart = { brand: string; category: string; name: string; partNumber: string | null; searchQuery: string };

/** "Various", "Michelin / Dunlop" → no single brand to search for. */
function searchableBrand(brand: string) {
  const b = brand.trim();
  return !b || /^various$/i.test(b) || b.includes("/") ? "" : b;
}

export function shopQuery(part: QueryPart, model: string, lang: string): string {
  const l = (["hu", "cs", "de"].includes(lang) ? lang : "en") as Lang;
  const hay = `${part.category} ${part.name}`.toLowerCase();
  const term = TERMS.find((t) => t.match.test(hay));
  const sizes = part.name.match(/\d{2,3}\/\d{2,3}-\d{2}/g) ?? []; // tyre sizes like 80/100-21

  // English shops, or a part type we can't translate: the original English query is the best we have.
  if (l === "en" || !term) {
    const q = part.searchQuery || `${part.brand} ${part.name}`;
    return q.toLowerCase().includes(model.toLowerCase()) ? q : `${q} ${model}`;
  }
  // Shops tend to write "FA185" as "FA 185" in product names, and their search matches whole words.
  const number = (part.partNumber ?? "").replace(/^([A-Za-z]{1,4})(\d{2,5})$/, "$1 $2");
  const words = [searchableBrand(part.brand), term[l], number, ...sizes, sizes.length ? "" : model];
  return words.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}
