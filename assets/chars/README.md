# キャラクターイラストの置き場所

このフォルダに画像を置くと、ゲーム内のアイコン・立ち絵として自動的に使われます。
**画像が無い場合は絵文字にフォールバック**するので、置かなくてもゲームは動きます。

## 「不器用なカイ」(`aq_kai_x`)

| ファイル名 | 用途 | 表示される条件 | 推奨 |
| --- | --- | --- | --- |
| `kai_1_icon.webp` | アイコン(初期) | ★4 Lv1〜19 | 正方形・512px程度 |
| `kai_2_icon.webp` | アイコン(覚醒/進化後) | ★4 Lv20以上 と ★5 | 正方形・512px程度 |
| `kai_1.webp`      | 立ち絵(初期) | ★4 のあいだ | 背景透過・1024px程度 |
| `kai_2.webp`      | 立ち絵(進化後) | ★5(進化後) | 背景透過・1024px程度 |

アイコンは丸みのある正方形に切り抜かれて表示されます。
立ち絵はキャラクター詳細モーダルで全体が表示されるため、背景透過の画像が向いています。
形式は **WebP を推奨**(透過に対応していて、同じ見た目でもPNGの2割程度のファイルサイズになる)。
PNG / JPEG でも動くので、拡張子に合わせて `characters.js` のパスを書き換えてください。

## ★4の3人(`fl_gald_x` / `aq_mio_x` / `wd_noa_x`)

ガルド / ミオ / ノアも同じ3段階の構成。カイと同様、`_1` が★4のあいだ、
`_2` が★5(進化後)の立ち絵で、アイコンだけ Lv20 の覚醒で先に切り替わる。

| キャラ | 初期アイコン | 覚醒・進化アイコン | ★4立ち絵 | ★5立ち絵 |
| --- | --- | --- | --- | --- |
| ガルド | `garudo_1_icon.webp` | `garudo_2_icon.webp` | `garudo_1.webp` | `garudo_2.webp` |
| ミオ | `mio_1_icon.webp` | `mio_2_icon.webp` | `mio_1.webp` | `mio_2.webp` |
| ノア | `noa_1_icon.webp` | `noa_2_icon.webp` | `noa_1.webp` | `noa_2.webp` |

## ★1キャラ(`fl_rito` / `aq_mio` / `wd_noa` / `lm_mina`)

★1スタートのキャラは、★1のあいだと★2へ進化したあとの2段階。
`characters.js` の `twoStageArt()` が下の命名から自動で組み立てる。

| キャラ | ★1 | ★2(進化後) |
| --- | --- | --- |
| リト | `rito_1.webp` / `rito_1_icon.webp` | `rito_2.webp` / `rito_2_icon.webp` |
| シズク | `shizuku_1.webp` / `shizuku_1_icon.webp` | `shizuku_2.webp` / `shizuku_2_icon.webp` |
| クルト | `kuruto_1.webp` / `kuruto_1_icon.webp` | `kuruto_2.webp` / `kuruto_2_icon.webp` |
| ミナ | `mina_1.webp` / `mina_1_icon.webp` | `mina_2.webp` / `mina_2_icon.webp` |

## 他のキャラクターにイラストを付ける

`src/js/data/characters.js` の `mk(...)` の最後の引数に `artStages` を渡します。
`star` と `minLevel` の条件を満たすもののうち、**最後に一致したもの**が使われます。

```js
mk('fl_aina', 'アイナ', '紅蓮の剣士', '👩‍🦰', 0, 3, 'attacker', 'ls_blaze', 'sk_flamewave', {
  artStages: [
    { star: 3, minLevel: 1,  icon: 'assets/chars/aina_1_icon.webp', full: 'assets/chars/aina_1.webp', label: '初期' },
    { star: 4, minLevel: 1,  icon: 'assets/chars/aina_2_icon.webp', full: 'assets/chars/aina_2.webp', label: '進化' }
  ]
})
```
