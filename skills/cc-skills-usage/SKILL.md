---
name: cc-skills-usage
description: Claude Code のスキル利用状況を分析してターミナルに表示する。利用頻度、プロジェクト別統計、トークン使用量などを確認できる。
argument-hint: "[options]"
---

# cc-skills-usage

Claude Code のスキル利用状況を分析するCLIを実行し、結果を表示する。

## 実行方法

以下のコマンドを Bash ツールで実行する:

```bash
bun /Users/shinobu.hayashi/Documents/s9k/cc-skills-usage/packages/cli/src/index.ts [ユーザー指定のオプション]
```

ユーザーが引数を指定した場合は、そのままコマンドに渡す。引数がない場合はオプションなしで実行する。

## 利用可能なオプション

| オプション | 短縮 | 説明 |
|---|---|---|
| `--from <date>` | | 開始日フィルタ (YYYY-MM-DD) |
| `--to <date>` | | 終了日フィルタ (YYYY-MM-DD) |
| `--project <name>` | `-p` | プロジェクトパスの部分一致フィルタ |
| `--skill <name>` | `-s` | スキル名フィルタ |
| `--output <mode>` | `-o` | `terminal` (デフォルト) または `web` |
| `--limit <number>` | `-n` | 表示する最近の呼び出し数 (デフォルト: 50) |
| `--port <number>` | | Web サーバーポート (デフォルト: 3939) |
| `--conversations` | | 全セッションデータを含める |
| `--claude-dir <path>` | | ~/.claude の場所を上書き |

## 使用例

- `/cc-skills-usage` — 全スキルの利用状況を表示
- `/cc-skills-usage --from 2025-06-01` — 6月1日以降の利用状況
- `/cc-skills-usage --skill devg` — devg スキルの利用状況のみ
- `/cc-skills-usage --project myapp --from 2025-06-01` — 特定プロジェクト・期間でフィルタ
- `/cc-skills-usage --output web` — ブラウザでダッシュボードを表示
- `/cc-skills-usage --conversations` — 全会話データ含む詳細分析

## 注意事項

- コマンドの出力をそのままユーザーに表示する。出力の加工や要約は行わない。
- `--output web` の場合、ブラウザが自動で開く。
