// A small catalogue for the understanding's tests: the ten searchable models of the lane database with the curated
// aliases CS-50 gives them, a few makes and models the index does not collect, some trims, cities, districts, body types
// and colours. Names and keys are the real ones (2026-10-02). Test support only: nothing imports it at run time.
import {
  buildLexicon,
  type Lexicon,
  type LexiconRows,
  type MakeRow,
  type ModelRow,
  type TrimRow,
} from './lexicon.ts';

const ZWNJ = String.fromCodePoint(0x200c);

const make = (
  key: string,
  nameFa: string | null,
  nameEn: string,
  listings: number,
  aliases: string[] = [],
): MakeRow => ({
  key,
  nameFa,
  nameEn,
  aliases: [nameEn, ...(nameFa === null ? [] : [nameFa]), ...aliases],
  listings,
});
const model = (
  key: string,
  nameFa: string | null,
  nameEn: string,
  listings: number,
  aliases: string[] = [],
): ModelRow => ({ key, makeKey: key.split('.')[0] ?? '', nameFa, nameEn, aliases, listings });
const trim = (key: string, nameFa: string | null, nameEn: string, listings: number): TrimRow => ({
  key,
  modelKey: key.split('.').slice(0, 2).join('.'),
  nameFa,
  nameEn,
  aliases: [],
  listings,
});

export const FIXTURE_ROWS: LexiconRows = {
  makes: [
    make('peugeot', 'پژو', 'Peugeot', 13326, ['pejo', 'pezho', 'pezhou']),
    make('samand', 'سمند', 'Samand', 2730),
    make('dena', 'دنا', 'Dena', 2531),
    make('toyota', 'تویوتا', 'Toyota', 1725),
    make('quick', 'کوییک', 'Quick', 1450, ['kuik']),
    make('pride', 'پراید', 'Pride', 1365, ['paraid']),
    make('tiba', 'تیبا', 'Tiba', 0),
    make('kia', 'کیا', 'Kia', 0),
    make('hyundai', 'هیوندای', 'Hyundai', 0),
    make('lexus', 'لکسوس', 'Lexus', 0),
    make('shahin', 'شاهین', 'Shahin', 0),
    make('mazda', 'مزدا', 'Mazda', 0),
    make('gaz', 'گاز', 'Gaz', 0),
  ],
  models: [
    model('peugeot.206', 'پژو ۲۰۶', 'Peugeot 206', 4244, [
      'پژو ۲۰۶',
      '۲۰۶',
      'Peugeot 206',
      'دویست و شش',
      'پژو دویست و شش',
      'pejo 206',
      'pezho 206',
    ]),
    model('peugeot.207i', 'پژو ۲۰۷i', 'Peugeot 207i', 4443, [
      '۲۰۷',
      'پژو ۲۰۷',
      'پژو ۲۰۷ آی',
      '207i',
      'Peugeot 207',
      'دویست و هفت',
    ]),
    model('peugeot.405', 'پژو ۴۰۵', 'Peugeot 405', 1926, ['پژو ۴۰۵', '۴۰۵', 'Peugeot 405', 'چهارصد و پنج']),
    model('peugeot.pars', 'پژو پارس', 'Peugeot Pars', 2713, ['پارس', 'پژو پارس', 'Peugeot Pars']),
    model('dena.plus', 'دنا پلاس', 'Dena plus', 2531, ['دنا پلاس', 'Dena Plus']),
    model('samand.soren', 'سمند سورن', 'Samand Soren', 1462, ['سمند سورن', 'سورن', 'Samand Soren', 'soren']),
    model('samand.lx', 'سمند LX', 'Samand LX', 1268, ['سمند LX', `سمند ال${ZWNJ}ایکس`, 'Samand LX']),
    model('quick.manual', `کوییک دنده${ZWNJ}ای`, 'Quick manual', 1450, [
      `کوییک دنده${ZWNJ}ای`,
      `کوئیک دنده${ZWNJ}ای`,
      'Quick manual',
    ]),
    model('pride.131', 'پراید ۱۳۱', 'Pride 131', 1365, ['پراید ۱۳۱', '۱۳۱', 'Pride 131', 'صد و سی و یک']),
    model('toyota.corolla', 'تویوتا کرولا', 'Toyota Corolla', 1725, [
      'تویوتا کرولا',
      'کرولا',
      'Toyota Corolla',
      'corolla',
    ]),
    model('tiba.hatchback', null, 'Tiba Hatchback', 0),
    model('tiba.sedan', null, 'Tiba Sedan', 0),
    model('kia.cerato', null, 'Kia Cerato', 0),
    model('kia.sportage', null, 'Kia Sportage', 0),
    model('lexus.es', null, 'Lexus ES', 0),
    model('lexus.lx', null, 'Lexus LX', 0),
    model('hyundai.elantra', null, 'Hyundai Elantra', 0),
    model('shahin.g-cvt', null, 'Shahin G CVT', 0),
    model('mazda.3', null, 'Mazda 3', 0),
  ],
  trims: [
    trim('peugeot.206.2', 'پژو 206 تیپ ۲', 'Peugeot 206 2', 1280),
    trim('peugeot.206.5', 'پژو 206 تیپ ۵', 'Peugeot 206 5', 1234),
    trim('peugeot.206.6', 'پژو 206 تیپ ۶', 'Peugeot 206 6', 300),
    trim('peugeot.206.sd', null, 'Peugeot 206 SD', 746),
    trim('peugeot.pars.elx-normal', 'پژو پارس ELX', 'Peugeot Pars ELX-normal', 123),
    trim('peugeot.pars.xu7', 'پژو پارس XU7', 'Peugeot Pars XU7', 767),
    trim('pride.131.se', null, 'Pride 131 SE', 993),
    trim('pride.131.sx', null, 'Pride 131 SX', 116),
    trim('samand.soren.plus', 'سمند سورن پلاس', 'Samand Soren Plus', 1080),
    trim('samand.soren.basic', 'سمند سورن معمولی', 'Samand Soren Basic', 142),
    trim('dena.plus.1700cc-automatic', 'دنا پلاس اتوماتیک', 'Dena plus 1700cc-automatic', 1219),
    trim('dena.plus.1700cc-manual', 'دنا پلاس تیپ ۲ دنده‌ای', 'Dena plus 1700cc-manual', 72),
    trim('dena.plus.1700cc-turbo', 'دنا پلاس تیپ ۲ توربو', 'Dena plus 1700cc-turbo', 13),
  ],
  cities: [
    { key: 'tehran', label: 'تهران', listings: 5955 },
    { key: 'karaj', label: 'کرج', listings: 2 },
    { key: 'qom', label: 'قم', listings: 1 },
  ],
  districts: [
    { key: 'tehran.ونک', label: 'ونک', listings: 35 },
    { key: 'tehran.صادقیه', label: 'صادقیه', listings: 514 },
    { key: 'tehran.کن', label: 'کن', listings: 5 },
    { key: 'tehran.سعادت آباد', label: 'سعادت آباد', listings: 87 },
  ],
  bodyTypes: [
    { code: 'sedan', label: 'سدان', listings: 13056 },
    { code: 'hatchback', label: `هاچ${ZWNJ}بک`, listings: 9136 },
    { code: 'crossover', label: `کراس${ZWNJ}اوور`, listings: 935 },
    { code: 'suv', label: `شاسی${ZWNJ}بلند`, listings: 0 },
    { code: 'pickup', label: 'وانت', listings: 0 },
  ],
  colours: [
    { label: 'سفید', family: 'white' },
    { label: 'سفید صدفی', family: 'white' },
    { label: 'مشکی', family: 'black' },
    { label: `نقره${ZWNJ}ای`, family: 'silver' },
    { label: 'طوسی', family: 'grey' },
    { label: `سرمه${ZWNJ}ای`, family: 'blue' },
    { label: 'قرمز', family: 'red' },
  ],
};

export function fixtureLexicon(): Lexicon {
  return buildLexicon(FIXTURE_ROWS);
}
