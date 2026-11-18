export type EventKind = "service" | "mod" | "repair" | "plan";
export type PlanStatus = "idea" | "ordered" | "done";

export type ZoneId =
  | "engine"
  | "intake"
  | "exhaust"
  | "fuel"
  | "drivetrain"
  | "suspension_front"
  | "suspension_rear"
  | "brakes"
  | "wheels"
  | "plastics"
  | "controls"
  | "electrical"
  | "frame"
  | "other";

/** Stored as JSON inside an event. */
export type PartLine = {
  name: string;
  brand?: string;
  part_number?: string;
  qty?: number;
  price?: number;
};

export type VehicleModel = {
  id: string;
  make: string;
  model: string;
  yearFrom: number;
  yearTo: number;
  engineCc: number | null;
  stroke: number | null;
  category: string;
  summaryEn: string | null;
  summaryHu: string | null;
  partsCatalogUrl: string | null;
  ownersManualUrl: string | null;
  stockSetup: StockSetup | null;
  dataOrigin: string;
};

export type StockSetup = { source: string; values: Record<string, string> };

export type TuningSheet = {
  id: string;
  vehicleId: string;
  title: string;
  sheetDate: string | null;
  engineHours: number | null;
  track: string | null;
  surface: string | null;
  weather: string | null;
  tempC: number | null;
  altitudeM: number | null;
  settings: Record<string, string>;
  rating: number | null;
  notes: string | null;
  authorName: string | null;
  createdAt: string;
};

export type VehicleEvent = {
  id: string;
  vehicleId: string;
  kind: EventKind;
  planStatus: PlanStatus | null;
  zone: ZoneId;
  taskKey: string | null;
  title: string;
  description: string | null;
  eventDate: string | null;
  engineHours: number | null;
  odometerKm: number | null;
  cost: number | null;
  currency: string;
  parts: PartLine[];
  photoIds: string[];
  authorName: string | null;
  createdAt: string;
};

export type ModelSpec = {
  id: string;
  seedKey: string | null;
  specGroup: string;
  zone: string | null;
  labelEn: string;
  labelHu: string;
  value: string;
  source: string | null;
  isSeed: boolean;
  createdBy: string | null;
  verifiedBy: string[]; // user ids
};

export type ServiceInterval = {
  id: string;
  taskKey: string;
  zone: ZoneId;
  labelEn: string;
  labelHu: string;
  intervalHours: number | null;
  intervalKm: number | null;
  intervalMonths: number | null;
  notesEn: string | null;
  notesHu: string | null;
};

export type FitmentPart = {
  id: string;
  zone: ZoneId;
  category: string;
  brand: string;
  name: string;
  partNumber: string | null;
  isOem: boolean;
  searchQuery: string;
  infoUrl: string | null;
  notesEn: string | null;
  notesHu: string | null;
  isSeed: boolean;
};

export type Shop = {
  id: string;
  name: string;
  country: string;
  shipsTo: string[];
  language: string;
  homepage: string;
  searchUrlTemplate: string;
  sortOrder: number;
};
