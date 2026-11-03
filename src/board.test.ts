import { describe, expect, it } from 'vitest';
import { Board, mulberry32 } from './board';
import { stageConfig } from './game';

const make = (w = 8, h = 8, m = 10, seed = 1) => new Board(w, h, m, mulberry32(seed));

describe('Board', () => {
  it('最初の1手とその周囲は必ず安全', () => {
    for (let seed = 0; seed < 50; seed++) {
      const b = make(8, 8, 20, seed);
      const first = 27;
      const r = b.open(first, 1);
      expect(r.hits).toBe(0);
      expect(b.cells[first].mine).toBe(false);
      for (const n of b.neighbors(first)) expect(b.cells[n].mine).toBe(false);
    }
  });

  it('地雷数が指定通り配置される', () => {
    const b = make(8, 8, 10);
    b.open(0);
    expect(b.cells.filter((c) => c.mine).length).toBe(10);
  });

  it('地雷を踏むとhitsが増え、exploded になる', () => {
    const b = make();
    b.open(0);
    const mine = b.cells.findIndex((c) => c.mine);
    const r = b.open(mine);
    expect(r.hits).toBe(1);
    expect(b.cells[mine].exploded).toBe(true);
  });

  it('安全マスを全部開くとクリア', () => {
    const b = make();
    b.open(0);
    b.cells.forEach((c, i) => {
      if (!c.mine) b.open(i);
    });
    expect(b.isCleared()).toBe(true);
  });

  it('解除キットは地雷を無力化し、安全マスは開く', () => {
    const b = make();
    b.open(0);
    const mine = b.cells.findIndex((c) => c.mine);
    expect(b.defuse(mine)).toEqual({ kind: 'mine' });
    expect(b.cells[mine].state).toBe('flag');
    const safe = b.cells.findIndex((c) => !c.mine && c.state === 'hidden');
    const r = b.defuse(safe);
    expect(r?.kind).toBe('safe');
    expect(b.cells[safe].state).toBe('open');
  });

  it('スキャナーは5x5範囲の地雷数を返す', () => {
    const b = make();
    b.open(0);
    const i = 36;
    const expected = [i, ...b.neighbors(i, 2)].filter((j) => b.cells[j].mine).length;
    expect(b.scan(i)).toBe(expected);
  });

  it('コード開きは旗の数が一致したときだけ動く', () => {
    const b = make(8, 8, 10, 3);
    b.open(27);
    const num = b.cells.findIndex((c) => c.state === 'open' && c.adj > 0);
    expect(num).toBeGreaterThanOrEqual(0);
    expect(b.chord(num)).toEqual({ opened: 0, hits: 0 });
    for (const n of b.neighbors(num)) if (b.cells[n].mine) b.toggleFlag(n);
    expect(b.chord(num).hits).toBe(0);
  });
});

describe('stageConfig', () => {
  it('ステージが進むほど盤面と地雷が増える', () => {
    const a = stageConfig(1);
    const b = stageConfig(10);
    expect(b.w * b.h).toBeGreaterThan(a.w * a.h);
    expect(b.mines).toBeGreaterThan(a.mines);
  });
});
