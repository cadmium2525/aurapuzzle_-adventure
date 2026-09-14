# 敵状態バッジ

ImageGen built-in / stylized-concept で個別生成。5つの画像を `scripts/build-enemy-badges.py` で128pxセルの640×128 WebPアトラスへ統合。実行時は `enemy_badges.webp` のみ参照。

生成プロンプト（共通、Subjectは下記の各記述へ置換）:

```text
Use case: stylized-concept
Asset type: transparent square fantasy mobile RPG enemy status badge
Primary request: One centered circular jeweled badge showing {Subject}.
Style: premium anime fantasy UI, polished dimensional metal and crystalline enamel, bold easily recognized central silhouette, restrained gold rim. Readable at 36 pixels.
Composition: square, single circular medallion occupying 85% of image, transparent padding, truly transparent background.
Constraints: no letters, no numbers, no text, no watermark, no additional badges.
```

アトラス順とSubject:

1. buildUp: a crimson crossed-sword crest with rising fiery wings, representing doubled attack
2. resolve: a golden unbroken heart protected by phoenix wings, representing survival of a fatal blow
3. auraAbsorb: a violet inward-spiraling vortex swallowing a luminous cyan pearl, representing aura absorption
4. comboGuard: a sapphire shield with three linked chain rings, representing a chain-count damage barrier
5. shapeGuard: an emerald shield bearing five luminous gems arranged in an L shape, representing a required matching shape

バッジの絵は効果の種別を示す。対象オーラ・残りターンは補助表示、具体的なチェイン条件や形状はタップ時の説明で確認する。
