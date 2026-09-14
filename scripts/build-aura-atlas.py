from pathlib import Path

from PIL import Image

CELL = 256
PADDING = 10
NAMES = ('fire', 'water', 'wood', 'heal', 'dark')


def normalized(source: str) -> Image.Image:
    image = Image.open(source).convert('RGBA')
    alpha_box = image.getchannel('A').getbbox()
    if not alpha_box:
        raise ValueError(f'Image has no visible pixels: {source}')
    image = image.crop(alpha_box)
    limit = CELL - PADDING * 2
    scale = min(limit / image.width, limit / image.height)
    size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    image = image.resize(size, Image.Resampling.LANCZOS)
    cell = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    cell.alpha_composite(image, ((CELL - size[0]) // 2, (CELL - size[1]) // 2))
    return cell


def main() -> None:
    output = Path(__file__).resolve().parents[1] / 'assets' / 'battle'
    cells = [normalized(output / f'aura_{name}.webp') for name in NAMES]
    atlas = Image.new('RGBA', (CELL * len(cells), CELL), (0, 0, 0, 0))
    for index, cell in enumerate(cells):
        atlas.alpha_composite(cell, (index * CELL, 0))
    atlas.save(output / 'aura_atlas.webp', 'WEBP', quality=92, method=6)
    print(f'{output / "aura_atlas.webp"}: {atlas.width}x{atlas.height}')


if __name__ == '__main__':
    main()
