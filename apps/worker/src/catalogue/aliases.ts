// Curated aliases of the tracked models (CS-50 criterion 3): how buyers and sellers write them in Persian, in Latin
// letters and with the number spelled out. Each is stored with fa_normalize() folding digit scripts and Arabic
// letters, so «۲۰۶» and «206» are one alias. A make's Persian name and Divar's own key are aliases of it already;
// catalogue:sync adds these by the model's Divar key.

const ZWNJ = String.fromCodePoint(0x200c);

export type CuratedAlias = { readonly alias: string; readonly script: 'fa' | 'latin' | 'spelled' };

// How buyers type a make's Persian name in Latin letters (Finglish), which no source writes: «pejo 206». Added by
// CS-62's plain-Farsi search, which reads aliases from catalogue_alias; keyed by Divar's own make key like
// DIVAR_MAKES. A make's Persian name and Divar's own key are aliases of it already (catalogue-store.ts).
export const MAKE_ALIASES: Readonly<Record<string, readonly CuratedAlias[]>> = {
  Peugeot: [
    { alias: 'pejo', script: 'latin' },
    { alias: 'pezho', script: 'latin' },
    { alias: 'pezhou', script: 'latin' },
  ],
  Pride: [{ alias: 'paraid', script: 'latin' }],
  Quick: [
    { alias: 'kuik', script: 'latin' },
    { alias: 'kooik', script: 'latin' },
  ],
};

export const TRACKED_MODEL_ALIASES: Readonly<Record<string, readonly CuratedAlias[]>> = {
  'Peugeot 206': [
    { alias: 'پژو ۲۰۶', script: 'fa' },
    { alias: '۲۰۶', script: 'fa' },
    { alias: 'Peugeot 206', script: 'latin' },
    { alias: 'pejo 206', script: 'latin' },
    { alias: 'pezho 206', script: 'latin' },
    { alias: 'دویست و شش', script: 'spelled' },
    { alias: 'پژو دویست و شش', script: 'spelled' },
  ],
  'Peugeot 207i': [
    { alias: '۲۰۷', script: 'fa' },
    { alias: 'پژو ۲۰۷', script: 'fa' },
    { alias: 'pejo 207', script: 'latin' },
    { alias: 'pezho 207', script: 'latin' },
    { alias: 'پژو ۲۰۷ آی', script: 'fa' },
    { alias: '207i', script: 'latin' },
    { alias: 'Peugeot 207', script: 'latin' },
    { alias: 'دویست و هفت', script: 'spelled' },
  ],
  'Peugeot Pars': [
    { alias: 'pejo pars', script: 'latin' },
    { alias: 'pezho pars', script: 'latin' },
    { alias: 'پژو پارس', script: 'fa' },
    { alias: 'پارس', script: 'fa' },
    { alias: 'Peugeot Pars', script: 'latin' },
  ],
  'Dena plus': [
    { alias: 'دنا پلاس', script: 'fa' },
    { alias: 'Dena Plus', script: 'latin' },
  ],
  'Samand Soren': [
    { alias: 'soren', script: 'latin' },
    { alias: 'سمند سورن', script: 'fa' },
    { alias: 'سورن', script: 'fa' },
    { alias: 'Samand Soren', script: 'latin' },
  ],
  'Peugeot 405': [
    { alias: 'pejo 405', script: 'latin' },
    { alias: 'pezho 405', script: 'latin' },
    { alias: 'پژو ۴۰۵', script: 'fa' },
    { alias: '۴۰۵', script: 'fa' },
    { alias: 'Peugeot 405', script: 'latin' },
    { alias: 'چهارصد و پنج', script: 'spelled' },
    { alias: 'پژو چهارصد و پنج', script: 'spelled' },
  ],
  'Quick manual': [
    { alias: `کوییک دنده${ZWNJ}ای`, script: 'fa' },
    { alias: `کوئیک دنده${ZWNJ}ای`, script: 'fa' },
    { alias: 'Quick manual', script: 'latin' },
  ],
  'Pride 131': [
    { alias: 'پراید ۱۳۱', script: 'fa' },
    { alias: '۱۳۱', script: 'fa' },
    { alias: 'Pride 131', script: 'latin' },
    { alias: 'صد و سی و یک', script: 'spelled' },
    { alias: 'پراید صد و سی و یک', script: 'spelled' },
  ],
  'Toyota Corolla': [
    { alias: 'corolla', script: 'latin' },
    { alias: 'تویوتا کرولا', script: 'fa' },
    { alias: 'کرولا', script: 'fa' },
    { alias: 'Toyota Corolla', script: 'latin' },
  ],
  'Samand LX': [
    { alias: 'سمند LX', script: 'fa' },
    { alias: `سمند ال${ZWNJ}ایکس`, script: 'fa' },
    { alias: 'Samand LX', script: 'latin' },
  ],
};
