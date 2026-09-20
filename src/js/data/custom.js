/* =========================================================
 * custom.js — 管理者ツール(admin/)が書き出すデータ
 *
 * **手で編集しない。** admin/ のリリース画面が丸ごと置き換える。
 * 中身は JSON リテラルだけで、処理は一切書かない。
 *
 * ここに足したものは、それぞれ次の場所で本体と合流する:
 *   enemies      → data/enemies.js  と data/enemy-master.js
 *   raids        → data/raids.js    の RAID_STAGES
 *   characters   → data/characters.js の CHARACTERS(=ガチャの母集団)
 *   gifts        → core/gifts.js のプレゼントボックス
 *
 * 空でも読み込まれるので、各キーは必ず配列で置いておくこと。
 * =======================================================*/

/**
 * モンスターのマスターデータ。
 * 1体ぶんの形は data/enemy-master.js の説明を見ること。
 */
export const CUSTOM_ENEMIES = [
  {
    "id": "lilim_noctia",
    "name": "リリム=ノクティア",
    "emoji": "👹",
    "boss": true,
    "sprite": "assets/chars/lilim_noctia_1.webp",
    "forms": [
      {
        "id": "lilim_noctia",
        "name": "夢魔の女帝 リリム=ノクティア",
        "sprite": "assets/chars/lilim_noctia_1.webp",
        "emoji": "👹",
        "hp": 22000,
        "atk": 125,
        "interval": 1,
        "intro": "warning",
        "dialogue": "ようこそ、私の夢の宮殿へ。夢魔の女帝に挑む勇気……甘い夢だけでは終わらせないわ。",
        "enemySkills": {
          "preemptive": {
            "effects": [
              {
                "type": "timeReduce",
                "seconds": 2,
                "turns": 3
              }
            ]
          },
          "actions": [
            {
              "attack": true,
              "dialogue": "まばたきする間に、夢へ連れていってあげる。"
            }
          ],
          "random": false
        }
      },
      {
        "id": "lilim_noctia",
        "name": "常夜の夢魔皇 リリム=ノクティア",
        "sprite": "assets/chars/lilim_noctia_2.webp",
        "emoji": "👹",
        "hp": 32000,
        "atk": 150,
        "interval": 1,
        "intro": "evolution",
        "dialogue": "私を目覚めさせたのね。ならば見届けなさい――常夜を統べる夢魔皇の、醒めない夢を。",
        "enemySkills": {
          "preemptive": {
            "effects": [
              {
                "type": "recoveryReduce",
                "percent": 75,
                "turns": 999
              },
              {
                "type": "comboGuard",
                "chains": 6,
                "turns": 10
              }
            ]
          },
          "actions": [
            {
              "attack": true,
              "dialogue": "夢の深淵へ、もう一歩。"
            },
            {
              "attack": true,
              "dialogue": "焦らなくていいわ。ここでは時さえ私のもの。",
              "effects": [
                {
                  "type": "skillDelay",
                  "count": 1,
                  "turns": 1
                }
              ]
            }
          ],
          "random": false,
          "buildUpBelow": 30
        }
      }
    ]
  }
];

/**
 * 降臨ダンジョン。フロアは {id, mult} でマスターを参照する。
 */
export const CUSTOM_RAIDS = [
  {
    "id": 2002,
    "name": "夢魔皇降臨",
    "bgm": "battle",
    "stamina": 30,
    "banner": "assets/promo/ririmu_banner.webp",
    "coinReward": 9000,
    "orbReward": 0,
    "expReward": 180,
    "charExpReward": 600,
    "auras": [
      0,
      1,
      2,
      3,
      4
    ],
    "dropAura": 4,
    "shardRate": 0.35,
    "crystalBase": 8,
    "floors": [
      {
        "enemies": [
          {
            "id": "gost",
            "form": 0,
            "mult": 1
          },
          {
            "id": "gost",
            "form": 0,
            "mult": 1
          }
        ]
      },
      {
        "enemies": [
          {
            "id": "worm",
            "form": 0,
            "mult": 1
          },
          {
            "id": "worm",
            "form": 0,
            "mult": 1
          }
        ]
      },
      {
        "enemies": [
          {
            "id": "gia",
            "form": 0,
            "mult": 1
          },
          {
            "id": "monolith",
            "form": 0,
            "mult": 1
          }
        ]
      },
      {
        "enemies": [
          {
            "id": "raiga",
            "form": 0,
            "mult": 1
          },
          {
            "id": "gost",
            "form": 0,
            "mult": 1
          }
        ]
      },
      {
        "enemies": [
          {
            "id": "kongou",
            "form": 0,
            "mult": 1
          }
        ]
      },
      {
        "enemies": [
          {
            "id": "gorem",
            "form": 0,
            "mult": 1
          },
          {
            "id": "worm",
            "form": 0,
            "mult": 1
          }
        ]
      },
      {
        "enemies": [
          {
            "id": "gia",
            "form": 0,
            "mult": 1
          },
          {
            "id": "raiga",
            "form": 0,
            "mult": 1
          }
        ]
      },
      {
        "enemies": [
          {
            "id": "gost",
            "form": 0,
            "mult": 1
          },
          {
            "id": "monolith",
            "form": 0,
            "mult": 1
          }
        ]
      },
      {
        "enemies": [
          {
            "id": "lilim_noctia",
            "form": 0,
            "mult": 1
          }
        ],
        "intro": "warning",
        "dialogue": "ようこそ、私の夢の宮殿へ。夢魔の女帝に挑む勇気……甘い夢だけでは終わらせないわ。"
      },
      {
        "enemies": [
          {
            "id": "lilim_noctia",
            "form": 1,
            "mult": 1
          }
        ],
        "intro": "evolution",
        "dialogue": "私を目覚めさせたのね。ならば見届けなさい――常夜を統べる夢魔皇の、醒めない夢を。"
      }
    ],
    "characterDrop": {
      "id": "dk_lilim_noctia",
      "rate": 0.5
    }
  }
];

/**
 * ガチャに足すキャラクター。
 * 1体ぶんの形は data/characters.js の mk() の引数を見ること。
 */
export const CUSTOM_CHARACTERS = [
  {
    "id": "lm_emiri",
    "name": "エミリ",
    "job": "陽だまりの花巫女",
    "portrait": "🌺",
    "aura": 3,
    "rarity": 4,
    "role": "healer",
    "leaderSkillId": "ls_emiri",
    "skillId": "sk_emiri",
    "atk": 24,
    "hp": 55,
    "rcv": 32,
    "flavor": "「浮かない顔してるね」と笑って、携帯食を半分分けてくる。日焼けした手は、いつもあたたかい。",
    "artStages": [
      {
        "star": 4,
        "minLevel": 1,
        "icon": "assets/chars/emiri_1_icon.webp",
        "full": "assets/chars/emiri_1.webp",
        "label": "通常",
        "scale": 1.15
      },
      {
        "star": 5,
        "minLevel": 1,
        "icon": "assets/chars/emiri_2_icon.webp",
        "full": "assets/chars/emiri_2.webp",
        "label": "進化",
        "scale": 1.35
      }
    ],
    "evoName": "エミリ",
    "evoJob": "常夏の大聖花"
  },
  {
    "id": "dk_lilim_noctia",
    "name": "リリム=ノクティア",
    "job": "夢魔の女帝",
    "portrait": "🙂",
    "aura": 4,
    "rarity": 3,
    "role": "balance",
    "leaderSkillId": "ls_lilim_noctia",
    "skillId": "sk_lilim_noctia",
    "atk": 22,
    "hp": 38,
    "rcv": 13,
    "raidDrop": true,
    "giftOnly": true,
    "flavor": "すべての夢魔を統べる女帝。甘い夢で侵入者を惑わせ、その意志を試す。気高く不敵な微笑みの奥に、常夜を支配する力を秘める。",
    "artStages": [
      {
        "star": 3,
        "minLevel": 1,
        "icon": "assets/chars/lilim_noctia_1_icon.webp",
        "full": "assets/chars/lilim_noctia_1.webp",
        "label": "通常"
      },
      {
        "star": 4,
        "minLevel": 1,
        "icon": "assets/chars/lilim_noctia_2_icon.webp",
        "full": "assets/chars/lilim_noctia_2.webp",
        "label": "進化"
      }
    ],
    "evoName": "リリム=ノクティア",
    "evoJob": "常夜の夢魔皇",
    "evoLeaderSkillId": "ls_lilim_noctia_evo",
    "evoSkillId": "sk_lilim_noctia_evo"
  }
];

/**
 * 足すスキル。既存のスキルを分解したパーツの組み合わせ。
 * 効果のキーは data/skills.js の冒頭にある一覧がすべて。
 * 同じIDがあれば既存を上書きする(倍率の調整に使える)。
 */
export const CUSTOM_SKILLS = [
  {
    "id": "sk_emiri",
    "name": "常夏の祝福",
    "healPct": 0.35,
    "spawn": {
      "to": "c3",
      "count": 6
    },
    "cooldown": 11,
    "desc": "最大HPの35%を回復・ランダム6個を癒オーラに変化"
  },
  {
    "id": "sk_lilim_noctia",
    "name": "スイート・ナイトメア",
    "timeThisTurn": 2,
    "spawn": {
      "to": "c4",
      "count": 6
    },
    "healPct": 0.25,
    "cooldown": 12,
    "desc": "このターンの操作時間+2.0秒・最大HPの25%を回復・ランダム6個を闇オーラに変化"
  },
  {
    "id": "sk_lilim_noctia_evo",
    "name": "エターナル・ドリーム",
    "timeThisTurn": 3,
    "spawn": {
      "to": "c4",
      "count": 8
    },
    "healPct": 0.35,
    "cooldown": 11,
    "desc": "このターンの操作時間+3.0秒・最大HPの35%を回復・ランダム8個を闇オーラに変化"
  }
];

/** 足すリーダースキル */
export const CUSTOM_LEADER_SKILLS = [
  {
    "id": "ls_emiri",
    "name": "花陽の祝福",
    "rcv": 1.7,
    "time": 1.5,
    "allAtk": 1.3,
    "desc": "オーラ操作時間+1.5秒・全オーラ1.3倍・回復力1.7倍"
  },
  {
    "id": "ls_lilim_noctia",
    "name": "女帝の甘き夢",
    "auraAtk": {
      "c4": 1.7
    },
    "rcv": 1.3,
    "desc": "闇オーラ1.7倍・回復力1.3倍"
  },
  {
    "id": "ls_lilim_noctia_evo",
    "name": "常夜を統べる夢魔皇",
    "auraAtk": {
      "c4": 2
    },
    "rcv": 1.5,
    "time": 1,
    "desc": "オーラ操作時間+1.0秒・闇オーラ2倍・回復力1.5倍"
  }
];

/**
 * プレゼントボックスへ配るもの。key ごとに一度だけ届く。
 *   key       配布の目印。**配り直すときは新しい key にする**
 *   from / to 配布期間(YYYY-MM-DD。省略すると期間なし)
 *   coin / orb / frepo / stamina / char / materials  中身
 */
export const CUSTOM_GIFTS = [
  {
    "key": "gift_emiri_debut",
    "title": "エミリ実装記念",
    "note": "新キャラクター「エミリ」の実装を記念して、ダイヤ45個をお贈りします。",
    "from": "2026-09-19",
    "to": "2026-10-19",
    "orb": 45
  }
];

/**
 * 1つしか無い設定。空なら既定値が使われる。
 *   pickupId     ガチャのピックアップにするキャラID
 *   pickupRate   ★4帯のうちピックアップが占める割合(0〜1)
 *   gachaBanner  ホームに出すガチャのバナー画像
 */
export const CUSTOM_SETTINGS = {
  "pickupId": "lm_emiri",
  "pickupRate": 0.3,
  "gachaBanner": "assets/promo/gacha_banner.webp"
};
