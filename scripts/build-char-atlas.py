"""キャラクターアイコンを1枚のアトラスにまとめる。

一覧画面ではアイコンを数十枚まとめて並べるので、1枚ずつ <img> で読むと
リクエストが増えて初回表示が重い。ここで格子状の1枚絵に焼き、
CSS の background-position で切り出して使う(アイテムアトラスと同じ仕組み)。

  python3 scripts/build-char-atlas.py

assets/chars/*_icon.webp を集めて
  assets/chars/char_atlas.webp   … アトラス本体
  src/js/data/char-atlas.js      … 元のパス → 格子位置の索引
を書き出す。キャラクターやイラストを足したら、もう一度実行すること。
"""

from pathlib import Path

from PIL import Image

CELL = 128        # 1マスの辺。一覧は最大64px程度なので2倍解像度で足りる
COLUMNS = 8
ROOT = Path(__file__).resolve().parents[1]
CHARS = ROOT / 'assets' / 'chars'
ATLAS = CHARS / 'char_atlas.webp'
INDEX = ROOT / 'src' / 'js' / 'data' / 'char-atlas.js'


def squared(source: Path) -> Image.Image:
    """画面の object-fit:cover と同じ見え方になるよう、中央で正方形に切ってから縮める。"""
    image = Image.open(source).convert('RGBA')
    side = min(image.width, image.height)
    left = (image.width - side) // 2
    top = (image.height - side) // 2
    image = image.crop((left, top, left + side, top + side))
    return image.resize((CELL, CELL), Image.Resampling.LANCZOS)


def main() -> None:
    sources = sorted(CHARS.glob('*_icon.webp'))
    if not sources:
        raise SystemExit(f'アイコンが見つかりません: {CHARS}')

    rows = -(-len(sources) // COLUMNS)
    atlas = Image.new('RGBA', (CELL * COLUMNS, CELL * rows), (0, 0, 0, 0))
    entries = []
    for i, source in enumerate(sources):
        col, row = i % COLUMNS, i // COLUMNS
        atlas.alpha_composite(squared(source), (col * CELL, row * CELL))
        entries.append((f'assets/chars/{source.name}', col, row))
    atlas.save(ATLAS, 'WEBP', quality=90, method=6)

    lines = ',\n'.join(f"  '{path}': [{col}, {row}]" for path, col, row in entries)
    INDEX.write_text(
        '/* =========================================================\n'
        ' * char-atlas.js — キャラクターアイコンの格子位置\n'
        ' *\n'
        ' * scripts/build-char-atlas.py が生成する。手で編集しない。\n'
        ' * イラストを足したらスクリプトを流し直すこと。\n'
        ' * =======================================================*/\n'
        f'export const CHAR_ATLAS_SRC = \'assets/chars/{ATLAS.name}\';\n'
        f'export const CHAR_ATLAS_COLUMNS = {COLUMNS};\n'
        f'export const CHAR_ATLAS_ROWS = {rows};\n\n'
        '/** 元のアイコンのパス → [列, 行] */\n'
        'export const CHAR_ATLAS = {\n'
        f'{lines}\n'
        '};\n',
        encoding='utf-8')

    size = ATLAS.stat().st_size
    print(f'{ATLAS}: {atlas.width}x{atlas.height} / {len(entries)}枚 / {size / 1024:.0f}KB')
    print(f'{INDEX}: 索引を更新')


if __name__ == '__main__':
    main()
