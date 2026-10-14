// Adapted from Hanazar-Games/XiangQi-webgame (MIT, © 2026 Hanazar Games).
// Modified: share attack/movement rules, support covered pieces and revealed advisors/elephants.
// The original license is preserved in licenses/Hanazar-Games-MIT.txt.
export const other = side => side === 'red' ? 'black' : 'red';
export const inside = p => p && Number.isInteger(p.x) && Number.isInteger(p.y)
  && p.x >= 0 && p.x < 9 && p.y >= 0 && p.y < 10;
const palace = (p, side) => p.x >= 3 && p.x <= 5
  && (side === 'red' ? p.y >= 7 : p.y <= 2);

export function between(board, from, to) {
  if (from.x === to.x && from.y === to.y) return -1;
  if (from.x !== to.x && from.y !== to.y) return -1;
  const sx = Math.sign(to.x - from.x), sy = Math.sign(to.y - from.y);
  let count = 0;
  for (let x = from.x + sx, y = from.y + sy; x !== to.x || y !== to.y; x += sx, y += sy) {
    if (board[y][x]) count++;
  }
  return count;
}

export function canMove(board, from, to, mode = 'xiangqi') {
  if (!inside(from) || !inside(to) || (from.x === to.x && from.y === to.y)) return false;
  const piece = board[from.y][from.x], target = board[to.y][to.x];
  if (!piece || target?.side === piece.side) return false;
  const type = piece.covered ? piece.mask : piece.type;
  const dx = to.x - from.x, dy = to.y - from.y;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  const unrestricted = mode === 'jieqi' && !piece.covered;
  switch (type) {
    case 'king':
      if (dx === 0 && target?.type === 'king' && !target.covered) {
        return between(board, from, to) === 0;
      }
      return ax + ay === 1 && palace(to, piece.side);
    case 'advisor':
      return ax === 1 && ay === 1 && (unrestricted || palace(to, piece.side));
    case 'elephant':
      return ax === 2 && ay === 2 && !board[from.y + dy / 2][from.x + dx / 2]
        && (unrestricted || (piece.side === 'red' ? to.y >= 5 : to.y <= 4));
    case 'horse':
      if (ax === 2 && ay === 1) return !board[from.y][from.x + Math.sign(dx)];
      if (ax === 1 && ay === 2) return !board[from.y + Math.sign(dy)][from.x];
      return false;
    case 'rook': return between(board, from, to) === 0;
    case 'cannon': return between(board, from, to) === (target ? 1 : 0);
    case 'pawn': {
      const forward = piece.side === 'red' ? -1 : 1;
      const crossed = piece.side === 'red' ? from.y <= 4 : from.y >= 5;
      return (dx === 0 && dy === forward) || (crossed && ax === 1 && dy === 0);
    }
    default: return false;
  }
}

export function findKing(board, side) {
  for (let y = 0; y < 10; y++) for (let x = 0; x < 9; x++) {
    const p = board[y][x];
    if (p?.type === 'king' && !p.covered && p.side === side) return { x, y };
  }
  return null;
}

export function inCheck(board, side, mode = 'xiangqi') {
  const king = findKing(board, side);
  if (!king) return true;
  for (let y = 0; y < 10; y++) for (let x = 0; x < 9; x++) {
    if (board[y][x]?.side === other(side) && canMove(board, { x, y }, king, mode)) return true;
  }
  return false;
}

export function legalMove(board, from, to, mode = 'xiangqi') {
  if (!canMove(board, from, to, mode)) return false;
  const next = board.map(row => row.slice()), piece = board[from.y][from.x];
  next[to.y][to.x] = { ...piece, covered: false };
  next[from.y][from.x] = null;
  return !inCheck(next, piece.side, mode);
}

export function hasMoves(board, side, mode = 'xiangqi') {
  for (let y = 0; y < 10; y++) for (let x = 0; x < 9; x++) {
    if (board[y][x]?.side !== side) continue;
    for (let ty = 0; ty < 10; ty++) for (let tx = 0; tx < 9; tx++) {
      if (legalMove(board, { x, y }, { x: tx, y: ty }, mode)) return true;
    }
  }
  return false;
}
