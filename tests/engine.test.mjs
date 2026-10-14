import assert from 'node:assert/strict';
import { newGame, play, targets, banqiMove, five, clone, validState, positionKey } from '../js/games/engine.mjs';
import { canMove, legalMove, inCheck, hasMoves } from '../js/games/xiangqi-rules.mjs';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`✓ ${name}`); }
const p = (x, y) => ({ x, y });
const piece = (type, side = 'red', extra = {}) => ({ type, side, ...extra });
function board() { return Array.from({ length: 10 }, () => Array(9).fill(null)); }
function sparse(mode = 'xiangqi') {
  const s = newGame(mode); s.board = board();
  s.board[9][4] = piece('king'); s.board[0][4] = piece('king', 'black'); s.board[6][4] = piece('pawn');
  return s;
}
function trail(s) { s.trail = [{ key: positionKey(s), check: null }]; return s; }

test('standard opening, alternating turns and rejected moves do not mutate', () => {
  const s = newGame('xiangqi'), copy = clone(s);
  assert.equal(s.board.flat().filter(Boolean).length, 32);
  assert.equal(play(s, p(0, 2), p(0, 3)), null);
  const next = play(s, p(0, 5), p(0, 6));
  assert.equal(next.turn, 'black'); assert.equal(next.ply, 1); assert.deepEqual(s, copy);
  assert.equal(play(next, p(2, 5), p(2, 6)), null);
  assert.equal(play(s, p(-1, 0), p(0, 6)), null);
});
test('rook cannot jump or move diagonally', () => {
  const b = board(); b[8][0] = piece('rook'); b[4][0] = piece('pawn');
  assert.equal(canMove(b, p(0, 8), p(0, 5)), true);
  assert.equal(canMove(b, p(0, 8), p(0, 3)), false);
  assert.equal(canMove(b, p(0, 8), p(1, 7)), false);
});
test('horse leg blocks the correct axis', () => {
  const b = board(); b[5][4] = piece('horse');
  assert.equal(canMove(b, p(4, 5), p(6, 4)), true);
  b[5][5] = piece('pawn'); assert.equal(canMove(b, p(4, 5), p(6, 4)), false);
  assert.equal(canMove(b, p(4, 5), p(5, 3)), true);
  b[4][4] = piece('pawn'); assert.equal(canMove(b, p(4, 5), p(5, 3)), false);
});
test('elephant eye and river restriction', () => {
  const b = board(); b[5][4] = piece('elephant');
  assert.equal(canMove(b, p(4, 5), p(6, 7)), true);
  b[6][5] = piece('pawn'); assert.equal(canMove(b, p(4, 5), p(6, 7)), false);
  assert.equal(canMove(b, p(4, 5), p(2, 3)), false);
});
test('advisor and king stay in palace', () => {
  const b = board(); b[7][3] = piece('advisor'); b[9][4] = piece('king');
  assert.equal(canMove(b, p(3, 7), p(4, 8)), true);
  assert.equal(canMove(b, p(3, 7), p(2, 6)), false);
  assert.equal(canMove(b, p(4, 9), p(4, 8)), true);
  assert.equal(canMove(b, p(4, 9), p(5, 8)), false);
});
test('cannon needs exactly one screen to capture, none to move', () => {
  const b = board(); b[8][0] = piece('cannon'); b[2][0] = piece('rook', 'black');
  assert.equal(canMove(b, p(0, 8), p(0, 2)), false);
  b[5][0] = piece('pawn'); assert.equal(canMove(b, p(0, 8), p(0, 2)), true);
  assert.equal(canMove(b, p(0, 8), p(0, 3)), false);
  b[4][0] = piece('pawn'); assert.equal(canMove(b, p(0, 8), p(0, 2)), false);
});
test('pawn direction, river and no backward move for both sides', () => {
  const b = board(); b[6][2] = piece('pawn'); b[4][4] = piece('pawn'); b[5][6] = piece('pawn', 'black');
  assert.equal(canMove(b, p(2, 6), p(3, 6)), false);
  assert.equal(canMove(b, p(4, 4), p(5, 4)), true);
  assert.equal(canMove(b, p(4, 4), p(4, 5)), false);
  assert.equal(canMove(b, p(6, 5), p(5, 5)), true);
  assert.equal(canMove(b, p(6, 5), p(6, 4)), false);
});
test('moving the screen cannot expose facing kings', () => {
  const s = sparse(); s.board[6][4] = piece('rook');
  assert.equal(legalMove(s.board, p(4, 6), p(5, 6)), false);
  s.board[6][4] = null;
  assert.equal(inCheck(s.board, 'red'), true); assert.equal(inCheck(s.board, 'black'), true);
});
test('pinned piece cannot expose own king to enemy rook', () => {
  const s = sparse(); s.board[0][4] = null; s.board[0][3] = piece('king', 'black');
  s.board[2][4] = piece('rook', 'black'); s.board[6][4] = piece('rook');
  assert.equal(legalMove(s.board, p(4, 6), p(5, 6)), false);
});
test('checkmate and stalemate both have no legal reply', () => {
  const s = sparse(); s.board[6][4] = null; s.board[0][0] = piece('rook'); s.board[1][4] = piece('rook');
  assert.equal(inCheck(s.board, 'black'), true); assert.equal(hasMoves(s.board, 'black'), false);
  const t = sparse(); t.board[6][4] = null; t.board[4][4] = piece('pawn');
  t.board[1][3] = piece('rook'); t.board[1][5] = piece('rook');
  assert.equal(inCheck(t.board, 'black'), false); assert.equal(hasMoves(t.board, 'black'), false);
});
test('all handicap and endgame presets are legal playable positions', () => {
  for (const setup of ['standard', 'red-handicap', 'black-handicap', 'rook-endgame', 'horse-endgame']) {
    const s = newGame('xiangqi', setup);
    assert.equal(validState(s, 'xiangqi'), true);
    for (const side of ['red', 'black']) { assert.equal(inCheck(s.board, side), false); assert.equal(hasMoves(s.board, side), true); }
  }
});
test('jieqi preserves each army inventory and nominal opening slots', () => {
  const s = newGame('jieqi', 'standard', () => .25);
  assert.equal(s.board.flat().filter(p => p?.covered).length, 30);
  for (const side of ['red', 'black']) {
    const inventory = s.board.flat().filter(p => p?.side === side).map(p => p.type).sort();
    assert.deepEqual(inventory, newGame('xiangqi').board.flat().filter(p => p?.side === side).map(p => p.type).sort());
  }
  assert.equal(s.board[9][0].mask, 'rook'); assert.equal(s.board[9][4].covered, false);
});
test('covered horse identity moves as nominal rook then reveals', () => {
  const s = sparse('jieqi'); s.board[8][0] = piece('horse', 'red', { covered: true, mask: 'rook' });
  assert.equal(play(s, p(1, 6), p(0, 8)), null);
  const next = play(s, p(0, 7), p(0, 8));
  assert.equal(next.board[7][0].covered, false); assert.equal(next.board[7][0].type, 'horse');
  assert.equal(canMove(next.board, p(0, 7), p(1, 5), 'jieqi'), true);
  assert.equal(canMove(next.board, p(0, 7), p(0, 6), 'jieqi'), false);
});
test('revealed advisors leave palace and elephants cross river, covered ones cannot', () => {
  const s = sparse('jieqi'); s.board[5][2] = piece('advisor'); s.board[5][6] = piece('elephant');
  assert.equal(canMove(s.board, p(2, 5), p(3, 4), 'jieqi'), true);
  assert.equal(canMove(s.board, p(6, 5), p(8, 3), 'jieqi'), true);
  s.board[4][7] = piece('pawn'); assert.equal(canMove(s.board, p(6, 5), p(8, 3), 'jieqi'), false);
  s.board[5][2].covered = true; s.board[5][2].mask = 'advisor';
  assert.equal(canMove(s.board, p(2, 5), p(3, 4), 'jieqi'), false);
});
test('enemy covered pieces attack by mask, not secret type', () => {
  const s = sparse('jieqi'); s.board[6][4] = null; s.board[0][4] = null; s.board[0][3] = piece('king', 'black');
  s.board[2][4] = piece('pawn', 'black', { covered: true, mask: 'rook' });
  assert.equal(inCheck(s.board, 'red', 'jieqi'), true);
  s.board[2][4].type = 'horse'; assert.equal(inCheck(s.board, 'red', 'jieqi'), true);
});
test('captured jieqi dark identity is absent from captured tray and log', () => {
  const s = sparse('jieqi'); s.board[8][0] = piece('rook'); s.board[7][0] = piece('horse', 'black', { covered: true, mask: 'pawn' });
  const next = play(s, p(0, 7), p(0, 8));
  assert.deepEqual(next.captured, [{ covered: true, side: 'black' }]);
  assert.equal(next.log[0].includes('马'), false); assert.equal(next.log[0].includes('吃暗子'), true);
});
test('gomoku all four axes, edge and long lines', () => {
  for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    const s = newGame('gomoku'); const start = dy < 0 ? p(0, 4) : p(0, 0);
    for (let n = 0; n < 5; n++) s.board[start.y + n * dy][start.x + n * dx] = piece('stone', 'black');
    assert.equal(five(s.board, start, 'black'), true);
  }
  const s = newGame('gomoku'); for (let x = 0; x < 6; x++) s.board[14][x] = piece('stone', 'white');
  assert.equal(five(s.board, p(3, 14), 'white'), true);
});
test('gomoku wins and locks board; occupied target rejected', () => {
  let s = newGame('gomoku');
  for (let x = 0; x < 4; x++) { s = play(s, p(x, 0)); s = play(s, p(x, 2)); }
  assert.equal(play(s, p(0, 0)), null);
  s = play(s, p(4, 0)); assert.equal(s.result, 'black'); assert.equal(play(s, p(4, 2)), null);
});
test('banqi first flip assigns color and passes turn to the other player', () => {
  const s = newGame('banqi', 'standard', () => .5); const color = s.board[0][0].side;
  const next = play(s, p(0, 0)); assert.equal(next.firstSide, color);
  assert.notEqual(next.turn, color); assert.equal(next.board[0][0].covered, false);
  assert.equal(s.board[0][0].covered, true);
});
test('banqi size, pawn-general exception and no dark capture', () => {
  const b = Array.from({ length: 8 }, () => Array(4).fill(null));
  b[0][0] = piece('pawn'); b[0][1] = piece('king', 'black');
  assert.equal(banqiMove(b, p(0, 0), p(1, 0)), true);
  assert.equal(banqiMove(b, p(1, 0), p(0, 0)), false);
  b[0][1] = piece('pawn', 'black'); assert.equal(banqiMove(b, p(0, 0), p(1, 0)), true);
  b[0][1].covered = true; assert.equal(banqiMove(b, p(0, 0), p(1, 0)), false);
});
test('banqi cannon: adjacent walking, exactly one screen, any rank', () => {
  const b = Array.from({ length: 8 }, () => Array(4).fill(null));
  b[0][0] = piece('cannon'); b[3][0] = piece('king', 'black');
  assert.equal(banqiMove(b, p(0, 0), p(0, 1)), true); assert.equal(banqiMove(b, p(0, 0), p(0, 2)), false);
  assert.equal(banqiMove(b, p(0, 0), p(0, 3)), false);
  b[1][0] = piece('pawn', 'red', { covered: true }); assert.equal(banqiMove(b, p(0, 0), p(0, 3)), true);
  b[2][0] = piece('pawn'); assert.equal(banqiMove(b, p(0, 0), p(0, 3)), false);
});
test('banqi last capture ends the game', () => {
  const s = newGame('banqi'); s.board = Array.from({ length: 8 }, () => Array(4).fill(null));
  s.firstSide = 'red'; s.board[0][0] = piece('rook'); s.board[0][1] = piece('pawn', 'black');
  const next = play(s, p(1, 0), p(0, 0)); assert.equal(next.result, 'red');
});
test('three repetitions draw but repeated unilateral checks lose', () => {
  let s = trail(sparse());
  for (let i = 0; i < 2; i++) {
    for (const [from, to] of [[p(4, 9), p(3, 9)], [p(4, 0), p(5, 0)], [p(3, 9), p(4, 9)], [p(5, 0), p(4, 0)]]) {
      s = play(s, to, from); assert.ok(s);
    }
  }
  assert.equal(s.result, 'draw');
  let t = sparse(); t.board[9][4] = null; t.board[9][3] = piece('king'); t.board[2][4] = piece('rook'); t.turn = 'black'; t = trail(t);
  for (let i = 0; i < 2; i++) {
    for (const [from, to] of [[p(4, 0), p(5, 0)], [p(4, 2), p(5, 2)], [p(5, 0), p(4, 0)], [p(5, 2), p(4, 2)]]) {
      t = play(t, to, from); assert.ok(t);
    }
  }
  assert.equal(t.result, 'black'); assert.equal(t.reason, '连续长将判负');
});
test('quiet limit draws, revealing resets it', () => {
  const s = sparse(); s.quiet = 119; const next = play(s, p(3, 9), p(4, 9)); assert.equal(next.result, 'draw');
  const b = newGame('banqi'); b.quiet = 79; assert.equal(play(b, p(0, 0)).quiet, 0);
});
test('malformed saves rejected and valid game states round-trip', () => {
  for (const mode of ['xiangqi', 'jieqi', 'gomoku', 'banqi']) assert.equal(validState(clone(newGame(mode)), mode), true);
  const s = newGame('xiangqi'); s.board[0].pop(); assert.equal(validState(s, 'xiangqi'), false);
  const t = newGame('jieqi'); t.board[0][0].mask = 'script'; assert.equal(validState(t, 'jieqi'), false);
  assert.equal(validState(null, 'xiangqi'), false);
});
console.log(`\n${passed} rule tests passed.`);
