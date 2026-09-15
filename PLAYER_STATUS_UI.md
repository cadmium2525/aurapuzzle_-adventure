# バトル状態アイコン・全画面セリフ

- セリフはネイティブ dialog の全画面モーダル。盤面のレイアウト領域は使わない。
- 敵の立ち絵・名前・セリフを表示し、自動進行。タップまたは「次へ」で早送り可能。
- 全体状態は敵エリア内の左上に重ねる横スクロール式アイコン列。盤面の上に説明行を追加しない。
- 個別のバインド・スキル遅延は対象の味方アイコン左下。スキルボタンとは独立してタップできる。
- 数字は残りターン。アイコンをタップすると説明を表示する。
- スキル遅延アイコンの数字は追加された遅延の残量。通常のスキル待機ターンは右上で合計を表示する。
- 攻撃力アップ・ダメージ軽減・操作時間延長は一時的なスキル効果を表示。リーダースキルの常時倍率は従来のパーティ情報で確認する。
- 操作時間固定中は延長アイコンの説明にも「延長無効」を表示する。

## 生成アセット

imagegen スキルの built-in ImageGen モードで8枚を個別生成。
最終アセット: `assets/battle/player_badges.webp`（1024×128、各セル128×128、アルファ保持）。
`scripts/build-player-badges.py` で縮小・パッキングし、単一アトラスを共有する。

### 最終プロンプトセット

以下の共通プロンプトの SUBJECT を各行の内容で置き換えて個別に生成。

> Use case: stylized-concept. Asset type: single mobile fantasy RPG status icon. Primary request: SUBJECT Style: premium painted jewel-like fantasy UI badge with ornate gold circular rim, dark interior, strong readable silhouette even at 28 pixels. Composition: one centered circular medallion, 12% padding on all sides. Transparent background, preserve actual alpha. No text, letters, numbers, watermark, or other icons. Square image.

|順|効果|SUBJECT|
|---|---|---|
|0|操作時間減少|A crimson hourglass with sand draining downward and a clear downward arrow, time reduction curse.|
|1|操作時間固定|An icy blue hourglass locked by a golden padlock, fixed operation time.|
|2|操作時間延長|An emerald hourglass with an upward golden arrow, bonus operation time.|
|3|バインド|Purple spectral chains tightly wrapped around a silver gauntlet, character immobilization curse.|
|4|オーラバインド|A violet luminous crystal orb wrapped in dark golden chains and a padlock, aura cannot be erased.|
|5|攻撃力アップ|A flaming ruby sword pointing upward, party attack power enhancement.|
|6|ダメージ軽減|A sapphire shield encircled by a protective cyan magical halo, damage reduction protection.|
|7|スキル遅延|A violet magical spellbook with a small backward curving arrow and hourglass, delayed skill cooldown.|

## 検証

`node --test tests/*.test.mjs` と `scripts/check-enemy-skills.cjs`、`scripts/check-raids.cjs`。
状態アイコン9件表示・モーダル表示中・モーダル終了後で盤面の寸法とY座標が一致することをブラウザで検証する。
