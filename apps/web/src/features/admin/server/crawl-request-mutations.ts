import 'server-only';
import { createNotification } from '@carshenas/notifications/create-notification';
import type { DecideCrawlRequestForm } from '@/features/admin/crawl-request-schemas';
import type { DecideOutcome } from '@/features/admin/crawl-request-types';
import { adminDatabase } from '@/server/db/admin-database';
import { carNameOf } from '@/lib/crawl-requests-names';

// A person approves or declines a crawl request (CS-71, ADR-0023, ADR-0026). The section's role cannot write
// crawl_request; it asks decide_crawl_request(), which checks the superadmin, compares the request with the state the
// page showed, changes it and records the decision. When it changed, each buyer whose file raised the request is told
// once, in the same transaction, through the notifications helper (an event key per request and decision, so a repeat
// tells no one twice): a decision and the notices of it commit together or not at all. The decision starts no crawl.

export async function decideCrawlRequest(
  form: DecideCrawlRequestForm,
  superadminId: number,
): Promise<DecideOutcome> {
  return adminDatabase()
    .transaction()
    .execute(async (trx): Promise<DecideOutcome> => {
      const { outcome } = await trx
        .selectNoFrom((eb) =>
          eb
            .fn<DecideOutcome>('decide_crawl_request', [
              eb.val(form.requestId),
              eb.val(form.seenState),
              eb.val(form.decision),
              eb.val(form.reason),
              eb.val(superadminId),
            ])
            .as('outcome'),
        )
        .executeTakeFirstOrThrow();
      if (outcome !== 'changed') return outcome;

      const car = await trx
        .selectFrom('crawl_request as r')
        .innerJoin('model as m', 'm.id', 'r.model_id')
        .innerJoin('make as k', 'k.id', 'm.make_id')
        .leftJoin('trim as t', 't.id', 'r.trim_id')
        .select([
          'm.name_fa as model_fa',
          'm.name_en as model_en',
          'k.name_fa as make_fa',
          'k.name_en as make_en',
          't.name_fa as trim_fa',
          't.name_en as trim_en',
        ])
        .where('r.id', '=', form.requestId)
        .executeTakeFirstOrThrow();
      const carName = carNameOf({
        makeFa: car.make_fa,
        makeEn: car.make_en,
        modelFa: car.model_fa,
        modelEn: car.model_en,
        trimFa: car.trim_fa,
        trimEn: car.trim_en,
      });
      const links = await trx
        .selectFrom('crawl_request_file as l')
        .innerJoin('search_file as f', 'f.id', 'l.search_file_id')
        .select(['f.account_id', 'f.id'])
        .where('l.crawl_request_id', '=', form.requestId)
        .orderBy('f.id')
        .execute();
      // One notice per buyer, opening the first of their files that depends on the request.
      const firstFileOf = new Map<number, number>();
      for (const link of links)
        if (!firstFileOf.has(link.account_id)) firstFileOf.set(link.account_id, link.id);
      for (const [accountId, fileId] of firstFileOf) {
        await createNotification(trx, {
          accountId,
          kind: 'crawl_request_decided',
          payload: {
            requestId: form.requestId,
            decision: form.decision,
            carName,
            fileId,
            ...(form.reason === null ? {} : { reason: form.reason }),
          },
        });
      }
      return outcome;
    });
}
