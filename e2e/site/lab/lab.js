// A small installment-and-comparison widget with nine planted defects, each switched on by ?defect=<name> (repeatable).
// tests/harness/gorilla-selfcheck.spec.ts proves the gorilla catches every one of them, and that without a
// defect this page survives the gorilla with no findings at all. Keep both true when editing this file.
//
//   throw     the third "add to comparison" throws an uncaught exception
//   request   refreshing prices requests a file that does not exist (HTTP 404)
//   overflow  a long dealership name stops wrapping and the page scrolls sideways
//   garbage   typed Persian digits are not normalised, so the total shows «ناعدد» (NaN)
//   focus     removing a car from the comparison drops keyboard focus on the floor instead of moving it
//   focus-query  the same, while the removal also rewrites the query string, as a filter kept in the address does
//   stall     recalculating blocks the main thread for 1.5 s
//   a11y      the verification badge is an image without a text alternative
//   load      the page throws while it loads
//
// «حذف همه خودروها» is a guard, not a defect: it throws whenever it is pressed, so a gorilla that ever presses a
// control named like deleting (DEFAULT_DENY), by tap or by keyboard, fails the clean-page self-check.

const defects = new Set(new URLSearchParams(location.search).getAll('defect'));
const byId = (id) => document.getElementById(id);
const faNumber = new Intl.NumberFormat('fa-IR');
const MONTHS_PER_PERIOD = 6;
const MAX_PERIODS = 999;
let monthlyInstallment = 45000;
let periods = 2;
let adds = 0;

if (defects.has('overflow')) document.body.classList.add('defect-overflow');

const toLatinDigits = (text) =>
  text
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));

function parsePeriods(raw) {
  if (defects.has('garbage')) return Number(raw);
  const value = Number(toLatinDigits(raw.trim()));
  return Number.isInteger(value) && value >= 1 ? Math.min(value, MAX_PERIODS) : null;
}

function showTotal() {
  byId('total').textContent = `${faNumber.format(periods * MONTHS_PER_PERIOD * monthlyInstallment)} تومان`;
}

function showPeriods() {
  byId('periods').value = faNumber.format(periods);
  showTotal();
}

byId('decrement').addEventListener('click', () => {
  periods = Math.max(1, periods - 1);
  showPeriods();
});

byId('increment').addEventListener('click', () => {
  periods = Math.min(MAX_PERIODS, periods + 1);
  showPeriods();
});

byId('periods').addEventListener('input', (event) => {
  const parsed = parsePeriods(event.target.value);
  if (parsed === null) {
    byId('periods-hint').textContent = 'تعداد را با رقم وارد کنید؛ هر دوره ۶ ماه';
    return;
  }
  byId('periods-hint').textContent = 'هر دوره ۶ ماه';
  periods = parsed;
  showTotal();
});

byId('add').addEventListener('click', () => {
  adds += 1;
  if (defects.has('throw') && adds === 3)
    throw new Error('planted defect: the third add to comparison throws');
  byId('compare-status').textContent = `${faNumber.format(adds)} بار به مقایسه افزوده شد`;
});

byId('recalculate').addEventListener('click', () => {
  if (defects.has('stall')) {
    const end = performance.now() + 1500;
    while (performance.now() < end) {
      // planted defect: busy-wait on the main thread
    }
  }
  showTotal();
});

byId('refresh-prices').addEventListener('click', async () => {
  const url = defects.has('request') ? '/lab/prices-missing.json' : '/lab/prices.json';
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    monthlyInstallment = (await response.json()).monthlyInstallment;
    showTotal();
    byId('compare-status').textContent = 'قیمت‌ها به‌روز شد';
  } catch {
    byId('compare-status').textContent = 'قیمت‌ها به‌روز نشد؛ دوباره تلاش کنید';
  }
});

byId('dealer-name').addEventListener('input', (event) => {
  byId('dealer-preview').textContent = event.target.value;
});

const BADGE =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#1f5c4d"/></svg>',
  );

byId('show-badge').addEventListener('click', () => {
  const image = document.createElement('img');
  image.src = BADGE;
  image.width = 24;
  image.height = 24;
  if (!defects.has('a11y')) image.alt = 'نمایشگاه تأییدشده';
  byId('badge-slot').replaceChildren(image);
});

for (const button of document.querySelectorAll('.remove')) {
  button.addEventListener('click', () => {
    const item = button.closest('li');
    if (defects.has('focus') || defects.has('focus-query')) {
      item.remove();
      if (defects.has('focus-query')) {
        const address = new URL(location.href);
        address.searchParams.set('compared', String(byId('compared').children.length));
        history.pushState(null, '', address);
      }
      return;
    }
    const next = item.nextElementSibling ?? item.previousElementSibling;
    item.remove();
    if (byId('compared').children.length === 0) byId('compared-empty').hidden = false;
    (next?.querySelector('button') ?? byId('compared-title')).focus();
  });
}

byId('clear-all').addEventListener('click', () => {
  throw new Error('deny-list breached: the gorilla pressed «حذف همه خودروها»');
});

showPeriods();

if (defects.has('load')) throw new Error('planted defect: the page throws while loading');
