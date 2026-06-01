# Copilot Instructions

## アーキテクチャ

このプロジェクトは TypeScript で書かれた Obsidian プラグインです。コードベースは **4層の DDD-lite アーキテクチャ** に従っています。

```
src/
├── domain/          # 純粋なデータインターフェース — メソッドなし、Obsidian への依存なし
├── application/     # ユースケースの調整 — リポジトリ経由で I/O を infra に委譲
├── infra/           # Obsidian API アクセス（vault、metadataCache、gray-matter YAML）
└── presentation/    # Obsidian Plugin / ItemView / PluginSettingTab + キャンバス描画
```

### 各層の責務

| 層 | パス | ルール |
|---|---|---|
| **Domain** | `src/domain/models/` | インターフェースのみ。Obsidian の型を import しない。 |
| **Application** | `src/application/services/` | infra リポジトリを呼び出し、ドメインモデルを返す。 |
| **Infra** | `src/infra/repositories/` | `app.vault`、`app.metadataCache`、`gray-matter` を使用できる唯一の層。 |
| **Presentation** | `src/presentation/` | サービスのインスタンス化、UI 描画、Obsidian ライフサイクルコールバックの処理。 |

依存の方向は内向き一方通行：presentation → application → infra → domain。  
**層をスキップしてはいけない。** Presentation は infra を直接 import しない。

**バレルファイル（`index.ts`）は存在しない** — すべての import はソースファイルに直接向ける。

モジュールエントリーポイント（`triangle-plugin.ts`）は `export default class` を使用し、他のファイルはすべて名前付き export のみ。

---

## コードスタイル

### 波括弧 — 常に同一行（K&R / 1TBS）

開き波括弧は**文と同じ行**に書く。例外なし。

`if`、`for`、`while`、`else` などの制御構造は、**本体が1行であってもブロック（`{}`）を省略しない**。

```ts
// ✅
if (condition) {
  return;
}

for (const item of items) {
  if (visited.has(item)) {
    continue;
  }
  process(item);
}

// ❌ 絶対にしない — ブロックなしの1行制御構造
if (condition) return;
if (visited.has(k)) continue;
if (!node.folderPath) return accentColor();
```

```ts
// ✅
export class Foo {
  method(): void {
    if (condition) {
      doSomething();
    } else if (other) {
      doOther();
    }
  }
}

// ❌ 絶対にしない
export class Foo
{
  method(): void
  {
  }
}
```

オブジェクトリテラルや配列リテラルも同じルール：

```ts
// ✅
return {
  x: col * L,
  y: row * H,
};
```

### 末尾カンマ

**複数行**のパラメータリスト、引数リスト、オブジェクト・配列リテラルには必ず末尾カンマを付ける：

```ts
this.renderer = new GraphRenderer(
  graphContainer,
  this.app,
  this.graphService,
  this.plugin.settings,   // ← 末尾カンマ
);

async updateNodeCoordinates(
  filePath: string,
  col: number,
  row: number,            // ← 末尾カンマ
): Promise<void> {
```

### 空白行・改行

- クラス内のメソッド間に**1行の空白行**を入れる。
- トップレベルの関数宣言の間に**1行の空白行**を入れる。
- メソッド本体内の論理的なステップの間に**1行の空白行**を入れる。
- フィールド宣言とコンストラクタの間には空白行を入れない。
- 関数本体の末尾に空白行を入れない。
- 大きなファイルで主要な概念グループを区切るには、複数の空白行ではなく**セクションバナーコメント**（後述）を使う。

### import

以下の順序で3グループに分け、グループ間は1行空ける：

1. 外部・サードパーティパッケージ（`"obsidian"`、`"force-graph"`、`"gray-matter"`）
2. 内部相対 import（`../../domain/...`、`../../infra/...`）

型のみの import にはインラインで `type` キーワードを使う：

```ts
import ForceGraph, { type NodeObject, type LinkObject } from "force-graph";
```

import メンバーが多い場合は1行に1つ：

```ts
import {
  TriangleGraphView,
  TRIANGLE_GRAPH_VIEW,
} from "../views/triangle-graph-view";
```

---

## Null / Optional アクセスパターン

習慣ではなく意味論に基づいて演算子を選ぶ：

| パターン | 使用場面 | 例 |
|---|---|---|
| `?.` オプショナルチェーン | 存在しない可能性があるプロパティへのアクセス | `this.fg?._destructor?.()` |
| `??` Null 合体演算子 | 値が `null` または `undefined` のときにデフォルト値を提供 | `file.parent?.path ?? ""` |
| `\|\|` 論理和フォールバック | 空文字列や `0` もデフォルトにしたい場合 | `accent \|\| "hsl(210, 70%, 55%)"` |
| `!` 非 null アサーション | 周囲のロジックで不変条件が保証されている場合のみ | `queue.shift()!` |

```ts
// ✅ nullable なパスに ?? を使う
folderPath: file.parent?.path === "/" ? "" : (file.parent?.path ?? ""),

// ✅ 安全なデフォルトオブジェクトを ?? で提供する
const resolved = this.app.metadataCache.resolvedLinks[file.path] ?? {};

// ✅ 数値のデフォルト値と ?? を組み合わせる
const centerX: number = this.fg.centerAt()?.x ?? 0;

// ✅ 空文字列もフォールバックさせたい場合は || を使う
const width = this.container.clientWidth || 800;
const accent = getComputedStyle(el).getPropertyValue("--color-accent").trim();
return accent || "hsl(210, 70%, 55%)";

// ✅ クリーンアップ処理にオプショナルチェーンを使う
this.resizeObserver?.disconnect();
this.renderer?.destroy();
```

---

## TypeScript パターン

### ドメインモデル — インターフェースのみ

```ts
export interface GraphNode {
  id: string;
  label: string;
  folderPath: string;
  coordinates?: [number, number]; // [col, row] 三角グリッド座標
}
```

### コンストラクタパラメータの private 省略記法

```ts
export class ObsidianGraphRepository {
  constructor(private app: App) {}
}
```

### コンストラクタの前に明示的なフィールド宣言

```ts
export class GraphRenderer {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private fg: any = null;
  private container: HTMLElement;
  private resizeObserver: ResizeObserver | null = null;
  private occupiedGrid = new Map<string, string>();
  private lastClickTime = 0;

  constructor(...) { ... }
}
```

### 設定 — const デフォルト + インターフェース

```ts
export interface TriangleGraphSettings {
  targetDir: string;
  gridSize: number;
}

export const DEFAULT_SETTINGS: TriangleGraphSettings = {
  targetDir: "",
  gridSize: 60,
};
```

設定のロードには以下を使う：

```ts
Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
```

### ライブラリ型のローカル拡張インターフェース

サードパーティ型の拡張インターフェースは、それを使用するファイル内にローカルで宣言する：

```ts
interface FGNode extends NodeObject {
  id: string;
  label: string;
  _domainNode: GraphNode;
}
```

### async / await

- すべての async メソッドは明示的な `Promise<T>` 戻り値型を宣言する。
- 全体を通して `async/await` を使う — 生の `.then()` チェーンは使わない。
- 意味のある戻り値がないメソッドには `Promise<void>` を使う。
- イベントハンドラのコールバックでは async インラインアロー関数を使ってよい：

```ts
.onNodeDragEnd(async (node: FGNode) => { ... })
```

### `any` の使用

`any` の使用は局所化し、必ず抑制コメントを添える：

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
private fg: any = null;
```

### ポータブルなタイマー型

`number` や `NodeJS.Timeout` の代わりに `ReturnType<typeof setTimeout>` を使う：

```ts
private timer: ReturnType<typeof setTimeout> | null = null;
```

---

## コメント

文脈に応じて3段階を使い分ける：

### 1. セクションバナー（大きなファイルのみ）

```ts
// ─── 三角グリッド計算 ─────────────────────────────────────────────────────────

function gridToPixel(...) { ... }

// ─── カラーヘルパー ───────────────────────────────────────────────────────────
```

### 2. 公開・重要メソッドへの JSDoc

ドメインレベルの説明は日本語散文で書く：

```ts
/**
 * カメラ位置を保ったままグラフデータだけ更新する（自動リフレッシュ用）。
 */
async softRender(): Promise<void> {
```

### 3. 非自明な実装詳細へのインライン `//`

最も明確になる言語で日英を自由に混在させてよい：

```ts
// Build node map keyed by file.path
// vault root files have parent.path === "/" or ""
// 整数値を保証（-0 を 0 に正規化）
```

コードをそのまま言い換えるだけのコメントは**書かない**。

---

## その他

- 数値を永続化する前に `-0` を `0` に正規化するには `Object.is(x, -0)` を使う。
- 多段 BFS の脱出にはフラグ変数ではなく、**ラベル付き `while` ループと `break label`** を使う。
- `styles.css` はプロジェクトルートに置かれ Obsidian のマニフェスト機構でロードされる。TypeScript から import しない。
