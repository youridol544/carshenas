# ADR-0039: Engine volume and origin are catalogue facts the superadmin keeps per model and trim; a listing inherits them, and search excludes what it does not know

- Status: accepted by delegation (2026-10-03; the owner asked that lane decisions be taken without him, "decide yourself based on best you recommend")
- Date: 2026-10-03
- Deciders: Pedrum (delegated to the CS-99 lane)
- Related: CS-99, CS-100, CS-102; ADR-0013, ADR-0023, ADR-0027, ADR-0028, ADR-0029, ADR-0037; `docs/evidence/query-understanding/2026-10-03-engine-volume/`

## Context

On 2026-10-03 the owner pointed out that buyers ask for «حجم موتور بیشتر از ۲۰۰۰ سی‌سی», «موتور ۲ لیتری» and «ماشین‌های خارجی». The data cannot answer: 1 of 6,169 stored snapshots states a volume (a seller's description row), 5 of 6,088 titles state one with its unit, and the catalogue has no origin. Search answered «حجم موتور بالای ۲۵۰۰» with a price filter of 2.5 billion tomans (a real defect the first measurement found). What is known is per car model, not per listing: a Pride 131 is a 1300 cc car whatever its seller writes.

## Decision

1. **`model_spec` holds the facts**, one row per catalogue scope (a model, or one of its trims; `UNIQUE NULLS NOT DISTINCT (model_id, trim_id)`): `engine_volume_cc` (500 to 9,000, a named range check; nominal figures, the number sellers and buyers write) and `car_origin` (`domestic`: an Iranian maker's own design; `joint_venture`: a foreign design built in Iran; `imported`), each nullable, at least one set, with a `source` (`catalogue`: the trim's own name states the volume; `seed`: the makers' published engines for the ten tracked models and the origin of makes that are all one thing; `superadmin`).
2. **A listing inherits per field**: its own title's volume (`listing.engine_volume_cc`, read by code from the title with its unit, parser version 6), else its trim's row, else its model's row; the origin from its trim's row, else its model's. `listing_filter_row` computes it with two joins on the unique scope key and `search_document` copies `engine_volume_cc` and `car_origin`. Nothing is guessed: a model with no row stays unknown.
3. **The superadmin changes rows only through `set_model_spec()`** (SECURITY DEFINER, ADR-0023), which states the target (both values empty removes the row) and appends `model_spec_change` (append-only, kept after the row is gone) with the earlier and later values, who and when; the web role reads two values and where they belong, never who set them. A change marks the listings it covers for the next search refresh (a row trigger, ADR-0028).
4. **The screen** is a section of `/admin/tracked-models`: the share of active listings with a known volume and origin, the models that miss one first, a search for any catalogue model (tracked or not, with listings or not), and for each model an editor for the whole model and one per trim, with its latest changes. Tracked cards show their spec line and link to it.
5. **Search gets two filters** in the shared definitions: `engine_volume` (a range in cc, URL `cc=1400..1800`) and `origin` (a choice, URL `origin=imported`). A listing whose value is unknown is excluded (SQL `NULL` never matches), and the page says how many listings the rest of the search keeps that were left out for that reason.
6. **Plain-Farsi reading (code first, ADR-0029).** A volume is read with its unit (`سی‌سی`, `cc`, `لیتر`, `لیتری`, Latin or Persian digits, a decimal litre), or after «حجم»/«موتور»: at least («بیشتر از», «بالای», «حداقل», «به بالا») is a minimum with the figure included; at most is the figure; «کمتر از», «زیر» is strictly below (figure minus one); a figure alone or «حدود» is five percent either side to the nearest ten (1600 reads as 1520 to 1680, so a listing that states 1587 or 1598 is found); a range is its ends. Origin: «خارجی», «وارداتی» are `imported`; «ایرانی», «ساخت داخل» are `domestic` and `joint_venture`; «مونتاژ» is `joint_venture`. The vague «تمیز» beside an origin is the clean bundle. The model behind its default-off switch reads the same filters through the same re-reading of the buyer's words.
7. **Range filters share one control** (CS-102): two typed fields, the steps as quick picks, one chip, one address form. It serves mileage, price, model year and the volume.

## Alternatives considered

- **A column on `model` and `trim`**: no history, no author, and a trim without a value cannot say it inherits. A separate table with a change record follows `tracked_model` and `model_photo_link`.
- **A volume range per model** (1200 to 2000 for a Corolla): the trims already say it; a range hides which listing is which. The model page shows the range of its trims instead.
- **Guessing the volume and origin of every model from the make** (all Hyundai imported): assembled and imported cars share makes; the seed holds only what is certain and the section shows the rest as missing.
- **Reading the volume from the seller's text with the model**: it is the paid, switched-off step; the title's own unit is read by code, and extraction may fill more later.
- **Strict «بیشتر از»** (2000 excludes 2000): the figures are nominal and a buyer who writes «بیشتر از ۲۰۰۰» wants the two-litre class; «کمتر از» stays strict, as «زیر» is for a year.

## Consequences

- Positive: on the lane's data 99 % of the 23,125 active listings have a volume and all have an origin after the seed; 52 of 52 labelled volume and origin phrasings are read as labelled by code (the model alone reads 32 of 52), at no cost.
- Negative / risks: the seeded engines are marked as seeds to be reviewed; a model with trims of several volumes and no row of its own leaves a listing matched only to the model unknown. A change reaches search within a minute (the refresh), not at once.
- Follow-ups: reading a stated volume from the description with the paid step; the origin and volume of the rest of the catalogue by the superadmin or from a source.
