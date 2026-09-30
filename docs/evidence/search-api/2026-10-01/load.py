# Load for CS-59 criterion 4: a mix of searches against GET /api/search on the production build.
import json, random, sys, time, urllib.request, urllib.parse, threading, statistics
B = 'http://127.0.0.1:3159/api/search?'
random.seed(59)
SORTS = ['best_deal', 'price_asc', 'price_desc', 'mileage_asc', 'newest', 'year_desc']
CATS = ['karshenas-pick','great-deals-under-1b','clean-and-easy','family','low-mileage','automatic','ride-hailing','installments','newest']
MODELS = ['peugeot.206','peugeot.207i','peugeot.pars','dena.plus','samand.soren','peugeot.405','quick.manual','pride.131','toyota.corolla','samand.lx']
WORDS = ['پژو ۲۰۶','پژو 206 تیپ 2','کرولا','کرلا','corolla','peugeot pars','dena plus','سمند','پراید ۱۳۱','۴۰۵','دنا پلاس توربو','تيپ ۵','اتوماتیک','پارس ELX','کوییک','کوئیک','سورن','بدون رنگ','۱۴۰۰','pezho']
def one():
    r = random.random()
    p = {}
    if r < 0.15: pass
    elif r < 0.30: p['catalogue'] = random.choice(CATS)
    elif r < 0.55: p['model'] = random.choice(MODELS)
    elif r < 0.70: p['q'] = random.choice(WORDS)
    elif r < 0.80: p['make'] = random.choice(['peugeot','iran-khodro','saipa','toyota','quick']); p['price'] = '..%d' % random.choice([600,800,1000,1500]) + '000000'
    elif r < 0.90: p['model'] = random.choice(MODELS); p['year'] = '%d..' % random.choice([1390,1395,1398,1400]); p['nopaint'] = '1'
    else: p['q'] = random.choice(WORDS); p['catalogue'] = random.choice(CATS)
    if random.random() < 0.5: p['sort'] = random.choice(SORTS)
    if random.random() < 0.3: p['facets'] = '1'
    return urllib.parse.urlencode(p)
def get(q):
    t = time.perf_counter()
    with urllib.request.urlopen(B + q) as res:
        body = json.load(res)
    return (time.perf_counter() - t) * 1000, body
def client(n, out):
    for _ in range(n):
        q = one()
        ms, body = get(q)
        out.append(ms)
        # Half the searches read one or two more pages through the cursor.
        cur = body.get('nextCursor')
        for _ in range(random.choice([0, 0, 1, 2])):
            if not cur: break
            ms, body = get(q + '&cursor=' + cur)
            out.append(ms); cur = body.get('nextCursor')
def run(clients, per):
    out = []
    ts = [threading.Thread(target=client, args=(per, out)) for _ in range(clients)]
    t = time.perf_counter()
    for th in ts: th.start()
    for th in ts: th.join()
    wall = time.perf_counter() - t
    out.sort()
    pct = lambda p: out[min(len(out) - 1, int(p / 100 * len(out)))]
    return {'clients': clients, 'requests': len(out), 'p50_ms': round(pct(50), 1), 'p95_ms': round(pct(95), 1), 'p99_ms': round(pct(99), 1), 'max_ms': round(out[-1], 1), 'per_second': round(len(out) / wall, 1)}
for i in range(20): get(one())  # warm up
print(json.dumps(run(1, 400)))
print(json.dumps(run(8, 100)))
