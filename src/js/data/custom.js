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
  },
  {
    "id": "valgas",
    "name": "炎爪竜ヴァルガス",
    "emoji": "🐉",
    "boss": false,
    "sprite": "assets/enemy/valgas.webp",
    "hp": 5600,
    "atk": 115,
    "interval": 2
  },
  {
    "id": "nereia",
    "name": "蒼潮姫ネレイア",
    "emoji": "🧜‍♀️",
    "boss": false,
    "sprite": "assets/enemy/nereia.webp",
    "hp": 4400,
    "atk": 90,
    "interval": 2
  },
  {
    "id": "magdoll",
    "name": "灼岩巨兵マグドール",
    "emoji": "🌋",
    "boss": false,
    "sprite": "assets/enemy/magdoll.webp",
    "hp": 6500,
    "atk": 125,
    "interval": 3
  },
  {
    "id": "mycol",
    "name": "幻毒菌獣マイコル",
    "emoji": "🍄",
    "boss": false,
    "sprite": "assets/enemy/mycol.webp",
    "hp": 5200,
    "atk": 80,
    "interval": 2,
    "enemySkills": {
      "actions": [
        {
          "effects": [
            {
              "type": "poison",
              "percent": 8,
              "turns": 3
            }
          ]
        },
        {
          "attack": true
        }
      ],
      "random": false
    }
  },
  {
    "id": "vespar",
    "name": "金翅毒蜂ヴェスパ",
    "emoji": "🐝",
    "boss": false,
    "sprite": "assets/enemy/vespar.webp",
    "hp": 4300,
    "atk": 95,
    "interval": 1,
    "enemySkills": {
      "actions": [
        {
          "attack": true,
          "effects": [
            {
              "type": "poison",
              "percent": 5,
              "turns": 2
            }
          ]
        },
        {
          "attack": true
        }
      ],
      "random": false
    }
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
  },
  {
    "id": 3101,
    "name": "ハロウィンパーティ 初級",
    "bgm": "battle",
    "stamina": 8,
    "category": "event",
    "eventId": "halloween_2026",
    "enabled": true,
    "availableFrom": "2026-10-01T00:00:00+09:00",
    "availableUntil": "2026-11-01T00:00:00+09:00",
    "currencyDrop": {
      "id": "mt_halloween_candy",
      "amount": 10
    },
    "coinReward": 600,
    "orbReward": 0,
    "expReward": 25,
    "charExpReward": 80,
    "auras": [
      0,
      1,
      2,
      3,
      4
    ],
    "dropAura": 4,
    "shardRate": 0,
    "crystalBase": 0,
    "floors": [
      {
        "enemies": [
          {
            "id": "gost",
            "form": 0,
            "mult": {
              "hp": 0.12,
              "atk": 0.35
            }
          }
        ]
      },
      {
        "enemies": [
          {
            "id": "gost",
            "form": 0,
            "mult": {
              "hp": 0.15,
              "atk": 0.4
            }
          }
        ]
      },
      {
        "enemies": [
          {
            "id": "valgas",
            "form": 0,
            "mult": {
              "hp": 0.2,
              "atk": 0.45
            }
          }
        ],
        "dialogue": "お菓子の門番を越えて、パーティ会場へ！"
      }
    ]
  },
  {
    "id": 3102,
    "name": "ハロウィンパーティ 中級",
    "bgm": "battle",
    "stamina": 15,
    "category": "event",
    "eventId": "halloween_2026",
    "enabled": true,
    "availableFrom": "2026-10-01T00:00:00+09:00",
    "availableUntil": "2026-11-01T00:00:00+09:00",
    "currencyDrop": {
      "id": "mt_halloween_candy",
      "amount": 25
    },
    "coinReward": 1500,
    "orbReward": 0,
    "expReward": 50,
    "charExpReward": 180,
    "auras": [
      0,
      1,
      2,
      3,
      4
    ],
    "dropAura": 4,
    "shardRate": 0,
    "crystalBase": 0,
    "floors": [
      {
        "enemies": [
          {
            "id": "gost",
            "form": 0,
            "mult": {
              "hp": 0.3,
              "atk": 0.65
            }
          }
        ]
      },
      {
        "enemies": [
          {
            "id": "mycol",
            "form": 0,
            "mult": {
              "hp": 0.3,
              "atk": 0.65
            }
          }
        ]
      },
      {
        "enemies": [
          {
            "id": "vespar",
            "form": 0,
            "mult": {
              "hp": 0.3,
              "atk": 0.65
            }
          }
        ]
      },
      {
        "enemies": [
          {
            "id": "valgas",
            "form": 0,
            "mult": {
              "hp": 0.45,
              "atk": 0.65
            }
          }
        ],
        "dialogue": "いたずら好きの門番が、キャンディの山を守っている！"
      }
    ]
  },
  {
    "id": 3103,
    "name": "ハロウィンパーティ 上級",
    "bgm": "battle",
    "stamina": 25,
    "category": "event",
    "eventId": "halloween_2026",
    "enabled": true,
    "availableFrom": "2026-10-01T00:00:00+09:00",
    "availableUntil": "2026-11-01T00:00:00+09:00",
    "currencyDrop": {
      "id": "mt_halloween_candy",
      "amount": 50
    },
    "coinReward": 3000,
    "orbReward": 0,
    "expReward": 80,
    "charExpReward": 360,
    "auras": [
      0,
      1,
      2,
      3,
      4
    ],
    "dropAura": 4,
    "shardRate": 0,
    "crystalBase": 0,
    "floors": [
      {
        "enemies": [
          {
            "id": "gost",
            "form": 0,
            "mult": {
              "hp": 0.6,
              "atk": 1
            }
          }
        ]
      },
      {
        "enemies": [
          {
            "id": "vespar",
            "form": 0,
            "mult": {
              "hp": 0.6,
              "atk": 1
            }
          }
        ]
      },
      {
        "enemies": [
          {
            "id": "mycol",
            "form": 0,
            "mult": {
              "hp": 0.6,
              "atk": 1
            }
          }
        ]
      },
      {
        "enemies": [
          {
            "id": "magdoll",
            "form": 0,
            "mult": {
              "hp": 0.6,
              "atk": 1
            }
          }
        ]
      },
      {
        "enemies": [
          {
            "id": "valgas",
            "form": 0,
            "mult": {
              "hp": 0.9,
              "atk": 1.2
            }
          }
        ],
        "intro": "warning",
        "dialogue": "最後のいたずらを越えれば、今宵のキャンディはあなたのもの！"
      }
    ]
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
  },
  {
    "id": "hw_kai",
    "name": "宵宴の吸血剣士・カイ",
    "job": "宵宴の吸血剣士",
    "portrait": "🙂",
    "aura": 1,
    "rarity": 4,
    "role": "attacker",
    "leaderSkillId": "ls_kai4",
    "skillId": "sk_kai4",
    "atk": 43,
    "hp": 48,
    "rcv": 13,
    "raidDrop": false,
    "giftOnly": false,
    "enabled": true,
    "eventId": "halloween_2026",
    "availableFrom": "2026-10-01T00:00:00+09:00",
    "availableUntil": "2026-11-01T00:00:00+09:00",
    "flavor": "仮装は苦手だと言いながら、誰より律儀に招待状を配っている。",
    "artStages": [
      {
        "star": 4,
        "minLevel": 1,
        "icon": "assets/chars/hw_kai_1_icon.webp",
        "full": "assets/chars/hw_kai_1.webp",
        "label": "通常"
      },
      {
        "star": 5,
        "minLevel": 1,
        "icon": "assets/chars/hw_kai_2_icon.webp",
        "full": "assets/chars/hw_kai_2.webp",
        "label": "進化"
      }
    ],
    "evoName": "夜宴を統べる吸血王・カイ",
    "evoJob": "夜宴の吸血王",
    "evoLeaderSkillId": "ls_kai5",
    "evoSkillId": "sk_kai5"
  },
  {
    "id": "hw_mio",
    "name": "月夜の幽霊姫・ミオ",
    "job": "月夜の幽霊姫",
    "portrait": "🙂",
    "aura": 1,
    "rarity": 4,
    "role": "balance",
    "leaderSkillId": "ls_mio_x",
    "skillId": "sk_mio_x",
    "atk": 34,
    "hp": 56,
    "rcv": 18,
    "raidDrop": false,
    "giftOnly": false,
    "enabled": true,
    "eventId": "halloween_2026",
    "availableFrom": "2026-10-01T00:00:00+09:00",
    "availableUntil": "2026-11-01T00:00:00+09:00",
    "flavor": "冷たい手で灯すランタンは、不思議と心を温めてくれる。",
    "artStages": [
      {
        "star": 4,
        "minLevel": 1,
        "icon": "assets/chars/hw_mio_1_icon.webp",
        "full": "assets/chars/hw_mio_1.webp",
        "label": "通常"
      },
      {
        "star": 5,
        "minLevel": 1,
        "icon": "assets/chars/hw_mio_2_icon.webp",
        "full": "assets/chars/hw_mio_2.webp",
        "label": "進化"
      }
    ],
    "evoName": "氷月の幽霊女王・ミオ",
    "evoJob": "氷月の幽霊女王"
  },
  {
    "id": "hw_noa",
    "name": "収穫祭の魔女・ノア",
    "job": "収穫祭の魔女",
    "portrait": "🙂",
    "aura": 2,
    "rarity": 4,
    "role": "healer",
    "leaderSkillId": "ls_noa_x",
    "skillId": "sk_noa_x",
    "atk": 24,
    "hp": 53,
    "rcv": 31,
    "raidDrop": false,
    "giftOnly": false,
    "enabled": true,
    "eventId": "halloween_2026",
    "availableFrom": "2026-10-01T00:00:00+09:00",
    "availableUntil": "2026-11-01T00:00:00+09:00",
    "flavor": "魔法書の今日の頁は、お菓子のレシピ。森の仲間にも甘い贈り物を。",
    "artStages": [
      {
        "star": 4,
        "minLevel": 1,
        "icon": "assets/chars/hw_noa_1_icon.webp",
        "full": "assets/chars/hw_noa_1.webp",
        "label": "通常"
      },
      {
        "star": 5,
        "minLevel": 1,
        "icon": "assets/chars/hw_noa_2_icon.webp",
        "full": "assets/chars/hw_noa_2.webp",
        "label": "進化"
      }
    ],
    "evoName": "豊穣の大魔女・ノア",
    "evoJob": "豊穣の大魔女"
  },
  {
    "id": "hw_rune",
    "name": "南瓜の女王・ルネ",
    "job": "南瓜の女王",
    "portrait": "🙂",
    "aura": 0,
    "rarity": 4,
    "role": "attacker",
    "leaderSkillId": "ls_inferno",
    "skillId": "sk_ignition",
    "atk": 43,
    "hp": 48,
    "rcv": 13,
    "raidDrop": false,
    "giftOnly": false,
    "enabled": true,
    "eventId": "halloween_2026",
    "availableFrom": "2026-10-01T00:00:00+09:00",
    "availableUntil": "2026-11-01T00:00:00+09:00",
    "flavor": "今宵の王命はただ一つ。誰ひとり、お菓子を持たずに帰してはならない。",
    "artStages": [
      {
        "star": 4,
        "minLevel": 1,
        "icon": "assets/chars/hw_rune_1_icon.webp",
        "full": "assets/chars/hw_rune_1.webp",
        "label": "通常"
      },
      {
        "star": 5,
        "minLevel": 1,
        "icon": "assets/chars/hw_rune_2_icon.webp",
        "full": "assets/chars/hw_rune_2.webp",
        "label": "進化"
      }
    ],
    "evoName": "万灯の南瓜女帝・ルネ",
    "evoJob": "万灯の南瓜女帝"
  },
  {
    "id": "hw_kyuko",
    "name": "甘夜の菓子姫・キュウコ",
    "job": "甘夜の菓子姫",
    "portrait": "🙂",
    "aura": 4,
    "rarity": 4,
    "role": "attacker",
    "leaderSkillId": "ls_kyuko_evo",
    "skillId": "sk_kyuko_evo",
    "atk": 43,
    "hp": 48,
    "rcv": 13,
    "raidDrop": false,
    "giftOnly": true,
    "enabled": true,
    "eventId": "halloween_2026",
    "availableFrom": "2026-10-01T00:00:00+09:00",
    "availableUntil": "2026-11-01T00:00:00+09:00",
    "flavor": "「いたずらが嫌なら、飴をひとつ。……もうひとつでも、よいのよ？」今宵の狐火は甘い香り。",
    "artStages": [
      {
        "star": 4,
        "minLevel": 1,
        "icon": "assets/chars/hw_kyuko_1_icon.webp",
        "full": "assets/chars/hw_kyuko_1.webp",
        "label": "通常"
      },
      {
        "star": 5,
        "minLevel": 1,
        "icon": "assets/chars/hw_kyuko_2_icon.webp",
        "full": "assets/chars/hw_kyuko_2.webp",
        "label": "進化"
      }
    ],
    "evoName": "百鬼甘宴の九尾姫・キュウコ",
    "evoJob": "百鬼甘宴の九尾姫"
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
  "gachaBanner": "assets/promo/gacha_banner.webp",
  "events": [
    {
      "id": "halloween_2026",
      "name": "ハロウィンパーティ",
      "currency": {
        "id": "mt_halloween_candy",
        "name": "ハロウィンキャンディ",
        "icon": "assets/items/halloween_candy.webp",
        "emoji": "🍬",
        "color": "#FFB658"
      },
      "shop": [
        {
          "id": "hw2026_kyuko",
          "type": "character",
          "charId": "hw_kyuko",
          "price": 500,
          "totalLimit": 5
        },
        {
          "id": "hw2026_star",
          "type": "material",
          "matId": "mt_star",
          "amount": 5,
          "price": 50,
          "totalLimit": 10
        },
        {
          "id": "hw2026_exp",
          "type": "material",
          "matId": "mt_exp2",
          "amount": 5,
          "price": 25,
          "totalLimit": 20
        },
        {
          "id": "hw2026_awaken",
          "type": "material",
          "matId": "mt_awaken",
          "amount": 1,
          "price": 100,
          "totalLimit": 5
        },
        {
          "id": "hw2026_dark",
          "type": "material",
          "matId": "mt_c4",
          "amount": 10,
          "price": 40,
          "totalLimit": 5
        }
      ],
      "enabled": true,
      "availableFrom": "2026-10-01T00:00:00+09:00",
      "availableUntil": "2026-11-01T00:00:00+09:00",
      "description": "仮装した仲間と、甘くて少し不思議な一夜へ。ダンジョンでハロウィンキャンディを集め、限定キュウコや育成素材と交換しよう！",
      "banner": "assets/promo/halloween_2026.webp"
    }
  ]
};
