export type ToolId = 'scanner' | 'defuse' | 'flash';

export interface RelicDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  /** アクティブツールになる遺物 */
  tool?: ToolId;
}

export const RELICS: RelicDef[] = [
  { id: 'heart', name: '活力のハート', icon: '❤️', desc: '最大HP+1 / HPを1回復' },
  { id: 'shield', name: '守りの盾', icon: '🛡️', desc: '各ステージ、最初の地雷被弾を1回無効化' },
  { id: 'lucky', name: '幸運のクローバー', icon: '🍀', desc: '最初の1手で開く安全地帯が広がる' },
  { id: 'medic', name: '救急箱', icon: '🩹', desc: 'ステージクリア時にHP+1' },
  { id: 'scanner', name: 'スキャナー', icon: '📡', desc: '[ツール] タップしたマス周囲5×5の地雷数を調べる(1ステージ2回)', tool: 'scanner' },
  { id: 'defuse', name: '解除キット', icon: '🔧', desc: '[ツール] マスを選ぶ。地雷なら無力化、安全なら開く(1ステージ1回)', tool: 'defuse' },
  { id: 'flash', name: 'ひらめき', icon: '💡', desc: '[ツール] 安全なマスをランダムに1つ開く(1ステージ1回)', tool: 'flash' },
];

export const RELIC_MAP: Record<string, RelicDef> = Object.fromEntries(RELICS.map((r) => [r.id, r]));

export interface Run {
  seed: number;
  stage: number;
  hp: number;
  maxHp: number;
  relics: Record<string, number>;
}

export const count = (run: Run, id: string): number => run.relics[id] ?? 0;

export function newRun(seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0): Run {
  return { seed, stage: 1, hp: 3, maxHp: 3, relics: {} };
}

export function stageConfig(stage: number): { w: number; h: number; mines: number } {
  const w = Math.min(7 + Math.ceil(stage / 2), 12);
  const h = Math.min(w + Math.floor(stage / 3), 16);
  const density = Math.min(0.12 + 0.012 * stage, 0.25);
  return { w, h, mines: Math.round(w * h * density) };
}

export function rollChoices(rng: () => number, n = 3): RelicDef[] {
  const pool = [...RELICS];
  const out: RelicDef[] = [];
  while (out.length < n && pool.length) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return out;
}

export function applyRelic(run: Run, id: string): void {
  run.relics[id] = count(run, id) + 1;
  if (id === 'heart') {
    run.maxHp += 1;
    run.hp = Math.min(run.maxHp, run.hp + 1);
  }
}

export function stageCharges(run: Run): Record<ToolId, number> {
  return {
    scanner: count(run, 'scanner') * 2,
    defuse: count(run, 'defuse'),
    flash: count(run, 'flash'),
  };
}

export const safeRadius = (run: Run): number => Math.min(1 + count(run, 'lucky'), 3);
export const shieldsPerStage = (run: Run): number => count(run, 'shield');

export function onStageClear(run: Run): void {
  run.hp = Math.min(run.maxHp, run.hp + count(run, 'medic'));
}
