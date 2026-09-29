// The models Carshenas reads in depth on Divar (ADR-0017 points 3 and 4; CS-33 criterion 7): a configured list until
// the superadmin section manages it (CS-53). Each is one of Divar's own brand_model filter values, the ones the web
// client sends for divar.ir/s/tehran/car/<make>/<model>; discovery reads all of them in one newest-first feed. Seeded
// with the ten models that had the most active Tehran listings in the first measurement (model_volume; the listing
// data and freshness research note has the counts).

export type TrackedModel = {
  /** Divar's brand_model value for the model, as its search takes it: «Peugeot 206». */
  readonly brandModel: string;
  /** How people and the logs name it. */
  readonly nameFa: string;
};

export const TRACKED_MODELS: readonly TrackedModel[] = [];
