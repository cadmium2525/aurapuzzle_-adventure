"""Pack the five generated badge illustrations into the runtime WebP atlas."""
from pathlib import Path
import sys
from PIL import Image

NAMES = ['buildUp', 'resolve', 'auraAbsorb', 'comboGuard', 'shapeGuard']
output = Path(__file__).resolve().parents[1] / 'assets' / 'battle'
atlas = Image.new('RGBA', (640, 128))
for index, name in enumerate(NAMES):
    source = Path(sys.argv[index + 1]) if len(sys.argv) == 6 else output / f'badge_{name}.webp'
    image = Image.open(source).convert('RGBA')
    bounds = image.getchannel('A').getbbox()
    if not bounds:
        raise ValueError(f'Empty badge: {name}')
    image = image.crop(bounds)
    image.thumbnail((120, 120), Image.Resampling.LANCZOS)
    cell = Image.new('RGBA', (128, 128))
    cell.alpha_composite(image, ((128-image.width)//2, (128-image.height)//2))
    if len(sys.argv) == 6:
        cell.save(output / f'badge_{name}.webp', quality=92, method=6)
    atlas.alpha_composite(cell, (index*128, 0))
atlas.save(output / 'enemy_badges.webp', quality=92, method=6)
print('Saved', output / 'enemy_badges.webp')
