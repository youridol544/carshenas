import 'server-only';
import type { CountryForm } from '@/features/admin/country-schemas';
import type { CountryOutcome } from '@/features/admin/country-types';
import { adminDatabase } from '@/server/db/admin-database';

// A person sets, changes or removes the country of a make or of one of its models (CS-103, ADR-0041, ADR-0023). The
// section's role cannot write country_spec; it asks set_country_spec(), which checks the superadmin, applies the table's
// own list of countries and records who and when, with the earlier country, in the same transaction.

export async function setCountry(form: CountryForm, superadminId: number): Promise<CountryOutcome> {
  const { outcome } = await adminDatabase()
    .selectNoFrom((eb) =>
      eb
        .fn<CountryOutcome>('set_country_spec', [
          eb.val(form.makeId),
          eb.val(form.modelId),
          eb.val(form.country),
          eb.val(superadminId),
        ])
        .as('outcome'),
    )
    .executeTakeFirstOrThrow();
  return outcome;
}
