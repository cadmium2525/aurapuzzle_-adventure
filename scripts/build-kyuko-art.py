"""Convert generated transparent character art to game-size WebP and portrait crops."""
import sys
from pathlib import Path
from PIL import Image

out = Path(__file__).resolve().parents[1] / 'assets' / 'chars'
for index, source in enumerate(sys.argv[1:3], 1):
    image = Image.open(source).convert('RGBA')
    width, height = image.size
    # Face/shoulders remain near the upper center in both approved compositions.
    portrait = image.crop((int(width*.34), int(height*.035), int(width*.70), int(height*.395)))
    portrait = portrait.resize((256,256), Image.Resampling.LANCZOS)
    portrait.save(out / f'kyuko_{index}_icon.webp', quality=90, method=6)
    image.thumbnail((900,900), Image.Resampling.LANCZOS)
    image.save(out / f'kyuko_{index}.webp', quality=90, method=6)
