/** The 26 counties of the Republic of Ireland — canonical labels for service area. */
export const IRISH_COUNTIES = [
  "Carlow",
  "Cavan",
  "Clare",
  "Cork",
  "Donegal",
  "Dublin",
  "Galway",
  "Kerry",
  "Kildare",
  "Kilkenny",
  "Laois",
  "Leitrim",
  "Limerick",
  "Longford",
  "Louth",
  "Mayo",
  "Meath",
  "Monaghan",
  "Offaly",
  "Roscommon",
  "Sligo",
  "Tipperary",
  "Waterford",
  "Westmeath",
  "Wexford",
  "Wicklow",
] as const;

export type IrishCounty = (typeof IRISH_COUNTIES)[number];

const COUNTY_LOOKUP = new Map(
  IRISH_COUNTIES.map((county) => [county.toLowerCase(), county]),
);

/** Resolve free text to a canonical county name, if it matches. */
export function resolveCountyName(text: string): IrishCounty | null {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return null;
  return COUNTY_LOOKUP.get(normalized) ?? null;
}

export function isIrishCounty(text: string): boolean {
  return resolveCountyName(text) !== null;
}
