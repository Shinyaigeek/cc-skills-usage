# cc-skills-usage

Claude Code のスキル利用状況を分析・可視化する CLI ツール。

`~/.claude/projects/` に保存された JSONL 形式の会話履歴をスキャンし、スキルの呼び出し回数・プロジェクト別利用状況・トークン消費量・日別トレンドなどを集計します。

## 必要環境

- [Bun](https://bun.sh/)

## 使い方

```bash
bun src/index.ts
```

### オプション

| フラグ | 短縮 | 説明 |
|---|---|---|
| `--output <mode>` | `-o` | 出力モード: `terminal`（デフォルト）または `web` |
| `--from <date>` | | 開始日フィルタ（YYYY-MM-DD） |
| `--to <date>` | | 終了日フィルタ（YYYY-MM-DD） |
| `--project <name>` | `-p` | プロジェクト名の部分一致フィルタ |
| `--skill <name>` | `-s` | スキル名フィルタ |
| `--port <number>` | | Web サーバーのポート（デフォルト: 3939） |
| `--claude-dir <path>` | | `~/.claude` のパスを上書き |
| `--limit <number>` | `-n` | 直近の呼び出し表示件数（デフォルト: 50） |
| `--help` | `-h` | ヘルプを表示 |

### 例

```bash
# ターミナルで表示
bun src/index.ts

# Web ダッシュボードで表示（ブラウザが自動で開きます）
bun src/index.ts --output web

# 日付範囲とスキル名で絞り込み
bun src/index.ts --from 2025-06-01 --to 2025-06-30 --skill review-pr

# 特定プロジェクトの利用状況を確認
bun src/index.ts --project my-app
```

## スキル検出

以下の 2 つの方法でスキル呼び出しを検出します:

1. **Skill tool_use** — アシスタントメッセージ内の `tool_use` ブロック（`name: "Skill"`）
2. **スラッシュコマンド** — ユーザーメッセージ内の `<command-name>` タグ（例: `/devg`, `/review-pr`）

ビルトイン CLI コマンド（`/help`, `/clear` など）は除外されます。同一スキルが両方の方法で検出された場合は重複排除されます。
