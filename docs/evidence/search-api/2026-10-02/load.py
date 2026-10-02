# Load for CS-59 criterion 4: a mix of searches against GET /api/search on the production build.
#   python3 load.py lane    # the lane's real listings (tracked Divar models)
#   python3 load.py scale   # the synthetic table seed-scale.ts makes (packages/search/scripts)
# The mix: everything, the nine catalogues, models, words (typos, an unknown word), a make and a price, rare filter values,
# count-only calls for a filter sheet (limit=0), a facets request in a third, and one or two more pages by cursor in a
# third. One client, then eight at once. Wall-clock times measured by the client, so they include HTTP and JSON.
import json, random, sys, time, urllib.request, urllib.parse, threading
PROFILE = sys.argv[1] if len(sys.argv) > 1 else 'lane'
BASE = 'http://127.0.0.1:3159/api/search?'
random.seed(59)
SORTS = ['best_deal', 'price_asc', 'price_desc', 'mileage_asc', 'newest', 'year_desc']
CATS = ['karshenas-pick','great-deals-under-1b','clean-and-easy','family','low-mileage','automatic','ride-hailing','installments','newest']
if PROFILE == 'lane':
    MODELS = ['peugeot.206','peugeot.207i','peugeot.pars','dena.plus','samand.soren','peugeot.405','quick.manual','pride.131','toyota.corolla','samand.lx']
    MAKES = ['peugeot','iran-khodro','saipa','toyota','quick']
    WORDS = ['پژو ۲۰۶','پژو 206 تیپ 2','کرولا','کرلا','corolla','peugeot pars','dena plus','سمند','پراید ۱۳۱','۴۰۵','دنا پلاس توربو','تيپ ۵','اتوماتیک','پارس ELX','کوییک','کوئیک','سورن','بدون رنگ','۱۴۰۰','مزدا','تیبا']
    RARE = [{'fuel':'electric'},{'fuel':'hybrid'},{'engine':'needs_repair'},{'chassis':'damaged'},{'body':'crossover'},{'colour':'purple'}]
    COMMON = [{'gearbox':'automatic'},{'seller':'dealer'},{'fuel':'petrol'},{'price':'..1000000000'},{'year':'1400..'}]
else:
    MODELS = ['scale.one','scale.two','scale.three','tiny.four']
    MAKES = ['scale','tiny']
    WORDS = ['سالم','تمیز','خودروی','سالم تمیز','سلام','تمیزز','مزدا','خودروی 1234']
    RARE = [{'fuel':'electric'},{'fuel':'plug_in_hybrid'},{'fuel':'hybrid'},{'body':'crossover'},{'colour':'purple'},{'trim':'scale.one.rare'},{'model':'tiny.four'},{'make':'tiny'},{'district':'tehran.محله 79'},{'city':'scale-city-5'}]
    COMMON = [{'gearbox':'automatic'},{'seller':'dealer'},{'price':'..800000000'},{'year':'1400..'},{'mileage':'..50000'}]
def one():
    r = random.random(); p = {}
    if r < 0.12: pass
    elif r < 0.24: p['catalogue'] = random.choice(CATS)
    elif r < 0.40: p['model'] = random.choice(MODELS)
    elif r < 0.52: p['q'] = random.choice(WORDS)
    elif r < 0.60: p['make'] = random.choice(MAKES); p.update(random.choice(COMMON))
    elif r < 0.72: p.update(random.choice(RARE))
    elif r < 0.80: p.update(random.choice(COMMON)); p.update(random.choice(COMMON))
    elif r < 0.88: p['q'] = random.choice(WORDS); p['catalogue'] = random.choice(CATS)
    else: p.update(random.choice(RARE)); p['sort'] = random.choice(SORTS); p['limit'] = '0'   # a filter sheet's count
    if 'sort' not in p and random.random() < 0.5: p['sort'] = random.choice(SORTS)
    if 'limit' not in p and random.random() < 0.3: p['facets'] = '1'
    return urllib.parse.urlencode(p)
def get(q):
    t = time.perf_counter()
    with urllib.request.urlopen(BASE + q) as res: body = json.load(res)
    return (time.perf_counter() - t) * 1000, body
def client(n, out):
    for _ in range(n):
        q = one(); ms, body = get(q); out.append(ms)
        cur = body.get('nextCursor')
        for _ in range(random.choice([0, 0, 1, 2])):
            if not cur: break
            ms, body = get(q + '&cursor=' + cur); out.append(ms); cur = body.get('nextCursor')
def run(clients, per):
    out = []; ts = [threading.Thread(target=client, args=(per, out)) for _ in range(clients)]
    t = time.perf_counter()
    for th in ts: th.start()
    for th in ts: th.join()
    wall = time.perf_counter() - t; out.sort(); pct = lambda q: out[min(len(out) - 1, int(q / 100 * len(out)))]
    return {'profile': PROFILE, 'clients': clients, 'requests': len(out), 'p50_ms': round(pct(50), 1), 'p95_ms': round(pct(95), 1), 'p99_ms': round(pct(99), 1), 'max_ms': round(out[-1], 1), 'per_second': round(len(out) / wall, 1)}
for i in range(20): get(one())  # warm up
print(json.dumps(run(1, 400)))
print(json.dumps(run(8, 100)))
