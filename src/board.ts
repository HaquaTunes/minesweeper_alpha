export type CellState = 'hidden' | 'open' | 'flag';

export interface Cell {
  mine: boolean;
  adj: number;
  state: CellState;
  /** 踏んでしまった地雷 */
  exploded: boolean;
  /** 解除キットで無力化した地雷 */
  defused: boolean;
  /** スキャナーの結果(5x5内の地雷数) */
  scan: number | null;
}

export interface OpenResult {
  opened: number;
  hits: number;
}

export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Board {
  readonly cells: Cell[];
  placed = false;

  constructor(
    readonly w: number,
    readonly h: number,
    readonly mineCount: number,
    private rng: () => number,
  ) {
    this.cells = Array.from({ length: w * h }, () => ({
      mine: false,
      adj: 0,
      state: 'hidden' as CellState,
      exploded: false,
      defused: false,
      scan: null,
    }));
  }

  neighbors(i: number, r = 1): number[] {
    const x = i % this.w;
    const y = Math.floor(i / this.w);
    const out: number[] = [];
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < this.w && ny < this.h) out.push(ny * this.w + nx);
      }
    }
    return out;
  }

  /** 最初の1手の周囲(safeRadius)には地雷を置かない */
  private ensurePlaced(first: number, safeRadius: number): void {
    if (this.placed) return;
    let banned = new Set([first, ...this.neighbors(first, safeRadius)]);
    let candidates: number[] = [];
    const collect = () => {
      candidates = [];
      for (let i = 0; i < this.cells.length; i++) if (!banned.has(i)) candidates.push(i);
    };
    collect();
    if (candidates.length < this.mineCount) {
      banned = new Set([first]);
      collect();
    }
    const n = Math.min(this.mineCount, candidates.length);
    for (let k = 0; k < n; k++) {
      const j = k + Math.floor(this.rng() * (candidates.length - k));
      [candidates[k], candidates[j]] = [candidates[j], candidates[k]];
      this.cells[candidates[k]].mine = true;
    }
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i].adj = this.neighbors(i).filter((j) => this.cells[j].mine).length;
    }
    this.placed = true;
  }

  open(i: number, safeRadius = 1): OpenResult {
    const res: OpenResult = { opened: 0, hits: 0 };
    const c = this.cells[i];
    if (c.state !== 'hidden') return res;
    this.ensurePlaced(i, safeRadius);
    if (c.mine) {
      c.state = 'open';
      c.exploded = true;
      res.hits = 1;
      return res;
    }
    const stack = [i];
    while (stack.length) {
      const j = stack.pop()!;
      const cj = this.cells[j];
      if (cj.state !== 'hidden') continue;
      cj.state = 'open';
      res.opened++;
      if (cj.adj === 0) {
        for (const n of this.neighbors(j)) if (this.cells[n].state === 'hidden') stack.push(n);
      }
    }
    return res;
  }

  /** 数字マスのコード開き: 周囲の旗数が数字と一致していれば残りを開く */
  chord(i: number): OpenResult {
    const res: OpenResult = { opened: 0, hits: 0 };
    const c = this.cells[i];
    if (c.state !== 'open' || c.adj === 0) return res;
    const ns = this.neighbors(i);
    const marked = ns.filter((n) => this.cells[n].state === 'flag' || this.cells[n].exploded).length;
    if (marked !== c.adj) return res;
    for (const n of ns) {
      const r = this.open(n);
      res.opened += r.opened;
      res.hits += r.hits;
    }
    return res;
  }

  toggleFlag(i: number): boolean {
    const c = this.cells[i];
    if (c.state === 'hidden') c.state = 'flag';
    else if (c.state === 'flag') c.state = 'hidden';
    else return false;
    return true;
  }

  /** 解除キット: 地雷なら無力化して旗に、安全なら普通に開く */
  defuse(i: number): { kind: 'mine' } | { kind: 'safe'; result: OpenResult } | null {
    const c = this.cells[i];
    if (c.state === 'open' || !this.placed) return null;
    if (c.mine) {
      c.state = 'flag';
      c.defused = true;
      return { kind: 'mine' };
    }
    if (c.state === 'flag') c.state = 'hidden';
    return { kind: 'safe', result: this.open(i) };
  }

  /** スキャナー: 5x5範囲内の地雷数を記録する */
  scan(i: number): number | null {
    if (!this.placed) return null;
    const n = [i, ...this.neighbors(i, 2)].filter((j) => this.cells[j].mine).length;
    this.cells[i].scan = n;
    return n;
  }

  /** ひらめき: 安全なマスをランダムに1つ開く */
  safeReveal(): OpenResult | null {
    if (!this.placed) return null;
    const cand: number[] = [];
    this.cells.forEach((c, i) => {
      if (!c.mine && c.state === 'hidden') cand.push(i);
    });
    if (!cand.length) return null;
    return this.open(cand[Math.floor(this.rng() * cand.length)]);
  }

  remainingMines(): number {
    return this.mineCount - this.cells.filter((c) => c.state === 'flag' || c.exploded).length;
  }

  isCleared(): boolean {
    return this.placed && this.cells.every((c) => c.mine || c.state === 'open');
  }
}
