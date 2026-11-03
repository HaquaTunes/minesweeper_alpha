import './style.css';
import { Board, mulberry32 } from './board';
import {
  RELIC_MAP,
  RELICS,
  ToolId,
  Run,
  applyRelic,
  newRun,
  onStageClear,
  rollChoices,
  safeRadius,
  shieldsPerStage,
  stageCharges,
  stageConfig,
} from './game';

const BEST_KEY = 'msr-best';
const loadBest = (): number => {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
};
const saveBest = (v: number): void => {
  try {
    localStorage.setItem(BEST_KEY, String(v));
  } catch {
    /* ignore */
  }
};

const app = document.getElementById('app')!;
app.innerHTML = `
  <header id="hud"></header>
  <div id="tools"></div>
  <main id="gridwrap"><div id="grid"></div></main>
  <footer id="relics"></footer>
  <div id="overlay" hidden></div>
  <div id="toast"></div>`;
const $ = <T extends HTMLElement>(s: string) => app.querySelector<T>(s)!;
const hud = $('#hud');
const toolsEl = $('#tools');
const grid = $('#grid');
const relicsEl = $('#relics');
const overlay = $('#overlay');
const toastEl = $('#toast');

let run: Run = newRun();
let board: Board;
let els: HTMLButtonElement[] = [];
let charges: Record<ToolId, number>;
let shield = 0;
let tool: ToolId | null = null;
let flagMode = false;
let locked = true;
let ended = false;

// ---------- 表示 ----------
let toastTimer = 0;
function toast(msg: string): void {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 1600);
}

function paint(i: number): void {
  const c = board.cells[i];
  let cls = 'cell';
  let txt = '';
  if (c.state === 'open') {
    cls += ' open';
    if (c.exploded) {
      cls += ' boom';
      txt = '💥';
    } else if (c.adj > 0) {
      cls += ' n' + c.adj;
      txt = String(c.adj);
    }
  } else if (c.state === 'flag') {
    cls += ' flag';
    txt = '🚩';
  } else {
    if (c.scan !== null) {
      cls += ' scan';
      txt = String(c.scan);
    }
    if (ended && c.mine) {
      cls += ' reveal';
      txt = '💣';
    }
  }
  const el = els[i];
  el.className = cls;
  if (el.textContent !== txt) el.textContent = txt;
}

function update(): void {
  const hearts =
    '❤️'.repeat(Math.max(run.hp, 0)) + '🖤'.repeat(Math.max(run.maxHp - Math.max(run.hp, 0), 0));
  hud.innerHTML = `
    <div class="stat"><small>STAGE</small><b>${run.stage}</b></div>
    <div class="stat hearts">${hearts}${shield > 0 ? `<span class="sh">🛡️×${shield}</span>` : ''}</div>
    <div class="stat"><small>💣 残り</small><b>${board.remainingMines()}</b></div>`;

  const btns: string[] = [];
  for (const r of RELICS) {
    if (!r.tool || !run.relics[r.id]) continue;
    const n = charges[r.tool];
    btns.push(
      `<button class="tool${tool === r.tool ? ' active' : ''}" data-tool="${r.tool}" ${n <= 0 ? 'disabled' : ''}>${r.icon}<span>${n}</span></button>`,
    );
  }
  btns.push(`<button class="tool flagbtn${flagMode ? ' active' : ''}" data-flag="1">🚩 旗モード</button>`);
  if (ended) btns.push(`<button class="tool retry" data-retry="1">↻ もう一度</button>`);
  toolsEl.innerHTML = btns.join('');

  relicsEl.innerHTML =
    Object.entries(run.relics)
      .map(([id, n]) => `<span title="${RELIC_MAP[id].name}">${RELIC_MAP[id].icon}${n > 1 ? `×${n}` : ''}</span>`)
      .join('') || '<em>遺物なし — ステージをクリアして手に入れよう</em>';

  for (let i = 0; i < els.length; i++) paint(i);
}

function showOverlay(html: string): void {
  overlay.innerHTML = `<div class="panel">${html}</div>`;
  overlay.hidden = false;
}
const hideOverlay = (): void => {
  overlay.hidden = true;
};

// ---------- ゲーム進行 ----------
function buildStage(): void {
  const cfg = stageConfig(run.stage);
  board = new Board(cfg.w, cfg.h, cfg.mines, mulberry32(run.seed + run.stage * 7919));
  charges = stageCharges(run);
  shield = shieldsPerStage(run);
  tool = null;
  locked = false;
  ended = false;
  grid.style.setProperty('--cols', String(cfg.w));
  grid.innerHTML = '';
  els = [];
  for (let i = 0; i < cfg.w * cfg.h; i++) {
    const b = document.createElement('button');
    b.dataset.i = String(i);
    grid.appendChild(b);
    els.push(b);
  }
  update();
}

function startRun(): void {
  run = newRun();
  hideOverlay();
  buildStage();
}

function showTitle(): void {
  locked = true;
  showOverlay(`
    <h1>💣 マインスイーパー<br>ローグライク</h1>
    <ul class="rules">
      <li>地雷を踏むと<b>HP-1</b>。HPが0でゲームオーバー</li>
      <li>ステージをクリアすると<b>遺物を1つ</b>選べます</li>
      <li>ステージが進むほど盤面と地雷が増えます</li>
      <li>操作: タップで開く / <b>長押しか右クリックで旗</b> / 数字をタップで周囲を一括オープン</li>
    </ul>
    <p class="best">ベスト: ${loadBest()} ステージクリア</p>
    <button class="primary" data-start="1">ゲーム開始</button>`);
}

function gameOver(): void {
  ended = true;
  locked = true;
  const cleared = run.stage - 1;
  const newBest = cleared > loadBest();
  if (newBest) saveBest(cleared);
  update();
  window.setTimeout(() => {
    showOverlay(`
      <h2>ゲームオーバー</h2>
      <p class="big">${cleared} ステージクリア</p>
      ${newBest ? '<p class="best">🎉 ベスト更新!</p>' : `<p class="best">ベスト: ${loadBest()}</p>`}
      <button class="primary" data-start="1">もう一度</button>
      <button data-view="1">盤面を見る</button>`);
  }, 700);
}

function stageClear(): void {
  locked = true;
  onStageClear(run);
  if (run.stage > loadBest()) saveBest(run.stage);
  update();
  const choices = rollChoices(Math.random);
  window.setTimeout(() => {
    showOverlay(`
      <h2>ステージ ${run.stage} クリア!</h2>
      <p>遺物を1つ選んでください</p>
      <div class="choices">
        ${choices
          .map(
            (r) => `<button class="relic" data-relic="${r.id}">
              <span class="ic">${r.icon}</span>
              <span><b>${r.name}</b>${run.relics[r.id] ? ` <small>(所持 ${run.relics[r.id]})</small>` : ''}<br><small>${r.desc}</small></span>
            </button>`,
          )
          .join('')}
      </div>`);
  }, 400);
}

function afterMove(hits: number): void {
  for (let k = 0; k < hits; k++) {
    navigator.vibrate?.(60);
    if (shield > 0) {
      shield--;
      toast('🛡️ 盾が地雷を防いだ!');
    } else {
      run.hp--;
    }
  }
  if (run.hp <= 0) return gameOver();
  if (board.isCleared()) return stageClear();
  update();
}

function useTool(i: number): void {
  const t = tool!;
  if (!board.placed) {
    toast('最初の1マスを開いてから使えます');
    return;
  }
  const c = board.cells[i];
  if (c.state === 'open') {
    toast('開いているマスには使えません');
    return;
  }
  let hits = 0;
  if (t === 'scanner') {
    board.scan(i);
  } else if (t === 'defuse') {
    const r = board.defuse(i);
    if (r?.kind === 'mine') toast('🔧 地雷を無力化!');
    if (r?.kind === 'safe') hits = r.result.hits;
  }
  charges[t]--;
  tool = null;
  afterMove(hits);
}

function pressCell(i: number): void {
  if (locked) return;
  if (tool) return useTool(i);
  const c = board.cells[i];
  if (c.state === 'open') return afterMove(board.chord(i).hits);
  if (flagMode) {
    board.toggleFlag(i);
    return update();
  }
  if (c.state === 'flag') return;
  afterMove(board.open(i, safeRadius(run)).hits);
}

function flagCell(i: number): void {
  if (locked || tool) return;
  if (board.toggleFlag(i)) {
    navigator.vibrate?.(20);
    update();
  }
}

// ---------- 入力 ----------
const cellOf = (e: Event): number | null => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
  return t ? Number(t.dataset.i) : null;
};

let pressTimer = 0;
let longFired = false;
let lastPointerType = 'mouse';

grid.addEventListener('pointerdown', (e) => {
  lastPointerType = e.pointerType;
  const i = cellOf(e);
  if (i === null || e.pointerType === 'mouse') return;
  longFired = false;
  pressTimer = window.setTimeout(() => {
    longFired = true;
    flagCell(i);
  }, 350);
});
const cancelPress = () => clearTimeout(pressTimer);
grid.addEventListener('pointerleave', cancelPress);
grid.addEventListener('pointercancel', cancelPress);
grid.addEventListener('pointerup', (e) => {
  cancelPress();
  const i = cellOf(e);
  if (i === null) return;
  if (longFired) {
    longFired = false;
    return;
  }
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  pressCell(i);
});
grid.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const i = cellOf(e);
  if (i !== null && lastPointerType === 'mouse') flagCell(i);
});

toolsEl.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('button');
  if (!b) return;
  if (b.dataset.retry) return startRun();
  if (locked) return;
  if (b.dataset.flag) {
    flagMode = !flagMode;
    return update();
  }
  const t = b.dataset.tool as ToolId | undefined;
  if (!t || charges[t] <= 0) return;
  if (t === 'flash') {
    if (!board.placed) return toast('最初の1マスを開いてから使えます');
    const r = board.safeReveal();
    if (r) charges.flash--;
    return afterMove(r?.hits ?? 0);
  }
  tool = tool === t ? null : t;
  if (tool) toast(t === 'scanner' ? '📡 調べるマスをタップ' : '🔧 解除するマスをタップ');
  update();
});

overlay.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('button');
  if (!b) return;
  if (b.dataset.start) return startRun();
  if (b.dataset.view) return hideOverlay();
  if (b.dataset.relic) {
    applyRelic(run, b.dataset.relic);
    run.stage++;
    hideOverlay();
    buildStage();
  }
});

// 初期表示
run = newRun();
buildStage();
showTitle();
