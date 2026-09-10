# オーラコネクト・バトル

玉(オーラ)を消してダンジョンを攻略する、ブラウザ/PWA のパズルRPG。
ビルド不要の静的サイトで、ES Modules をそのまま読み込んでいる。

## ディレクトリ構成

```
.
├── index.html              画面の骨組み(DOM)のみ。ロジックは持たない
├── manifest.json           PWA マニフェスト
├── sw.js                   Service Worker(アプリ本体は network-first)
├── assets/
│   └── icons/              アプリアイコン
└── src/
    ├── css/style.css       全画面のスタイル
    └── js/
        ├── main.js         エントリポイント。初期化と画面登録
        ├── core/
        │   ├── storage.js  localStorage ラッパー
        │   ├── state.js    セーブデータ / 編成 / スタミナ / ランク
        │   ├── nav.js      画面遷移とトップバー
        │   ├── sysmodal.js ⚙ システムモーダル(音量・リタイア)
        │   └── ui.js       toast などの汎用ユーティリティ
        ├── data/
        │   └── gamedata.js 属性・モンスター・ステージ・ショップ等の静的データ
        ├── battle/
        │   ├── board.js    盤面データ操作(生成 / 連結判定 / 落下 / 補充)
        │   ├── renderer.js Canvas 描画
        │   └── battle.js   ダンジョン進行とバトル制御
        └── screens/        home / dungeon / monster / gacha / shop / settings
```

依存の向きは `screens・battle → core → data` の一方向。
`nav.js` は画面の描画関数を `registerScreen()` で受け取るだけなので、
画面モジュールと相互参照しない。

## ゲームの主なルール

- **オーラは4色**: 🔥火 / 💧水 / 🌿木 / 💗ピンク。ピンクは攻撃ではなく**回復**。
- **消滅条件**: 同色が4つ以上つながると消滅。連鎖・同時消しで倍率が上がる。
- **編成**: 最大4体。先頭がリーダーで、リーダーと同色の消滅はダメージ1.3倍。
- **ダンジョン**: 1ステージ5フロア。フロアは**自動で進み**、フロア間の回復はない。
- **敵の攻撃**: 一定ターンごとに攻撃してくる(ボスは毎ターン)。
- **スタミナ**: 3分で1回復。初期ダンジョンの消費は5。
- **ランク**: ステージクリアで EXP を獲得。ランクアップでスタミナ上限アップ+全回復。

## 開発

ES Modules を使うため `file://` では動かない。ローカルでは HTTP で配信する。

```sh
python3 -m http.server 8000
# → http://localhost:8000/index.html
```

セーブデータは `localStorage` の `acb_state` キー。旧フォーマット(5属性・3体編成)は
起動時に自動で移行される(旧 光/闇 はピンクへ集約)。
