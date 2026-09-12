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
