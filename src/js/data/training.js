import { COLS, ROWS, findGroups, applyGravityNoRefill } from '../battle/board.js';

export const LESSONS = [
  { name: '段差リレー', goal: 2, columns: [[],[],[0,0,0,0,1,1],[1,1],[],[],[]],
    intro: '次に消したい水を、高さをずらして置きます。下の火が消えると、上の水が落ちて右の水とつながります。',
    tips: ['火4個が水の足場になっています。先に火を消しましょう。', '左の水が下がり、右の水と合流。消去→落下→次の消去が連鎖です。'] },
  { name: 'かみ合わせ', goal: 2, columns: [[],[],[0,0,1,1],[1,0,0,1],[],[],[]],
    intro: '次の色をひとかたまりにせず、起点の色を間にはさみます。落ちる距離が違っても、最後につながれば成功です。',
    tips: ['ずれた火4個は上下左右につながっています。斜めだけではつながりません。', '火が抜けると、分かれていた水が同じ高さに集まります。'] },
  { name: '曲がりの接続', goal: 3, columns: [[],[0],[0,1,1,2,2],[0,0,2,1,1,2],[],[],[]],
    intro: '横3個と、その端に縦1個。曲がった形も4個で消せます。横幅を使う起点から、上に置いた色へつなぎましょう。',
    tips: ['曲がった火のつながりを確認。一直線である必要はありません。', '火が消えたあと、水の左右のかたまりが接続します。', '最後に木が集まります。先の色ほど、落下後の位置を考えて置きましょう。'] },
  { name: '反転リレー', goal: 3, columns: [[],[],[1,1,2,2],[0,0,0,0,2,1,1,2],[],[],[]],
    intro: '右側から始めた消去を左側へ渡し、さらに上の色へ戻します。端に着いたら、横へ伸ばすだけでなく上の空間も使いましょう。',
    tips: ['右下の火から開始。左の水はまだ2個だけなので消えません。', '右から水が落ち、左の水へ接続します。', '水の上に残していた木が落ちて合流。進む方向を切り替えられました。'] },
  { name: '支点の土台', goal: 4, columns: [[],[0,0],[1,0,0,1,3,3],[2,1,1,2,2,2,3,3],[],[],[]],
    intro: '小さな起点を土台にして、上へ連鎖を重ねます。先に完成形を考え、途中の色で次の色が早くつながらないよう支えましょう。',
    tips: ['土台の火を消し、最初の支えを外します。', '水が合流し、右上の木を支えていた部分がなくなります。', '木が縦4個でつながります。土台から上へ順番に伝わりました。', '上に用意した癒が合流して4連鎖。起点と上部の接続をセットで覚えましょう。'] },
  { name: '終点の延長', goal: 5, columns: [[],[0,0,0,0,1,1],[2,1,1,2,4,4],[3,2,2,3,3,3,4,4],[],[],[]],
    intro: 'できあがった連鎖の終わりに、もう1色を予約します。最後に消える癒の上に闇を分けて置き、もう一度落下を起こしましょう。',
    tips: ['火から出発。終点の闇は上で待機しています。', '水へ接続。後半の色を先に消さないことが大切です。', '木が合流。次にどの列が下がるか予想しましょう。', '癒が消えると、その上の闇が落ちます。', '予約しておいた闇が合流して5連鎖。完成した連鎖の先に1段追加できました。'] }
];

export function lessonBoard(lesson) {
  return Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) => lesson.columns[c][ROWS-1-r] ?? -1));
}

export function exerciseHole(lesson, index) {
  const board = lessonBoard(lesson);
  const color = Math.min(index, lesson.goal - 1);
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
    if (board[r][c] === color) return [r,c];
  }
}

export function simulateTraining(input) {
  const board = input.map(row => row.slice()), waves = [];
  for (;;) {
    const groups = findGroups(board, 4);
    if (!groups.length) return { board, waves };
    waves.push(groups);
    groups.forEach(g => g.cells.forEach(([r,c]) => { board[r][c] = -1; }));
    applyGravityNoRefill(board);
  }
}
