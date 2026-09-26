// Fixture behaviour: one JSON request, Persian digits, a Jalali date and a tiny saved-listings list.
const number = new Intl.NumberFormat('fa-IR');
const year = new Intl.NumberFormat('fa-IR', { useGrouping: false });
const date = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const list = document.querySelector('#listings');
const status = document.querySelector('#status');
const saved = document.querySelector('#saved');
const savedCount = document.querySelector('#saved-count');
let savedListings = 0;

document.querySelector('#today').textContent = date.format(new Date());

function save(listing) {
  savedListings += 1;
  savedCount.textContent = number.format(savedListings);
  saved.setAttribute('aria-label', `نشان‌شده‌ها، ${number.format(savedListings)} آگهی`);
  status.textContent = `«${listing.title}» نشان شد.`;
}

function card(listing) {
  const li = document.createElement('li');
  li.innerHTML = `
    <article class="card">
      <h2></h2>
      <p class="meta"></p>
      <p class="price">قیمت: <span></span> تومان</p>
      <p class="mileage">کارکرد: <span></span> کیلومتر</p>
      <button type="button"></button>
    </article>`;
  li.querySelector('h2').textContent = listing.title;
  li.querySelector('.meta').textContent = `${listing.city}، مدل ${year.format(listing.modelYear)}`;
  li.querySelector('.price span').textContent = number.format(listing.askingPrice);
  li.querySelector('.mileage span').textContent = number.format(listing.mileageKm);
  const button = li.querySelector('button');
  button.textContent = 'نشان کردن';
  button.setAttribute('aria-label', `نشان کردن ${listing.title}`);
  button.addEventListener('click', () => save(listing));
  return li;
}

try {
  // The query value and header are fake. They exist so the site-capture redaction test has something to catch.
  const response = await fetch('/api/listings.json?session=fixture-secret-query-123', {
    headers: { authorization: 'Bearer fixture-secret-header-456' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const listings = await response.json();
  list.append(...listings.map(card));
  status.textContent = `${number.format(listings.length)} آگهی`;
} catch (error) {
  status.textContent = 'بارگذاری آگهی‌ها ناموفق بود.';
  console.error('listings failed to load', error);
}

// The map is a hand-written stub: it lets the site-capture tests prove package extraction from public source maps.
//# sourceMappingURL=app.js.map
