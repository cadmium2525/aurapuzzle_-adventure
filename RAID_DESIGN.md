# 九狐降臨

導線：ホーム → ダンジョン → 降臨ダンジョン → 九狐降臨の詳細 → バトルスタート → 既存のサポート選択 → 戦闘。カテゴリー順はノーマル・降臨・曜日・トレーニング。

編成・セリフ・敵スキル・数値は `src/js/data/raids.js`、複数敵の独立状態は `src/js/battle/encounter.js`、登場演出は `raid-presentation.js`。

## 初期バランス（未指定値の仮設定）

消費スタミナ30、コイン9,000、プレイヤー経験値180、キャラ経験値600。ダイヤ報酬なし。ノーマル／ハード分岐やランク制限なし。

| 敵 | HP | 攻撃 | 間隔 |
|---|---:|---:|---:|
| モノリス | 4,200 | 90 | 2 |
| ワーム | 4,800 | 110 | 2 |
| ギアセンチネル | 4,600 | 100 | 2 |
| ゴーレム | 6,200 | 105 | 2 |
| ボルトウルフ | 4,000 | 85 | 1 |
| コンゴウ | 14,500 | 160 | 2 |
| キュウコ進化前 | 18,000 | 120 | 1 |
| キュウコ進化後 | 26,000 | 145 | 1 |
| 分身体（2体） | 各13,000 | 攻撃しない | — |

敵はそれぞれ独立したHP・行動カウント・防御効果を持つ。タップで対象を選択し、その手番の全攻撃を選択対象へ与える。倒した敵への余剰ダメージは他の敵に移さない。対象撃破後は生存している敵を自動選択する。

コンボガード（5チェイン）は5以下を無効化し、6以上で通る。根性の解除閾値は最大HPの50%以下。ゴーレムの攻撃上昇は50%未満で一度だけ発動。敵のランダム行動は候補間で等確率。

同種の操作時間短縮・固定は重複加算せず後の行動で更新する。バインドは同じ対象なら残りターンの長い方を維持。既存のターン管理に従い、付与直後には効果時間を消費しない。

8F撃破後はアラート → 9Fの姿 → セリフ → 先制。9F撃破後は画面全体の白光 → 10Fの姿 → セリフ → 先制（常時ガード・根性・左右の分身体）。分身体が生存中に本体を狙った攻撃は分身体へ向かう。両分身体の撃破後、本体が一度だけビルドアップする。演出・敵の行動中は操作を受け付けない。

## プレイアブルと周回

キュウコ `dk_kyuko` は闇属性★3、★4「九尾の幻姫・キュウコ」へ1段階進化。ガチャ・通常ショップの排出対象から除外。通常と同じレベル・進化素材のシステムで育成・編成できる。

- 初期LS：闇1.6倍、操作時間+1秒。
- 進化LS：闇1.9倍、操作時間+2秒、最終6チェイン以上で攻撃1.3倍。
- 初期スキル：木→闇、当ターン操作時間+2秒（CT12）。
- 進化スキル：木→闇、当ターン操作時間+3秒、2ターン攻撃1.5倍（CT11）。

撃破時の基本ドロップ率50%。自陣に編成した降臨キャラの開眼効果を加算し、最大100%。サポート枠は加算対象外。効果は降臨キャラクターのドロップ抽選に適用する（通常素材の抽選は変更しない）。キュウコ単体の開眼10で50%→70%。

降臨キャラの開眼は最大10、各段階+2ポイント。消費する同キャラ数は順に **1 / 2 / 3 / 5 / 8 / 12 / 18 / 25 / 35 / 50**（累計159体、本体1体は保持）。周回で集める設計のため開眼の証は使用不可。通常キャラの上限4・消費1体・開眼の証ルートは維持する。進化・保存・再ロードでも開眼10を保持。

## イラスト

内蔵ImageGen（stylized-concept）で生成。成果物：`assets/chars/kyuko_1.webp`, `kyuko_2.webp`, それぞれの `_icon.webp`。敵とプレイアブルは同じ絵を使い、分身体は進化後の絵を左右に配置。

初期生成プロンプト：

```text
Use case: stylized-concept
Asset type: transparent full-body character sprite for premium anime fantasy RPG
Subject: Kyuko, an adult female fox yokai disguised as a bewitchingly beautiful human woman. Long flowing silver-white hair, amber eyes, mischievous knowing smile, elegant crimson and black embroidered kimono, golden fox hair ornament, holding a half-open folding fan near her lips. A subtle single white fox tail peeks from behind her dress, violet foxfire wisps around feet. Tasteful alluring elegance, fully dressed, adult.
Composition: one centered full-body character, entire costume and effects inside frame with clear transparent padding, square canvas. Rich detailed painterly anime game illustration, crisp face, luminous silk, matching Japanese fantasy collectible character art.
Constraints: actual transparent background, no scenery, no text, no logo, no border, no other characters.
```

進化後生成プロンプト（初期絵を参照画像として添付）：

```text
Use case: stylized-concept. Reference image is Kyuko's original character appearance; preserve her adult face, silver-white hair, amber eyes, crimson and black embroidered kimono and golden ornament. Generate her evolved final boss form: full-body regal nine-tailed fox spirit woman, exactly nine large white fox tails fanning behind her, violet and gold foxfire wreath, floating slightly, confidently extending one hand, fan in the other. Luxurious intricate Japanese fantasy anime collectible character illustration. Whole body, tails and magic fit inside square canvas with transparent padding. Truly transparent background, no scenery, no text, no frame, no additional people. Same recognizable adult character, more majestic power, elegant fully dressed.
```

検証：`node --test tests/*.test.mjs`、Playwrightの `scripts/check-raids.cjs` と既存 `scripts/check-enemy-skills.cjs`。降臨ブラウザ検証は演出待ち時間と与ダメージをテスト用に短縮・増加し、全10Fの進行／ドロップ／育成を検証する。通常プレイの難易度を保証するものではなく、数値バランスは実プレイで継続調整する。
