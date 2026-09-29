// The models Carshenas reads in depth on Divar (ADR-0017 points 3 and 4; CS-33 criterion 7): a configured list until
// the superadmin section manages it (CS-53). Each is one of Divar's own brand_model filter values, the ones the web
// client sends for divar.ir/s/tehran/car/<make>/<model>; discovery reads all of them in one newest-first feed. Seeded
// with the ten models with the most Tehran listings in the first measurement (2026-09-29, CS-33): the largest passed
// what the sweep read, so they are ranked by listings posted a day on the pages read, which follows active listings
// where listings last alike and, unlike every sort event, is not raised by bumps. The listing data and freshness
// research note has the figures (section 6), and its folder the data.

export type TrackedModel = {
  /** Divar's brand_model value for the model, as its search takes it: «Peugeot 206». */
  readonly brandModel: string;
  /** How people and the logs name it. */
  readonly nameFa: string;
};

export const TRACKED_MODELS: readonly TrackedModel[] = [
  { brandModel: 'Peugeot 206', nameFa: 'پژو ۲۰۶' }, // 887 posted a day
  { brandModel: 'Peugeot 207i', nameFa: 'پژو ۲۰۷i' }, // 671 posted a day
  { brandModel: 'Peugeot Pars', nameFa: 'پژو پارس' }, // 509 posted a day
  { brandModel: 'Dena plus', nameFa: 'دنا پلاس' }, // 294 posted a day
  { brandModel: 'Samand Soren', nameFa: 'سمند سورن' }, // 157 posted a day
  { brandModel: 'Peugeot 405', nameFa: 'پژو ۴۰۵' }, // 142 posted a day
  { brandModel: 'Quick manual', nameFa: 'کوییک دنده‌ای' }, // 129 posted a day
  { brandModel: 'Pride 131', nameFa: 'پراید ۱۳۱' }, // 127 posted a day
  { brandModel: 'Toyota Corolla', nameFa: 'تویوتا کرولا' }, // 85 posted a day
  { brandModel: 'Samand LX', nameFa: 'سمند LX' }, // 84 posted a day
];
