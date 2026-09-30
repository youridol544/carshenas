// The body types a model can have, in the order pages show them, with the photograph that stands for each (CS-57).
// The codes and Farsi labels mirror the catalogue (apps/worker/src/catalogue/codes.ts, the body_type table); the photo
// data mirrors public/body-types/credits.json, which also records how each file was made, and a unit test holds the
// three together. Photos are served from our own origin as /body-types/<code>-<width>.<avif|webp>.

export const BODY_TYPE_CODES = [
  'sedan',
  'hatchback',
  'crossover',
  'suv',
  'pickup',
  'van',
  'minivan',
  'coupe',
  'convertible',
  'wagon',
] as const;
export type BodyTypeCode = (typeof BODY_TYPE_CODES)[number];

export type PhotoLicence = 'Unsplash License';

export type BodyType = {
  code: BodyTypeCode;
  /** The label the catalogue gives the type. */
  labelFa: string;
  /** The car in the photo, as a Farsi reader names it. */
  carFa: string;
  photo: {
    /** The car in the photo, as its maker names it (the credits are in English). */
    car: string;
    page: string;
    photographer: string;
    photographerUrl: string;
    site: 'Unsplash';
    licence: PhotoLicence;
    licenceUrl: string;
  };
};

const UNSPLASH = {
  site: 'Unsplash',
  licence: 'Unsplash License',
  licenceUrl: 'https://unsplash.com/license',
} as const;

export const BODY_TYPES = [
  {
    code: 'sedan',
    labelFa: 'سدان',
    carFa: 'تویوتا کمری',
    photo: {
      car: 'Toyota Camry',
      page: 'https://unsplash.com/photos/silver-sedan-parked-on-road-during-daytime-YPfnvLc3bbQ',
      photographer: 'Kevin Bonilla',
      photographerUrl: 'https://unsplash.com/@kevinography',
      ...UNSPLASH,
    },
  },
  {
    code: 'hatchback',
    labelFa: 'هاچ‌بک',
    carFa: 'فولکس‌واگن گلف',
    photo: {
      car: 'Volkswagen Golf R',
      page: 'https://unsplash.com/photos/SuD4h8Gpgok',
      photographer: 'Martin Katler',
      photographerUrl: 'https://unsplash.com/@martinkatler',
      ...UNSPLASH,
    },
  },
  {
    code: 'crossover',
    labelFa: 'کراس‌اوور',
    carFa: 'هیوندای توسان',
    photo: {
      car: 'Hyundai Tucson',
      page: 'https://unsplash.com/photos/Xs69Y3k1ru4',
      photographer: 'Duncan Winslow',
      photographerUrl: 'https://unsplash.com/@winslowxyz',
      ...UNSPLASH,
    },
  },
  {
    code: 'suv',
    labelFa: 'شاسی‌بلند',
    carFa: 'تویوتا لندکروزر پرادو',
    photo: {
      car: 'Toyota Land Cruiser Prado',
      page: 'https://unsplash.com/photos/white-suv-on-road-during-daytime-CyEyJjfgd5A',
      photographer: 'Ladimir Ladroid',
      photographerUrl: 'https://unsplash.com/@ladroid',
      ...UNSPLASH,
    },
  },
  {
    code: 'pickup',
    labelFa: 'وانت',
    carFa: 'تویوتا هایلوکس',
    photo: {
      car: 'Toyota Hilux',
      page: 'https://unsplash.com/photos/tvi8dUU3ULk',
      photographer: 'Cassiano K. Wehr',
      photographerUrl: 'https://unsplash.com/@cassianokw',
      ...UNSPLASH,
    },
  },
  {
    code: 'van',
    labelFa: 'ون',
    carFa: 'تویوتا پروایس',
    photo: {
      car: 'Toyota Proace',
      page: 'https://unsplash.com/photos/a-white-van-parked-on-a-dirt-road--BnvBSUOQHM',
      photographer: 'Till Daling',
      photographerUrl: 'https://unsplash.com/@tilldaling',
      ...UNSPLASH,
    },
  },
  {
    code: 'minivan',
    labelFa: 'مینی‌ون',
    carFa: 'کیا کارنیوال',
    photo: {
      car: 'Kia Carnival',
      page: 'https://unsplash.com/photos/a-white-suv-parked-on-the-side-of-a-road-Vol9i-VaUV0',
      photographer: 'NAM CZ',
      photographerUrl: 'https://unsplash.com/@czon00',
      ...UNSPLASH,
    },
  },
  {
    code: 'coupe',
    labelFa: 'کوپه',
    carFa: 'هیوندای جنسیس کوپه',
    photo: {
      car: 'Hyundai Genesis Coupe',
      page: 'https://unsplash.com/photos/black-bmw-m-3-on-road-LYCDnv7iL2Y',
      photographer: 'Marselo Jurado',
      photographerUrl: 'https://unsplash.com/@marselojur1',
      ...UNSPLASH,
    },
  },
  {
    code: 'convertible',
    labelFa: 'کروک',
    carFa: 'استون مارتین ونتیج رودستر',
    photo: {
      car: 'Aston Martin Vantage Roadster',
      page: 'https://unsplash.com/photos/grey-convertible-coupe-on-road-during-daytime-_sWmUw8UBBI',
      photographer: 'Tyler Clemmensen',
      photographerUrl: 'https://unsplash.com/@tyler_clemmensen',
      ...UNSPLASH,
    },
  },
  {
    code: 'wagon',
    labelFa: 'استیشن',
    carFa: 'ولوو استیشن',
    photo: {
      car: 'Volvo V50',
      page: 'https://unsplash.com/photos/silver-volvo-station-wagon-parked-on-dirt-road-yRqWWun9_Bw',
      photographer: 'Sascha Pfyl',
      photographerUrl: 'https://unsplash.com/@pfyyyl',
      ...UNSPLASH,
    },
  },
] as const satisfies readonly BodyType[];

/** The widths written by scripts/body-type-photos.mjs, all at 4:3. */
export const BODY_TYPE_PHOTO_WIDTHS = [160, 240, 320, 480, 640] as const;

export function bodyTypePhotoSrcSet(code: BodyTypeCode, format: 'avif' | 'webp'): string {
  return BODY_TYPE_PHOTO_WIDTHS.map(
    (width) => `/body-types/${code}-${width}.${format} ${String(width)}w`,
  ).join(', ');
}

/** The Farsi description of a body type's photo, for its alt text where the photo stands alone. */
export function bodyTypePhotoAlt(bodyType: BodyType): string {
  return `${bodyType.carFa}، نمونه‌ی ${bodyType.labelFa}`;
}
