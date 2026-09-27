import {
  SAMPLE_DROP,
  SAMPLE_ESTIMATE,
  SAMPLE_ESTIMATE_HIGH,
  SAMPLE_ESTIMATE_LOW,
  SAMPLE_LISTED_AT,
  SAMPLE_MILEAGE_KM,
  SAMPLE_NOW,
  SAMPLE_PRICE,
  SAMPLE_RANGE_END,
  SAMPLE_SCALE,
} from '@/features/design-language/design-language-samples';
import {
  formatDate,
  formatDateNumeric,
  formatDateRange,
  formatDateTime,
  formatMonthYear,
  formatTimeAgo,
  formatWeekdayDate,
} from '@/lib/format-date';
import { formatCount, formatPercent } from '@/lib/format-number';
import {
  formatToman,
  formatTomanCompact,
  formatTomanCompactRange,
  formatTomanEstimate,
  formatTomanEstimateRange,
  formatTomanInWords,
} from '@/lib/toman';

// Every amount, number and date form of ADR-0014, formatted here on the server from fixed samples.
const ROWS = [
  ['قیمت آگهی', formatToman(SAMPLE_PRICE)],
  ['ارزش بازار', formatTomanEstimate(SAMPLE_ESTIMATE)],
  ['بازهٔ ارزش بازار', formatTomanEstimateRange(SAMPLE_ESTIMATE_LOW, SAMPLE_ESTIMATE_HIGH)],
  ['درون جمله', `قیمت ${formatTomanInWords(SAMPLE_DROP)} کم شد.`],
  ['روی محور نمودار', formatTomanCompact(SAMPLE_SCALE)],
  ['روی فیلتر', formatTomanCompactRange(SAMPLE_ESTIMATE_LOW, SAMPLE_ESTIMATE_HIGH)],
  ['اختلاف با ارزش بازار', `${formatPercent(0.08)} زیر ارزش بازار`],
  ['کارکرد', `${formatCount(SAMPLE_MILEAGE_KM)} کیلومتر`],
  ['تاریخ', formatDate(SAMPLE_LISTED_AT)],
  ['تاریخ و ساعت', formatDateTime(SAMPLE_LISTED_AT)],
  ['با روز هفته', formatWeekdayDate(SAMPLE_LISTED_AT)],
  ['ماه', formatMonthYear(SAMPLE_LISTED_AT)],
  ['در جدول', formatDateNumeric(SAMPLE_LISTED_AT)],
  ['بازهٔ تاریخ', formatDateRange(SAMPLE_LISTED_AT, SAMPLE_RANGE_END)],
  ['زمان گذشته', formatTimeAgo(SAMPLE_LISTED_AT, SAMPLE_NOW)],
] as const;

const COLUMN = [680_000_000, 1_250_000_000, 2_450_000_000, 915_000_000] as const;

export function FormatSamples() {
  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)]">
        {ROWS.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-secondary text-muted">{term}</dt>
            <dd className="text-control">{value}</dd>
          </div>
        ))}
      </dl>
      <table className="text-control">
        <caption className="pb-2 text-start text-secondary text-muted">
          در ستون، رقم‌ها هم‌عرض‌اند تا زیر هم بنشینند
        </caption>
        <tbody>
          {COLUMN.map((amount) => (
            <tr key={amount} className="border-b border-divider">
              <td className="py-2 text-end tabular-nums">{formatCount(amount)}</td>
              <td className="py-2 ps-2 text-muted">تومان</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
