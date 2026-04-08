export type EnergyEquivalents = {
  kwhPerDay: number;
  kwhPerYear: number;
  evMilesPerDay: number;
  evMilesPerYear: number;
  evFullChargesPerDay: number;
  evFullChargesPerYear: number;
  peopleDailyCaloriesPerDay: number;
  peopleDailyCaloriesPerYear: number;
};

const HOURS_PER_DAY = 24;
const DAYS_PER_YEAR = 365;

// Assumptions (kept here so UI copy can reference them consistently):
// - EV efficiency: 0.30 kWh/mi (order-of-magnitude, depends on vehicle + driving).
// - "Full charge" pack size: 60 kWh (common mid-size EV battery capacity).
// - Daily diet: 2,000 kcal/person/day. This is *dietary energy content* equivalence,
//   not the electricity required to grow/produce food.
const DEFAULT_KWH_PER_MILE = 0.3;
const DEFAULT_EV_PACK_KWH = 60;
const DEFAULT_KCAL_PER_PERSON_PER_DAY = 2000;

function wattsToKwh(watts: number, hours: number): number {
  if (!Number.isFinite(watts) || watts <= 0) return 0;
  return (watts * hours) / 1000;
}

function kwhToEvMiles(kwh: number, kwhPerMile = DEFAULT_KWH_PER_MILE): number {
  if (!Number.isFinite(kwh) || kwh <= 0) return 0;
  if (!Number.isFinite(kwhPerMile) || kwhPerMile <= 0) return 0;
  return kwh / kwhPerMile;
}

function kwhToEvFullCharges(kwh: number, packKwh = DEFAULT_EV_PACK_KWH): number {
  if (!Number.isFinite(kwh) || kwh <= 0) return 0;
  if (!Number.isFinite(packKwh) || packKwh <= 0) return 0;
  return kwh / packKwh;
}

function kcalToKwh(kcal: number): number {
  // 1 kcal = 4184 J; 1 kWh = 3.6e6 J
  return (kcal * 4184) / 3_600_000;
}

function kwhToPeopleDailyCalories(kwh: number, kcalPerPersonPerDay = DEFAULT_KCAL_PER_PERSON_PER_DAY): number {
  if (!Number.isFinite(kwh) || kwh <= 0) return 0;
  if (!Number.isFinite(kcalPerPersonPerDay) || kcalPerPersonPerDay <= 0) return 0;
  const kwhPerPersonDay = kcalToKwh(kcalPerPersonPerDay);
  if (kwhPerPersonDay <= 0) return 0;
  return kwh / kwhPerPersonDay;
}

export function energyEquivalentsFromWatts(wattsContinuous: number): EnergyEquivalents {
  const kwhPerDay = wattsToKwh(wattsContinuous, HOURS_PER_DAY);
  const kwhPerYear = kwhPerDay * DAYS_PER_YEAR;

  const evMilesPerDay = kwhToEvMiles(kwhPerDay);
  const evMilesPerYear = kwhToEvMiles(kwhPerYear);

  const evFullChargesPerDay = kwhToEvFullCharges(kwhPerDay);
  const evFullChargesPerYear = kwhToEvFullCharges(kwhPerYear);

  const peopleDailyCaloriesPerDay = kwhToPeopleDailyCalories(kwhPerDay);
  const peopleDailyCaloriesPerYear = kwhToPeopleDailyCalories(kwhPerYear);

  return {
    kwhPerDay,
    kwhPerYear,
    evMilesPerDay,
    evMilesPerYear,
    evFullChargesPerDay,
    evFullChargesPerYear,
    peopleDailyCaloriesPerDay,
    peopleDailyCaloriesPerYear,
  };
}

