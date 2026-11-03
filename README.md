# マインスイーパー・ローグライク

マインスイーパーにローグライク要素を加えたWebアプリ(PWA)です。

## ルール

- 地雷を踏むと **HP-1**。HPが0になるとゲームオーバー
- ステージをクリアすると **遺物を3つの中から1つ** 選べる(同じ遺物は重ねがけ可能)
- ステージが進むほど盤面が大きく、地雷が多くなる
- 操作: タップで開く / 長押し(PC は右クリック)で旗 / 数字タップで周囲を一括オープン

## 遺物

| 遺物 | 効果 |
| --- | --- |
| ❤️ 活力のハート | 最大HP+1、HP1回復 |
| 🛡️ 守りの盾 | 各ステージ最初の被弾を無効化 |
| 🍀 幸運のクローバー | 最初の1手の安全地帯が広がる |
| 🩹 救急箱 | ステージクリア時にHP+1 |
| 📡 スキャナー | 周囲5×5の地雷数を調べる(1ステージ2回) |
| 🔧 解除キット | 地雷を無力化 / 安全マスなら開く(1ステージ1回) |
| 💡 ひらめき | 安全なマスをランダムに1つ開く(1ステージ1回) |

## 開発

```bash
npm install
npm run dev     # 開発サーバー
npm test        # ロジックのテスト
npm run build   # dist/ に本番ビルド
```

## デプロイ(Cloudflare)

`wrangler.jsonc` で `dist/` を静的アセットとして配信します。

```bash
npx wrangler login
npm run deploy
```

GitHub連携(Cloudflare ダッシュボード → Workers & Pages → Create → Import a repository)の場合は、
Build command に `npm run build`、Deploy command に `npx wrangler deploy` を設定してください。

## Androidで使う

- 公開URLをChromeで開き「ホーム画面に追加」でアプリのように起動できます(PWA)
- ストア配布が必要な場合は [Capacitor](https://capacitorjs.com/) で `dist/` をAndroidアプリ化できます

## 今後のアイデア

- 5ステージごとのボス盤面(特殊ルール)
- 遺物の種類追加(地雷の位置を一部ヒント表示、など)
- デイリーラン(シード固定)とスコア共有
- 効果音・アニメーション
