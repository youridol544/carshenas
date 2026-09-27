create or replace function fa_normalize(t text) returns text
language sql immutable parallel safe strict
return btrim(regexp_replace(
  regexp_replace(
    regexp_replace(
      lower(immutable_unaccent(
        translate(normalize(t, NFKC),
          -- mapped characters (one-to-one with the second argument)
          U&'\064A\0649\0643\06C0\0629\06C1\0623\0625\0622\0671'   -- ي ى ك ۀ ة ہ أ إ آ ٱ
          || U&'\06F0\06F1\06F2\06F3\06F4\06F5\06F6\06F7\06F8\06F9' -- Persian digits
          || U&'\0660\0661\0662\0663\0664\0665\0666\0667\0668\0669' -- Arabic-Indic digits
          || U&'\200C\00A0\202F\066B'                                -- ZWNJ, NBSP, NNBSP, Arabic decimal sep
          -- deleted characters (no counterpart): tatweel, harakat, superscript alef,
          -- ZWJ, LRM, RLM, ALM, BOM, soft hyphen, Arabic thousands separator, bidi controls
          || U&'\0640\064B\064C\064D\064E\064F\0650\0651\0652\0653\0654\0655\0670'
          || U&'\200D\200E\200F\061C\FEFF\00AD\066C\202A\202B\202C\202D\202E\2066\2067\2068\2069',
          U&'\06CC\06CC\06A9\0647\0647\0647\0627\0627\0627\0627'     -- ی ی ک ه ه ه ا ا ا ا
          || '0123456789'
          || '0123456789'
          || '   .'))),
      -- split Arabic-script letters from digits: «تیپ۲» -> «تیپ 2», «۲۰۶تیپ» -> «206 تیپ»
      '([ء-يٱ-ۓۺ-ۿ])([0-9])', '\1 \2', 'g'),
    '([0-9])([ء-يٱ-ۓۺ-ۿ])', '\1 \2', 'g'),
  '\s+', ' ', 'g'));
