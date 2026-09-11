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
- **盤面**: 7列×8行。1マスのサイズは画面の縦横に合わせて自動調整される。
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

## 追加機能(2026-09更新)

### 1. オーラ操作60秒フリー移動
バトル中、最初にオーブへ触れてから60秒間は、指を離しても手番が終了しません。
60秒以内であれば何度でも好きなオーブを掴み直して移動できます。60秒経過すると
自動的に手番が確定します(`src/js/battle/battle.js` の `DRAG_TIME`)。

### 2. フレンドシステム
マイページで発行される「フレンドコード」を交換して友達を登録できます。
- フレンド登録時: 自分+300フレポ、相手+300フレポ
- 毎日1回の「あいさつ」: 自分+20フレポ、相手+10フレポ(フレンドポイントを稼げるルート)
「フレンド」画面から登録・あいさつができます。

### 3. マイページ
ホームの「設定」タブを「マイページ」に変更しました。ユーザー名・アイコンの設定、
フレンドコードの確認/コピーができます(旧設定機能はすべて維持しています)。

## Firebase セットアップ(フレンド機能・クラウド保存に必要)

`src/js/core/firebase.js` の `firebaseConfig` を、ご自身の Firebase プロジェクトの
設定値に置き換えてください(未設定のままでもゲーム本体はローカル保存のみで遊べます)。

1. Firebase コンソールでプロジェクトを作成
2. Authentication → Sign-in method で「匿名」を有効化
3. Firestore Database を作成(本番モードでOK)
4. 下記のセキュリティルールを設定(簡易的な公開ルールです。運用時は要調整)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read: if true;
      allow write: if request.auth != null;
      match /friends/{friendId} {
        allow read: if true;
        allow write: if request.auth != null;
      }
      match /save/{doc} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }
    match /friendCodes/{code} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

5. `firebaseConfig` にプロジェクトの設定値(apiKey等)を貼り付け

## 追加機能(2026-09更新 その2): 編成4体=自分3体+フレンドレンタル1体

- 編成画面の枠は自分の3体(先頭がリーダー)。4体目は固定編成せず、ダンジョン出発時に選択します。
- マイページの「レンタルモンスター」でフレンドに貸し出す1体を指定できます(Firestoreの
  `users/{uid}.rentalMonsterId` に保存)。
- ダンジョンのステージをタップすると「フレンドモンスターを選択」モーダルが開き、
  フレンドが貸し出し中のモンスターから1体選んで出発できます(フレンドがいない/
  レンタル未設定の場合は「フレンドなしで挑戦(3体)」で進行可能)。
