import sys, glob
from fontTools.ttLib import TTFont
files = sys.argv[1:]
for f in files:
    t = TTFont(f)
    upm = t['head'].unitsPerEm
    hh = t['hhea']; os2 = t['OS/2']
    name = t['name'].getDebugName(4)
    ver = t['name'].getDebugName(5)
    use_typo = bool(os2.fsSelection & (1<<7))
    head = t['head']
    print(f"== {f}\n  name={name!r} version={ver!r} upm={upm}")
    print(f"  hhea: ascent={hh.ascent} descent={hh.descent} lineGap={hh.lineGap}  sum={(hh.ascent-hh.descent+hh.lineGap)} ({(hh.ascent-hh.descent+hh.lineGap)/upm:.3f} em)")
    print(f"  OS/2 typo: asc={os2.sTypoAscender} desc={os2.sTypoDescender} gap={os2.sTypoLineGap} sum={(os2.sTypoAscender-os2.sTypoDescender+os2.sTypoLineGap)} ({(os2.sTypoAscender-os2.sTypoDescender+os2.sTypoLineGap)/upm:.3f} em) USE_TYPO_METRICS={use_typo}")
    print(f"  OS/2 win: asc={os2.usWinAscent} desc={os2.usWinDescent} sum={os2.usWinAscent+os2.usWinDescent} ({(os2.usWinAscent+os2.usWinDescent)/upm:.3f} em)")
    print(f"  head bbox: yMin={head.yMin} yMax={head.yMax}")
    xh = getattr(os2,'sxHeight',None); ch = getattr(os2,'sCapHeight',None)
    print(f"  xHeight={xh} capHeight={ch} OS/2 version={os2.version}")
    # features
    feats=set()
    for tag in ('GSUB','GPOS'):
        if tag in t:
            fl = t[tag].table.FeatureList
            if fl:
                for fr in fl.FeatureRecord: feats.add(fr.FeatureTag)
    print(f"  features: {sorted(feats)}")
    # scripts / languages
    if 'GSUB' in t:
        sl = t['GSUB'].table.ScriptList
        s = []
        for sr in sl.ScriptRecord:
            langs = [lr.LangSysTag for lr in sr.Script.LangSysRecord]
            s.append(f"{sr.ScriptTag}:{langs}")
        print(f"  GSUB scripts: {s}")
    if 'fvar' in t:
        print("  fvar axes:", [(a.axisTag,a.minValue,a.defaultValue,a.maxValue) for a in t['fvar'].axes])
