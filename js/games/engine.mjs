import { other, between, legalMove, hasMoves, inCheck } from './xiangqi-rules.mjs';

export const MODES = ['xiangqi', 'gomoku', 'banqi', 'jieqi'];
export const TYPES = ['king', 'advisor', 'elephant', 'horse', 'rook', 'cannon', 'pawn'];
export const NAMES = {
  red: { king: '帅', advisor: '仕', elephant: '相', horse: '马', rook: '车', cannon: '炮', pawn: '兵' },
  black: { king: '将', advisor: '士', elephant: '象', horse: '马', rook: '车', cannon: '炮', pawn: '卒' }
};
export const clone = value => JSON.parse(JSON.stringify(value));
const empty = (w, h) => Array.from({ length: h }, () => Array(w).fill(null));
export const dimensions = mode => mode === 'gomoku' ? [15, 15] : mode === 'banqi' ? [4, 8] : [9, 10];

// Fisher–Yates; every covered layout is chosen before the first move.
function shuffle(items, random) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function army(side) {
  return ['rook', 'horse', 'elephant', 'advisor', 'king', 'advisor', 'elephant', 'horse', 'rook',
    'cannon', 'cannon', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn'].map(type => ({ side, type }));
}

export function positionKey(state) {
  return state.turn + ':' + state.board.flat().map(p => p
    ? `${p.side[0]}${p.covered ? '?' + p.mask : p.type}` : '-').join(',');
}

export function newGame(mode, setup = 'standard', random = Math.random) {
  if (!MODES.includes(mode)) throw new Error('Unknown game');
  const [width, height] = dimensions(mode);
  const s = { mode, setup, board: empty(width, height), turn: mode === 'gomoku' ? 'black' : 'red',
    firstSide: null, result: null, reason: '', ply: 0, quiet: 0, captured: [], last: null, log: [], trail: [] };
  if (mode === 'banqi') {
    const pieces = shuffle([...army('red'), ...army('black')], random);
    s.board = s.board.map(row => row.map(() => ({ ...pieces.pop(), covered: true, mask: 'pawn' })));
  } else if (mode !== 'gomoku') {
    for (const side of ['black', 'red']) {
      const pieces = army(side);
      const hidden = shuffle(pieces.filter(p => p.type !== 'king'), random);
      const slots = [...Array.from({ length: 9 }, (_, x) => [x, 0]), [1, 2], [7, 2],
        ...[0, 2, 4, 6, 8].map(x => [x, 3])];
      slots.forEach(([x, y], i) => {
        const nominal = pieces[i];
        s.board[side === 'red' ? 9 - y : y][x] = mode === 'jieqi' && nominal.type !== 'king'
          ? { ...hidden.pop(), covered: true, mask: nominal.type } : { ...nominal, covered: false };
      });
    }
    if (mode === 'xiangqi') {
      if (setup === 'red-handicap') s.board[9][1] = null;
      if (setup === 'black-handicap') s.board[0][7] = null;
      if (setup === 'rook-endgame' || setup === 'horse-endgame') {
        s.board = empty(9, 10);
        s.board[9][4] = { type: 'king', side: 'red' };
        s.board[0][4] = { type: 'king', side: 'black' };
        s.board[6][4] = { type: 'pawn', side: 'red' };
        s.board[3][4] = { type: 'pawn', side: 'black' };
        const type = setup === 'rook-endgame' ? 'rook' : 'horse';
        s.board[9][0] = { type, side: 'red' };
        s.board[0][8] = { type, side: 'black' };
        if (setup === 'horse-endgame') {
          s.board[7][1] = { type: 'cannon', side: 'red' };
          s.board[2][7] = { type: 'cannon', side: 'black' };
        }
      }
    }
  }
  s.trail.push({ key: positionKey(s), check: null });
  return s;
}

export function onBoard(s, p) {
  const [w, h] = dimensions(s.mode);
  return p && Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.x < w && p.y >= 0 && p.y < h;
}

const ranks = { king: 7, advisor: 6, elephant: 5, rook: 4, horse: 3, cannon: 2, pawn: 1 };
export function banqiMove(board, from, to) {
  const p = board[from.y]?.[from.x], target = board[to.y]?.[to.x];
  if (!p || p.covered || target?.covered || target?.side === p.side) return false;
  const adjacent = Math.abs(to.x - from.x) + Math.abs(to.y - from.y) === 1;
  if (!target) return adjacent;
  if (p.type === 'cannon') return between(board, from, to) === 1;
  if (!adjacent || (p.type === 'king' && target.type === 'pawn')) return false;
  return (p.type === 'pawn' && target.type === 'king') || ranks[p.type] >= ranks[target.type];
}

export function targets(s, from) {
  if (s.result || !onBoard(s, from)) return [];
  const p = s.board[from.y][from.x];
  if (!p || p.side !== s.turn || s.mode === 'gomoku' || (s.mode === 'banqi' && p.covered)) return [];
  const result = [], [w, h] = dimensions(s.mode);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const to = { x, y };
    if (s.mode === 'banqi' ? banqiMove(s.board, from, to) : legalMove(s.board, from, to, s.mode)) result.push(to);
  }
  return result;
}

export function five(board, pos, side) {
  for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    let count = 1;
    for (const sign of [-1, 1]) {
      for (let n = 1; n < 15; n++) {
        if (board[pos.y + n * dy * sign]?.[pos.x + n * dx * sign]?.side !== side) break;
        count++;
      }
    }
    if (count >= 5) return true;
  }
  return false;
}

function repetition(s, checkedBy) {
  const key = positionKey(s);
  s.trail.push({ key, check: checkedBy });
  const visits = s.trail.map((v, i) => v.key === key ? i : -1).filter(i => i >= 0);
  if (visits.length < 3) return;
  const cycle = s.trail.slice(visits[visits.length - 3] + 1);
  const checking = ['red', 'black'].filter(side => {
    const moves = cycle.filter((_, i) => (i % 2 === 0 ? s.turn : other(s.turn)) === side);
    return moves.length && moves.every(m => m.check === side);
  });
  s.result = checking.length === 1 ? other(checking[0]) : 'draw';
  s.reason = checking.length === 1 ? '连续长将判负' : '三次重复局面';
}

// Returns a new state only for legal actions. Invalid input never changes the saved game.
export function play(state, to, from = null) {
  if (state.result || !onBoard(state, to)) return null;
  if (from && !onBoard(state, from)) return null;
  const s = clone(state), target = s.board[to.y][to.x];
  let captured = null, revealed = false, desc = '', movingSide = s.turn;
  if (s.mode === 'gomoku') {
    if (target) return null;
    s.board[to.y][to.x] = { type: 'stone', side: s.turn };
    desc = `${s.turn === 'black' ? '黑' : '白'}棋 · ${to.x + 1}列${to.y + 1}行`;
    if (five(s.board, to, s.turn)) { s.result = s.turn; s.reason = '五子连线'; }
    else if (s.board.flat().every(Boolean)) { s.result = 'draw'; s.reason = '棋盘已满'; }
    s.turn = s.turn === 'black' ? 'white' : 'black';
  } else if (s.mode === 'banqi' && target?.covered) {
    if (from) return null;
    target.covered = false;
    revealed = true;
    desc = `翻出${target.side === 'red' ? '红' : '黑'}${NAMES[target.side][target.type]}`;
    if (!s.firstSide) { s.firstSide = target.side; s.turn = target.side; movingSide = target.side; }
    s.turn = other(s.turn);
  } else {
    if (!from || !targets(s, from).some(p => p.x === to.x && p.y === to.y)) return null;
    const piece = s.board[from.y][from.x];
    captured = target;
    revealed = !!piece.covered;
    desc = `${piece.side === 'red' ? '红' : '黑'}${piece.covered ? '暗子' : NAMES[piece.side][piece.type]}`
      + ` · ${from.x + 1},${from.y + 1} → ${to.x + 1},${to.y + 1}`;
    if (captured) desc += ` · 吃${captured.covered ? '暗子' : NAMES[captured.side][captured.type]}`;
    piece.covered = false;
    if (revealed) desc += ` · 揭出${NAMES[piece.side][piece.type]}`;
    s.board[to.y][to.x] = piece;
    s.board[from.y][from.x] = null;
    if (captured) s.captured.push(captured.covered ? { covered: true, side: captured.side } : captured);
    s.turn = other(s.turn);
  }
  s.ply++;
  s.last = { from, to };
  s.log.push(desc);
  s.quiet = captured || revealed ? 0 : s.quiet + 1;
  if (captured || revealed) s.trail = [];
  if (s.mode === 'xiangqi' || s.mode === 'jieqi') {
    if (captured?.type === 'king' || !hasMoves(s.board, s.turn, s.mode)) {
      s.result = movingSide;
      s.reason = captured?.type === 'king' || inCheck(s.board, s.turn, s.mode) ? '将死' : '困毙';
    }
  } else if (s.mode === 'banqi' && !s.board.flat().some(p => p?.covered)) {
    const mobile = s.board.some((row, y) => row.some((p, x) => p?.side === s.turn && targets(s, { x, y }).length));
    if (!mobile) { s.result = movingSide; s.reason = '对方无棋可走'; }
  }
  if (!s.result && s.mode !== 'gomoku') {
    const checker = s.mode !== 'banqi' && inCheck(s.board, s.turn, s.mode) ? movingSide : null;
    repetition(s, checker);
    if (!s.result && s.quiet >= (s.mode === 'banqi' ? 80 : 120)) {
      s.result = 'draw'; s.reason = s.mode === 'banqi' ? '80步未翻子或吃子' : '120步未吃子或揭子';
    }
  }
  return s;
}

export function validState(s, mode) {
  const [w, h] = dimensions(mode), sides = mode === 'gomoku' ? ['black', 'white'] : ['red', 'black'];
  if (!s || s.mode !== mode || !sides.includes(s.turn) || !Array.isArray(s.board) || s.board.length !== h
    || !s.board.every(row => Array.isArray(row) && row.length === w)) return false;
  if (!Number.isInteger(s.ply) || s.ply < 0 || !Number.isInteger(s.quiet) || s.quiet < 0
    || !Array.isArray(s.log) || !s.log.every(v => typeof v === 'string')
    || !Array.isArray(s.trail) || !s.trail.every(v => v && typeof v.key === 'string' && [null, 'red', 'black'].includes(v.check))
    || !Array.isArray(s.captured) || !s.captured.every(p => p && ['red', 'black'].includes(p.side)
      && (p.covered === true || TYPES.includes(p.type)))
    || ![null, 'draw', ...sides].includes(s.result)
    || typeof s.reason !== 'string' || ![null, 'red', 'black'].includes(s.firstSide)) return false;
  const pieces = s.board.flat();
  if (!pieces.every(p => {
    if (p === null) return true;
    if (!p || !sides.includes(p.side) || (p.covered !== undefined && typeof p.covered !== 'boolean')) return false;
    if (mode === 'gomoku') return p.type === 'stone' && !p.covered;
    if (!TYPES.includes(p.type)) return false;
    if (!p.covered) return true;
    return TYPES.includes(p.mask) && (mode === 'banqi' || (mode === 'jieqi' && p.type !== 'king'));
  })) return false;
  if (mode === 'xiangqi' || mode === 'jieqi') {
    for (const side of sides) {
      const kings = pieces.filter(p => p?.side === side && p.type === 'king' && !p.covered).length;
      if (kings !== 1 && !(s.result && kings === 0)) return false;
    }
  }
  return !s.last || (onBoard(s, s.last.to) && (!s.last.from || onBoard(s, s.last.from)));
}
