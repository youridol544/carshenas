"""Palette lab: OKLCH -> sRGB, WCAG 2 contrast, greyscale and deuteranopia checks.

Conversion formulas: Björn Ottosson, "A perceptual color space for image processing" (2020), and CSS Color 4.
Deuteranopia: Machado, Oliveira and Fernandes (2009), severity 1.0 matrix.
"""
import math, json, sys

def oklch_to_oklab(L, C, h):
    hr = math.radians(h)
    return L, C * math.cos(hr), C * math.sin(hr)

def oklab_to_linear_srgb(L, a, b):
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    return (
        +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    )

def in_gamut(rgb, eps=1e-4):
    return all(-eps <= c <= 1 + eps for c in rgb)

def oklch_to_linear(L, C, h):
    """Linear sRGB, reducing chroma until the colour is inside the sRGB gamut (CSS Color 4 does the same in spirit)."""
    lo, hi = 0.0, C
    rgb = oklab_to_linear_srgb(*oklch_to_oklab(L, C, h))
    if in_gamut(rgb):
        return rgb, C
    for _ in range(40):
        mid = (lo + hi) / 2
        if in_gamut(oklab_to_linear_srgb(*oklch_to_oklab(L, mid, h))):
            lo = mid
        else:
            hi = mid
    return oklab_to_linear_srgb(*oklch_to_oklab(L, lo, h)), lo

def encode(c):
    c = min(1.0, max(0.0, c))
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055

def decode(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def to_hex(lin):
    return '#' + ''.join(f'{round(encode(c) * 255):02x}' for c in lin)

def luminance_from_hex(hx):
    r, g, b = (decode(int(hx[i:i + 2], 16) / 255) for i in (1, 3, 5))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def contrast(hx1, hx2):
    a, b = luminance_from_hex(hx1), luminance_from_hex(hx2)
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)

MACHADO_DEUTAN = [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.011820, 0.042940, 0.968881],
]

def deutan_hex(hx):
    lin = [decode(int(hx[i:i + 2], 16) / 255) for i in (1, 3, 5)]
    sim = [sum(MACHADO_DEUTAN[r][c] * lin[c] for c in range(3)) for r in range(3)]
    return to_hex(sim)

def grey_l(hx):
    """CIE L* of the colour's luminance: what a greyscale screenshot shows."""
    y = luminance_from_hex(hx)
    return 116 * (y ** (1 / 3)) - 16 if y > 216 / 24389 else y * 24389 / 27

def resolve(spec):
    L, C, h = spec
    lin, c_used = oklch_to_linear(L, C, h)
    return to_hex(lin), c_used

if __name__ == '__main__':
    palette = json.load(open(sys.argv[1]))
    hexes = {}
    for name, spec in palette['colors'].items():
        hx, c_used = resolve(spec)
        hexes[name] = hx
        clipped = '' if abs(c_used - spec[1]) < 1e-3 else f'  (chroma clipped to {c_used:.3f})'
        print(f'{name:<28} oklch({spec[0]:.3f} {spec[1]:.3f} {spec[2]:g})  {hx}{clipped}')
    print()
    print('Pairs (WCAG 2 contrast):')
    for fg, bg, need in palette['pairs']:
        r = contrast(hexes[fg], hexes[bg])
        flag = 'ok ' if r >= need else 'FAIL'
        print(f'  {flag} {r:5.2f}:1  (need {need})  {fg} on {bg}')
    if 'ramp' in palette:
        print()
        print('Deal ramp: greyscale L* and deuteranopia simulation:')
        prev = None
        for name in palette['ramp']:
            hx = hexes[name]
            gl = grey_l(hx)
            dh = deutan_hex(hx)
            step = '' if prev is None else f'  step {gl - prev:+.1f}'
            print(f'  {name:<22} {hx}  grey L* {gl:5.1f}{step}   deutan {dh} (L* {grey_l(dh):5.1f})')
            prev = gl
