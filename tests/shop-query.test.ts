import { describe, expect, it } from "vitest";
import { shopQuery } from "@/lib/shopQuery";

const part = (brand: string, category: string, name: string, partNumber: string | null, searchQuery = `${brand} ${name}`) => ({ brand, category, name, partNumber, searchQuery });

describe("shop search in the shop's language", () => {
  it("uses Hungarian part words for Hungarian shops", () => {
    expect(shopQuery(part("Athena", "Gasket kit", "Top-end gasket kit", null), "YZ125", "hu")).toBe("Athena tömítés YZ125");
    expect(shopQuery(part("Twin Air", "Air filter", "Air filter", "152213"), "YZ125", "hu")).toBe("Twin Air légszűrő 152213 YZ125");
    expect(shopQuery(part("EBC", "Brake pads", "Front brake pads", "FA185"), "YZ125", "hu")).toBe("EBC fékbetét FA 185 YZ125");
    expect(shopQuery(part("JT Sprockets", "Sprockets", "Rear sprocket 48T, 520", "JTR251.48"), "YZ125", "hu")).toBe("JT Sprockets hátsó lánckerék JTR251.48 YZ125");
  });

  it("uses Czech and German words for those shops", () => {
    expect(shopQuery(part("NGK", "Spark plug", "BR9EG", "BR9EG"), "YZ125", "cs")).toBe("NGK svíčka BR9EG YZ125");
    expect(shopQuery(part("Polisport", "Plastic kit", "OEM-style plastic kit", "90108"), "YZ125", "de")).toBe("Polisport Plastikkit 90108 YZ125");
  });

  it("searches tyres by size and skips placeholder brands", () => {
    expect(shopQuery(part("Michelin / Dunlop", "Tyres", "MX tyres 80/100-21 & 100/90-19", null), "YZ125", "hu")).toBe("gumi 80/100-21 100/90-19");
    expect(shopQuery(part("Various", "Graphics", "Decal / graphics kit", null), "YZ125", "hu")).toBe("matrica szett YZ125");
  });

  it("keeps the English query for English shops and unknown part types", () => {
    expect(shopQuery(part("FMF", "Expansion chamber", "Fatty pipe", "024041", "FMF Fatty YZ125 024041"), "YZ125", "en")).toBe("FMF Fatty YZ125 024041");
    expect(shopQuery(part("Acme", "Widget", "Thing", null, "Acme thing"), "YZ125", "hu")).toBe("Acme thing YZ125");
  });
});
