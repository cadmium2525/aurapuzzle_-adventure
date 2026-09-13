# Item icon atlas

`item_atlas.webp` is a 512×512 transparent 4×4 atlas. Each cell is 128×128.

| Row | Col 1 | Col 2 | Col 3 | Col 4 |
| --- | --- | --- | --- | --- |
| 1 | mt_c0 | mt_c1 | mt_c2 | mt_c3 |
| 2 | mt_c4 | mt_star | mt_awaken | mt_exp1 |
| 3 | mt_exp2 | stamina | coin | frepo |
| 4 | orb | unused | unused | unused |

The runtime uses one atlas rather than 13 individual files because these small icons
appear repeatedly across the status bar, dungeon, character, shop, gacha, present,
and result screens.
