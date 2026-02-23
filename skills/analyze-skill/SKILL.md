---
name: analyze-skill
description: 特定のスキルの利用データを分析し、trigger/prompt の改善提案を行う。スキルの利用パターン、見逃されているトリガー、SKILL.md の改善点を特定する。
argument-hint: "[skill-name]"
---

# analyze-skill

指定されたスキルの利用状況を分析し、SKILL.md の trigger/prompt 改善提案を出力する。

## 引数

- `skill-name` (必須): 分析対象のスキル名（例: `devg`, `review-pr`）

引数が指定されていない場合は、ユーザーにスキル名を尋ねる。

## 実行手順

### Step 1: 利用データの取得

以下のコマンドを Bash ツールで実行し、出力を取得する:

```bash
bun /Users/shinobu.hayashi/Documents/s9k/cc-skills-usage/packages/cli/src/index.ts --conversations --skill <skill-name>
```

出力には以下のデータが含まれる:
- **Skill Stats**: 利用回数
- **Daily Stats**: 日別の利用数
- **Project Stats**: プロジェクト別の利用数
- **Token Stats**: トークン消費量
- **Recent Calls**: 最近の呼び出し（triggerMessage 付き）
- **Conversation Stats**: 全セッション中のスキル利用率
- **Recent Conversations**: スキル未使用のセッションのユーザー発話

### Step 2: スキル定義の読み取り

Read ツールで `~/.claude/skills/<skill-name>/SKILL.md` を読み取る。ファイルが見つからない場合は、`~/.claude/skills/` 配下を Glob で検索してスキルのディレクトリを特定する。

### Step 3: 分析

以下の観点で分析を行う:

#### 3a. 使われた場面の分析
- Recent Calls の `triggerMessage` から、どんなユーザー発話でスキルが呼ばれているかをパターン分類する
- よく使われるキーワード・フレーズを抽出する

#### 3b. 使われなかった場面の分析
- `conversations` のうちスキル未使用のセッション（`hasSkillCalls: false` または対象スキルが `skillsUsed` に含まれないセッション）を確認する
- それらのセッションの `userMessages` を見て、本来このスキルが使えたはずのユーザー発話がないかを探す
- 見逃しパターンを特定する

#### 3c. 利用頻度・トレンド分析
- `dailyStats` から利用頻度の推移を確認する
- `projectStats` からどのプロジェクトでよく使われているかを確認する

#### 3d. Adoption rate 分析
- `conversationStats` から:
  - 全セッション数に対するスキル利用セッションの割合
  - プロジェクト別の普及率

### Step 4: 改善提案の出力

分析結果を以下の構成でテキスト出力する:

```
## 📊 スキル分析レポート: <skill-name>

### 現在の利用状況
- 総呼び出し回数: X回
- 利用セッション率: X% (Y/Z セッション)
- 主な利用プロジェクト: ...
- 利用トレンド: (増加傾向/安定/減少傾向)

### 使われた場面
- パターン1: 「...」のような発話 (X回)
- パターン2: 「...」のような発話 (Y回)
- ...

### 見逃された場面
- 「...」というユーザー発話でスキルが呼ばれなかった (セッション: ...)
- ...

### 改善提案

#### Trigger キーワードの追加
現在の SKILL.md では捕捉できていない発話パターンに基づき、以下のトリガーキーワードを追加することを提案:
- `キーワード1` — 理由: ...
- `キーワード2` — 理由: ...

#### Description の改善
現在: 「...」
提案: 「...」
理由: ...

#### Prompt (SKILL.md 本文) の改善
- 改善点1: ...
- 改善点2: ...
```

## 注意事項

- データが少ない場合（呼び出し回数が5回未満など）は、その旨を明記した上で可能な範囲で分析する。
- スキルが一度も使われていない場合は、SKILL.md の内容のみから改善提案を行う。
- 改善提案は具体的かつ実行可能な内容にする。抽象的なアドバイスは避ける。
