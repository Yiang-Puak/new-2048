import { MODES, NAMES, newGame, play, targets, validState, dimensions, clone } from './engine.mjs';
import { inCheck, other } from './xiangqi-rules.mjs';

const $ = id => document.getElementById(id);
const requested = new URLSearchParams(location.search).get('game');
const mode = MODES.includes(requested) ? requested : 'xiangqi';
const titles = { xiangqi: '中国象棋', gomoku: '五子棋', banqi: '翻翻棋', jieqi: '揭棋' };
const tags = { xiangqi: '楚河汉界 · 双人同屏', gomoku: '自由规则 · 双人同屏', banqi: '小盘暗棋 · 双人同屏', jieqi: '未知棋局 · 双人同屏' };
const storageKey = `idle-games.v1.${mode}`;
const rules = {
  xiangqi: ['红方先行。点己方棋子，再点绿点或红圈落子。', '车走直线，马走日且不能蹩腿，相走田且不能塞眼、过河；仕斜走一格、帅横竖一格，都不出九宫。', '炮移动时不能越子，吃子时必须隔一枚棋子；兵只向前，过河后可以横走。', '不能主动送将或让将帅照面；被将死或困毙的一方负。', '重新开局可以选红方/黑方让一马，或两种残局练习。残局是供双方继续对弈的练习局面。'],
  gomoku: ['15 × 15 棋盘，黑方先行，两人轮流在空交叉点落一子。', '横、竖、任一斜向连续五子或更多即获胜。', '采用自由规则：没有三三、四四、长连等禁手。棋盘下满且无人连五则和棋。'],
  banqi: ['4 × 8 棋盘，32 枚棋子随机盖住。玩家一先翻，第一枚翻出的颜色就是玩家一的颜色。', '每回合选择翻一枚暗子，或移动自己的明子；不能移动暗子，也不能吃暗子。', '棋子沿横竖移动一格。大小顺序为：将/帅 ＞ 士/仕 ＞ 象/相 ＞ 车 ＞ 马 ＞ 炮 ＞ 卒/兵。一般可吃同级或更小的棋子。', '兵/卒可以吃将/帅，将/帅不能吃兵/卒。炮只能隔恰好一枚棋子（明暗均可）吃明子，不受大小限制；炮走空格仍为横竖一格。', '没有暗子可翻且无合法走法的一方负；80 步未翻子或吃子判和。这是本合集选用的暗棋规则。'],
  jieqi: ['红方先行，将帅明摆，其余各 15 枚棋子在本方的标准开局位置随机盖住。', '暗子第一步按它所在开局位置的名义棋子走法移动，走完自动揭开。例如暗炮先按炮走，翻出马后就按马走。', '揭开的士可以斜走一格，不限九宫；象走田且不能塞眼，士象都可以过河。其他明子按普通象棋走法，将帅仍不能出九宫。', '不能主动送将或让将帅照面；将死、困毙判负。暗子的攻击按名义走法判断。', '被吃掉的暗子保持隐藏，双方都不能查看。悔棋会恢复盖住状态，但已知信息无法忘记，请双方同意后再悔棋。']
};
let state = newGame(mode), history = [], selected = null, flipped = false, face = true, message = '';
try {
  const raw = localStorage.getItem(storageKey);
  if (raw) {
    const saved = JSON.parse(raw);
    if (!validState(saved.state, mode) || !Array.isArray(saved.history) || saved.history.length > 100
      || !saved.history.every(s => validState(s, mode))) throw new Error('Invalid saved game');
    state = saved.state; history = saved.history;
    flipped = saved.flipped === true; face = saved.face !== false;
    message = state.ply ? '已恢复上次棋局。' : '';
  }
} catch {
  message = '存档暂时无法读取，已准备新棋盘。';
}

document.title = `${titles[mode]} · 闲棋`;
document.body.classList.add(`mode-${mode}`);
$('game-title').textContent = titles[mode];
$('game-tag').textContent = tags[mode];
$('face-to-face').checked = face;
$('rules-content').replaceChildren();
const ul = document.createElement('ul');
for (const rule of rules[mode]) { const li = document.createElement('li'); li.textContent = rule; ul.append(li); }
$('rules-content').append(ul);
const footnote = document.createElement('p');
footnote.className = 'rules-footnote';
footnote.textContent = (mode === 'xiangqi' || mode === 'jieqi'
  ? '休闲判和：三次重复局面判和；其中单方每步都将军则该方长将判负；120步未吃子或揭子判和。长捉等竞赛细则由双方协商。' : mode === 'banqi' ? '三次重复局面判和。' : '')
  + ' 可撤回最近100步；认输、和棋、新开局均需确认。';
$('rules-content').append(footnote);

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ state, history, flipped, face }));
    $('save-note').textContent = '每走一步自动保存，随时回来继续。';
  } catch {
    $('save-note').textContent = '浏览器存储不可用，本局可继续；离开前请留意棋局无法保存。';
  }
}

function remember() { history.push(clone(state)); if (history.length > 100) history.shift(); }
function accept(next) {
  remember(); state = next; selected = null; message = ''; save(); render();
}
const same = (a, b) => a && b && a.x === b.x && a.y === b.y;
const sideLabel = side => mode === 'gomoku' ? side === 'black' ? '黑方' : '白方' : side === 'red' ? '红方' : '黑方';
const topColor = () => mode === 'gomoku' ? flipped ? 'black' : 'white'
  : mode === 'banqi' ? flipped ? state.firstSide || 'red' : other(state.firstSide || 'red')
  : flipped ? 'red' : 'black';
const pieceLabel = p => p.covered ? (mode === 'banqi' ? '未翻开的棋子' : `${sideLabel(p.side)}暗${NAMES[p.side][p.mask]}`)
  : mode === 'gomoku' ? `${sideLabel(p.side)}棋子` : `${sideLabel(p.side)}${NAMES[p.side][p.type]}`;

function choose(pos) {
  if (state.result) { message = '本局已结束，可以悔棋或重新开局。'; renderInfo(); return; }
  const p = state.board[pos.y][pos.x];
  if (mode === 'gomoku' || (mode === 'banqi' && p?.covered)) {
    const next = play(state, pos);
    if (next) accept(next); else { message = '这里已有棋子，请选空位。'; renderInfo(); }
    return;
  }
  if (selected && same(selected, pos)) { selected = null; message = ''; render(); return; }
  if (selected) {
    const next = play(state, pos, selected);
    if (next) { accept(next); return; }
  }
  if (p?.side === state.turn) {
    selected = pos;
    const moves = targets(state, pos);
    message = !moves.length ? '这枚棋子暂时无合法走法。' : mode === 'banqi'
      ? p.type === 'cannon' ? '炮横竖走一格；吃子隔一枚棋，不限大小。'
        : p.type === 'pawn' ? '兵卒横竖走一格，可吃同级兵卒或将帅。'
        : p.type === 'king' ? '将帅横竖走一格，可吃除兵卒外的明子。'
        : `${NAMES[p.side][p.type]}横竖走一格，可吃同级或较小的明子。`
      : '点绿点移动，点红圈吃子。';
  } else message = '请先选己方棋子，再点可走位置。';
  render();
}

const board = $('board');
function renderBoard() {
  const focused = document.activeElement?.closest?.('[data-x]');
  const focusPos = focused ? { x: +focused.dataset.x, y: +focused.dataset.y } : null;
  const [w, h] = dimensions(mode), gap = 60, padding = 36;
  const vw = padding * 2 + (w - 1) * gap, vh = padding * 2 + (h - 1) * gap;
  board.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
  board.setAttribute('aria-label', `${titles[mode]}棋盘，用方向键选择位置，回车落子`);
  const xy = (x, y) => ({ x: padding + (flipped ? w - 1 - x : x) * gap, y: padding + (flipped ? h - 1 - y : y) * gap });
  let svg = '<defs><radialGradient id="black-stone" cx="30%" cy="25%"><stop stop-color="#60675c"/><stop offset="1" stop-color="#1c251d"/></radialGradient><radialGradient id="white-stone" cx="30%" cy="25%"><stop stop-color="#fffef7"/><stop offset="1" stop-color="#d2d4c4"/></radialGradient></defs>';
  const line = (x1, y1, x2, y2) => `<path class="board-grid" d="M${x1} ${y1}L${x2} ${y2}"/>`;
  if (mode === 'banqi') {
    for (let y = 0; y <= h; y++) svg += line(6, 6 + y * gap, vw - 6, 6 + y * gap);
    for (let x = 0; x <= w; x++) svg += line(6 + x * gap, 6, 6 + x * gap, vh - 6);
  } else {
    for (let y = 0; y < h; y++) svg += line(padding, padding + y * gap, vw - padding, padding + y * gap);
    for (let x = 0; x < w; x++) {
      const cx = padding + x * gap;
      if (mode !== 'gomoku' && x > 0 && x < w - 1) {
        svg += line(cx, padding, cx, padding + 4 * gap) + line(cx, padding + 5 * gap, cx, vh - padding);
      } else svg += line(cx, padding, cx, vh - padding);
    }
    if (mode === 'gomoku') {
      for (const [x, y] of [[3, 3], [11, 3], [7, 7], [3, 11], [11, 11]]) svg += `<circle class="board-dot" cx="${padding + x * gap}" cy="${padding + y * gap}" r="4"/>`;
    } else {
      for (const y of [0, 7]) {
        svg += line(padding + 3 * gap, padding + y * gap, padding + 5 * gap, padding + (y + 2) * gap)
          + line(padding + 5 * gap, padding + y * gap, padding + 3 * gap, padding + (y + 2) * gap);
      }
      svg += `<text class="river-label" x="${padding + 1.7 * gap}" y="${padding + 4.63 * gap}">${flipped ? '汉 界' : '楚 河'}</text><text class="river-label" x="${padding + 5.5 * gap}" y="${padding + 4.63 * gap}">${flipped ? '楚 河' : '汉 界'}</text>`;
    }
  }
  const moves = selected ? targets(state, selected) : [];
  const topSide = topColor();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const pos = { x, y }, c = xy(x, y), p = state.board[y][x];
    const label = `${x + 1}列${y + 1}行，${p ? pieceLabel(p) : '空位'}`;
    const active = focusPos ? same(pos, focusPos) : x === 0 && y === 0;
    svg += `<g class="board-cell" data-x="${x}" data-y="${y}" transform="translate(${c.x} ${c.y})" role="button" tabindex="${active ? 0 : -1}" aria-label="${label}" aria-disabled="${!!state.result}"><rect class="hit-area" x="-29" y="-29" width="58" height="58" fill="transparent" rx="4"/>`;
    if (p) {
      if (mode === 'gomoku') svg += `<circle class="stone-${p.side}" r="25"/>`;
      else {
        svg += `<circle class="${p.covered ? 'covered-base' : 'piece-base'}" r="25"/>`;
        if (!p.covered) svg += '<circle class="piece-ring" r="21"/>';
        const rotation = face && p.side === topSide && !(mode === 'banqi' && p.covered) ? ' transform="rotate(180)"' : '';
        svg += `<text class="piece-label ${p.covered ? 'covered-label' : p.side + '-piece'}"${rotation}>${p.covered ? '✦' : NAMES[p.side][p.type]}</text>`;
      }
    }
    if (same(pos, state.last?.to) || same(pos, state.last?.from)) {
      svg += mode === 'gomoku' ? '<circle class="last-stone" r="5"/>' : '<circle class="last-ring" r="28"/>';
    }
    if (same(pos, selected)) svg += '<circle class="selected-ring" r="28"/>';
    if (moves.some(m => same(m, pos))) svg += p ? '<circle class="capture-ring" r="28"/>' : '<circle class="legal-dot" r="8"/>';
    svg += '</g>';
  }
  board.innerHTML = svg;
  if (focusPos) board.querySelector(`[data-x="${focusPos.x}"][data-y="${focusPos.y}"]`)?.focus({ preventScroll: true });
}

function renderInfo() {
  const topSide = topColor();
  const bottomSide = mode === 'gomoku' ? topSide === 'black' ? 'white' : 'black' : other(topSide);
  for (const [id, side, top] of [['top-player', topSide, true], ['bottom-player', bottomSide, false]]) {
    const el = $(id);
    el.className = `player-bar ${top && face ? 'opponent-facing' : ''} ${!state.result && state.turn === side ? 'player-active' : ''}`;
    if (mode === 'banqi' && !state.firstSide) {
      const first = top === flipped;
      el.innerHTML = `<span class="player-name">${first ? '玩家一' : '玩家二'}</span><span>${first ? '先翻一枚棋子' : '等待分配颜色'}</span>`;
    }
    else {
      const who = mode === 'banqi' ? ` · 玩家${side === state.firstSide ? '一' : '二'}` : '';
      el.innerHTML = `<span class="player-name"><i class="player-dot ${side}"></i>${sideLabel(side)}${who}</span><span>${!state.result && state.turn === side ? '轮到你' : '双人同屏'}</span>`;
    }
  }
  const check = !state.result && ['xiangqi', 'jieqi'].includes(mode) && inCheck(state.board, state.turn, mode);
  $('turn-title').textContent = state.result ? state.result === 'draw' ? '和棋' : `${sideLabel(state.result)}获胜`
    : mode === 'banqi' && !state.firstSide ? '玩家一先翻棋' : `${sideLabel(state.turn)}走棋${check ? ' · 将军' : ''}`;
  $('status').textContent = state.result ? state.reason : message || (check ? '请先解除将军，再继续走棋。'
    : mode === 'gomoku' ? '点空交叉点落子，连续五子获胜。' : mode === 'banqi' ? '明子横竖走一格，按大小吃子；也可翻暗子。' : '点己方棋子，再点可走位置。');
  $('undo').disabled = !history.length;
  $('resign').disabled = !!state.result || (mode === 'banqi' && !state.firstSide);
  $('draw').disabled = !!state.result;
  $('move-count').textContent = `${state.ply} 步`;
  $('moves').replaceChildren();
  if (!state.log.length) { const li = document.createElement('li'); li.textContent = '第一步，从你开始。'; $('moves').append(li); }
  state.log.slice(-12).forEach((text, i, list) => {
    const li = document.createElement('li'); li.textContent = `${state.log.length - list.length + i + 1}. ${text}`; $('moves').append(li);
  });
  $('moves').scrollTop = $('moves').scrollHeight;
  $('captured').replaceChildren();
  if (!state.captured.length) {
    const span = document.createElement('span'); span.className = 'empty-note'; span.textContent = mode === 'gomoku' ? '五子棋没有吃子。' : '还没有吃子。'; $('captured').append(span);
  }
  for (const p of state.captured) {
    const span = document.createElement('span'); span.className = `captured-token ${p.covered ? 'hidden-piece' : p.side}`;
    span.textContent = p.covered ? '✦' : NAMES[p.side][p.type];
    span.setAttribute('aria-label', p.covered ? '被吃的暗子，身份不公开' : pieceLabel(p)); $('captured').append(span);
  }
}
function render() { renderBoard(); renderInfo(); }

board.addEventListener('click', e => {
  const cell = e.target.closest('[data-x]');
  if (cell) choose({ x: +cell.dataset.x, y: +cell.dataset.y });
});
board.addEventListener('keydown', e => {
  const cell = e.target.closest('[data-x]');
  if (!cell) return;
  const pos = { x: +cell.dataset.x, y: +cell.dataset.y };
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(pos); return; }
  if (e.key === 'Escape') { selected = null; message = ''; render(); return; }
  const vector = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (!vector) return;
  e.preventDefault();
  const [w, h] = dimensions(mode), sign = flipped ? -1 : 1;
  const x = Math.max(0, Math.min(w - 1, pos.x + vector[0] * sign)), y = Math.max(0, Math.min(h - 1, pos.y + vector[1] * sign));
  cell.setAttribute('tabindex', '-1');
  const next = board.querySelector(`[data-x="${x}"][data-y="${y}"]`); next.setAttribute('tabindex', '0'); next.focus();
});

let pending = null;
function confirmAction(title, copy, action, setup = false) {
  $('confirm-title').textContent = title; $('confirm-copy').textContent = copy;
  $('setup-area').hidden = !setup;
  if (setup) $('setup').value = state.setup;
  pending = action; $('confirm-dialog').showModal();
}
$('confirm-cancel').addEventListener('click', () => $('confirm-dialog').close());
$('confirm-dialog').addEventListener('close', () => { pending = null; });
$('confirm-ok').addEventListener('click', () => { const action = pending; $('confirm-dialog').close(); action?.(); });
$('rules-button').addEventListener('click', () => $('rules-dialog').showModal());
document.querySelectorAll('.dialog-close').forEach(button => button.addEventListener('click', () => $('rules-dialog').close()));
$('flip').addEventListener('click', () => { flipped = !flipped; save(); render(); });
$('face-to-face').addEventListener('change', e => { face = e.target.checked; save(); render(); });
$('undo').addEventListener('click', () => {
  const undo = () => { if (history.length) { state = history.pop(); selected = null; message = '已撤回一步。'; save(); render(); } };
  if (mode === 'jieqi' || mode === 'banqi') confirmAction('双方同意悔棋吗？', '棋子会恢复到上一步，但已经揭开的信息无法忘记。请双方同意后再确认。', undo);
  else undo();
});
$('new-game').addEventListener('click', () => confirmAction('重新开一局', '确认后将替换当前棋局。', () => {
  state = newGame(mode, mode === 'xiangqi' ? $('setup').value : 'standard'); history = []; selected = null; message = ''; save(); render();
}, mode === 'xiangqi'));
$('resign').addEventListener('click', () => confirmAction(`${sideLabel(state.turn)}确认认输？`, '确认后本局结束，对方获胜。', () => {
  const next = clone(state); next.result = mode === 'gomoku' ? state.turn === 'black' ? 'white' : 'black' : other(state.turn);
  next.reason = `${sideLabel(state.turn)}认输`; accept(next);
}));
$('draw').addEventListener('click', () => confirmAction('双方都同意和棋吗？', '请双方同意后确认，本局将以和棋结束。', () => {
  const next = clone(state); next.result = 'draw'; next.reason = '双方同意和棋'; accept(next);
}));
render();
if (!message.startsWith('存档')) save();
