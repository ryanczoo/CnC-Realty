"""Lossless axis trim for GoogleSansFlex.

fontTools' instancer pins wdth/GRAD/ROND at their defaults correctly but re-encodes
every remaining gvar tuple (IUP re-optimisation or explicit rounded deltas), which
shifts a few antialiased pixels. Here the instancer output is kept for every table
except gvar; gvar is rebuilt from the ORIGINAL font by dropping only the tuples that
touch a pinned axis (their scalar at the default location is 0) and keeping every
other tuple byte-for-byte, sparse points included.

The site only uses the wght and opsz axes (opsz is applied automatically by the
browser) plus slnt (Chrome draws font-style: italic with it), so wdth/GRAD/ROND are
pinned. 1,887,540 -> 271,536 bytes; renders pixel-identical (2026-10-16).

Recipe (needs: pip install fonttools brotli):
  python -m fontTools.varLib.instancer orig.woff2 wdth=100 GRAD=0 ROND=0 -o inst.ttf
  python trim-google-sans-flex.py orig.woff2 inst.ttf GoogleSansFlex.woff2 wdth,GRAD,ROND
The untrimmed original is in git history (apps/web/src/app/fonts/GoogleSansFlex.woff2
before this change).
"""
import sys
from fontTools.ttLib import TTFont

orig_path, inst_path, out_path, pinned_arg = sys.argv[1:5]
pinned = set(pinned_arg.split(","))

orig = TTFont(orig_path)
inst = TTFont(inst_path)

kept_axes = {a.axisTag for a in inst["fvar"].axes}
assert not (kept_axes & pinned), (kept_axes, pinned)


def touches_pinned(tv):
    # An axis with peak 0 contributes a factor of 1 everywhere, so it doesn't count.
    for tag, (start, peak, end) in tv.axes.items():
        if peak != 0 and tag in pinned:
            # Region must exclude 0 for the scalar at the default to be 0.
            assert not (start < 0 < end), (tag, start, peak, end)
            return True
    return False


src = orig["gvar"]
dropped = kept = 0
new_vars = {}
for glyph, tvs in src.variations.items():
    keep = []
    for tv in tvs:
        if touches_pinned(tv):
            dropped += 1
        else:
            # Strip zero-peak entries for axes no longer in fvar.
            tv.axes = {t: v for t, v in tv.axes.items() if t in kept_axes}
            keep.append(tv)
            kept += 1
    new_vars[glyph] = keep

assert inst.getGlyphOrder() == orig.getGlyphOrder(), "glyph order changed"
gvar = inst["gvar"]
gvar.variations = new_vars
print(f"gvar tuples kept {kept}, dropped {dropped}")

inst.flavor = "woff2"
inst.save(out_path)
