"""Pack eight generated status illustrations into a small alpha-preserving WebP atlas.

Order: timeReduce, timeFixed, timeExtend, bind, auraBind, attack, guard, skillDelay.
Only deterministic sizing/packing; original illustrations are left untouched.
"""
import sys
from pathlib import Path
from PIL import Image

if len(sys.argv) != 9:
    raise SystemExit('Provide eight generated image paths in the documented order')
atlas = Image.new('RGBA', (1024, 128))
for index, source in enumerate(sys.argv[1:]):
    art = Image.open(source).convert('RGBA')
    art.thumbnail((128, 128), Image.Resampling.LANCZOS)
    atlas.alpha_composite(art, (index * 128 + (128-art.width)//2, (128-art.height)//2))
target = Path(__file__).resolve().parents[1] / 'assets/battle/player_badges.webp'
atlas.save(target, quality=90, method=6)
print(f'{target}: {target.stat().st_size} bytes')
