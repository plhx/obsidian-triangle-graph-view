import { App } from "obsidian";
import ForceGraph, { type NodeObject, type LinkObject } from "force-graph";
import { BuildGraphService } from "../../application/services/build-graph-service";
import {
  TriangleGraphSettings,
  COLOR_THEMES,
  type ColorThemeDef,
} from "../plugin/plugin-settings";
import { GraphNode } from "../../domain/models/graph-node";

// ─── Triangle grid math ───────────────────────────────────────────────────────

// ─── Label truncation ────────────────────────────────────────────────────────

/**
 * Unicode コードポイント単位で文字数を計測し、maxChars を超える場合は「…」で短縮する。
 * tailChars > 0 のとき、末尾 tailChars 文字を保持して「頭…末尾」形式にする。
 */
function truncateLabel(
  label: string,
  maxChars: number,
  tailChars: number,
): string {
  if (maxChars <= 0) {
    return label;
  }
  const chars = [...label];
  if (chars.length <= maxChars) {
    return label;
  }
  const tail = tailChars > 0 ? chars.slice(-tailChars).join("") : "";
  // 頭部は maxChars - 1(省略記号分) - tailChars 文字
  const headLen = maxChars - 1 - tailChars;
  const head = chars.slice(0, Math.max(0, headLen)).join("");
  return head + "\u2026" + tail;
}

function gridToPixel(
  col: number,
  row: number,
  L: number,
): { x: number; y: number } {
  const H = (L * Math.sqrt(3)) / 2;
  return {
    x: row % 2 === 0 ? col * L : (col + 0.5) * L,
    y: row * H,
  };
}

function snapToGrid(
  px: number,
  py: number,
  L: number,
): { col: number; row: number } {
  const H = (L * Math.sqrt(3)) / 2;
  const rowF = py / H;
  const row0 = Math.floor(rowF);
  let best = { col: 0, row: 0 };
  let bestDist = Infinity;

  for (const r of [row0 - 1, row0, row0 + 1]) {
    const offset = r % 2 === 0 ? 0 : 0.5;
    const colF = px / L - offset;
    for (const c of [Math.floor(colF), Math.ceil(colF)]) {
      const { x, y } = gridToPixel(c, r, L);
      const d = Math.hypot(px - x, py - y);
      if (d < bestDist) {
        bestDist = d;
        best = { col: c, row: r };
      }
    }
  }
  return best;
}

/**
 * スナップ先の頂点がすでに占有されていれば、BFS で最近傍の空き頂点を探す。
 * occupied は "col,row" 形式の文字列セット（スナップ対象ノード自身を除いた状態で渡す）。
 */
function snapToGridAvoid(
  px: number,
  py: number,
  L: number,
  occupied: Set<string>,
): { col: number; row: number } {
  const nearest = snapToGrid(px, py, L);
  const key = (c: number, r: number) => `${c},${r}`;

  if (!occupied.has(key(nearest.col, nearest.row))) {
    return nearest;
  }

  // BFS outward from the nearest vertex
  const visited = new Set<string>();
  const queue: Array<{ col: number; row: number }> = [nearest];
  visited.add(key(nearest.col, nearest.row));

  while (queue.length > 0) {
    const cur = queue.shift()!;
    // Neighbours in a triangle grid: horizontal ±1, and two diagonal rows
    const neighbours = triangleNeighbours(cur.col, cur.row);
    // Sort by pixel distance to drag point so we expand toward nearest first
    neighbours.sort((a, b) => {
      const da = Math.hypot(
        gridToPixel(a.col, a.row, L).x - px,
        gridToPixel(a.col, a.row, L).y - py,
      );
      const db = Math.hypot(
        gridToPixel(b.col, b.row, L).x - px,
        gridToPixel(b.col, b.row, L).y - py,
      );
      return da - db;
    });

    for (const nb of neighbours) {
      const k = key(nb.col, nb.row);
      if (visited.has(k)) {
        continue;
      }
      visited.add(k);
      if (!occupied.has(k)) {
        return nb;
      }
      queue.push(nb);
    }
  }

  // Fallback (should never happen)
  return nearest;
}

/** 三角グリッドの隣接頂点（6方向）を返す */
function triangleNeighbours(
  col: number,
  row: number,
): Array<{ col: number; row: number }> {
  // Even row offsets vs odd row offsets to next/prev row
  const isEven = row % 2 === 0;
  return [
    { col: col - 1, row }, // left
    { col: col + 1, row }, // right
    { col: isEven ? col - 1 : col, row: row - 1 }, // upper-left
    { col: isEven ? col : col + 1, row: row - 1 }, // upper-right
    { col: isEven ? col - 1 : col, row: row + 1 }, // lower-left
    { col: isEven ? col : col + 1, row: row + 1 }, // lower-right
  ];
}

// ─── Color helpers ────────────────────────────────────────────────────────────

function hashColor(str: string, isDark: boolean, theme: ColorThemeDef): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
  }
  const palette = isDark
    ? (theme.colorsDark ?? theme.colorsLight)
    : (theme.colorsLight ?? theme.colorsDark);
  if (palette) {
    return palette[Math.abs(hash) % palette.length];
  }
  // Default: full hue range with fixed S/L
  const hue = Math.abs(hash) % 360;
  const lightness = isDark ? 65 : 40;
  return `hsl(${hue}, 70%, ${lightness}%)`;
}

function accentColor(): string {
  const accent = getComputedStyle(document.body)
    .getPropertyValue("--color-accent")
    .trim();
  return accent || "hsl(210, 70%, 55%)";
}

// ─── ForceGraph node/link types ───────────────────────────────────────────────

interface FGNode extends NodeObject {
  id: string;
  label: string;
  folderPath: string;
  gridCol?: number;
  gridRow?: number;
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
  _domainNode: GraphNode;
}

interface FGLink extends LinkObject<FGNode> {
  source: string | FGNode;
  target: string | FGNode;
  label: string;
}

// ─── GraphRenderer ────────────────────────────────────────────────────────────

export class GraphRenderer {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private fg: any = null;
  private container: HTMLElement;
  private resizeObserver: ResizeObserver | null = null;
  // "col,row" → nodeId  （固定済みノードの占有マップ）
  private occupiedGrid = new Map<string, string>();
  // ダブルクリック判定用
  private lastClickTime = 0;
  private lastClickNodeId = "";

  constructor(
    container: HTMLElement,
    private app: App,
    private graphService: BuildGraphService,
    private settings: TriangleGraphSettings,
  ) {
    this.container = container;
  }

  updateSettings(settings: TriangleGraphSettings): void {
    this.settings = settings;
  }

  /**
   * グラフを完全に作り直す（初回 / 設定変更時）。
   * カメラ位置もリセットされる。
   */
  async render(): Promise<void> {
    if (this.fg) {
      this.fg._destructor?.();
      this.fg = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.container.empty();
    this.occupiedGrid.clear();
    await this.buildFG();

    this.resizeObserver = new ResizeObserver(() => {
      this.fg
        ?.width(this.container.clientWidth)
        .height(this.container.clientHeight);
    });
    this.resizeObserver.observe(this.container);
  }

  /**
   * カメラ位置を保ったままグラフデータだけ更新する（自動リフレッシュ用）。
   */
  async softRender(): Promise<void> {
    if (!this.fg) {
      await this.render();
      return;
    }
    // 現在のカメラ状態を保存
    const centerX: number = this.fg.centerAt()?.x ?? 0;
    const centerY: number = this.fg.centerAt()?.y ?? 0;
    const zoom: number = this.fg.zoom() ?? 1;

    const graph = await this.graphService.buildGraph();
    const L = this.settings.gridSize;

    this.occupiedGrid.clear();

    // 座標あり・なしに分類
    const withCoords = graph.nodes.filter((n) => n.coordinates);
    const withoutCoords = graph.nodes.filter((n) => !n.coordinates);

    // まず座標ありノードで occupiedGrid を構築
    for (const n of withCoords) {
      const [col, row] = n.coordinates!;
      this.occupiedGrid.set(`${col},${row}`, n.id);
    }

    // 座標なしノードに自動配置して保存
    await this.assignCoordinates(withoutCoords);

    // グラフ再構築（assignCoordinates で coordinates が埋まっている）
    const fgNodes: FGNode[] = graph.nodes.map((n) => {
      const fgNode: FGNode = {
        id: n.id,
        label: n.label,
        folderPath: n.folderPath,
        _domainNode: n,
      };
      if (n.coordinates) {
        const [col, row] = n.coordinates;
        fgNode.gridCol = col;
        fgNode.gridRow = row;
        const { x, y } = gridToPixel(col, row, L);
        fgNode.fx = x;
        fgNode.fy = y;
        fgNode.x = x;
        fgNode.y = y;
      }
      return fgNode;
    });

    const fgLinks: FGLink[] = graph.edges.map((e) => ({
      source: e.from,
      target: e.to,
      label: e.label,
    }));

    this.fg.graphData({ nodes: fgNodes, links: fgLinks });

    // カメラ位置を即時復元（アニメーションなし）
    this.fg.centerAt(centerX, centerY, 0);
    this.fg.zoom(zoom, 0);
  }

  private async buildFG(): Promise<void> {
    const graph = await this.graphService.buildGraph();
    const L = this.settings.gridSize;
    const isDark = document.body.classList.contains("theme-dark");
    this.occupiedGrid.clear();

    // 座標ありノードで occupiedGrid を先に構築
    for (const n of graph.nodes.filter((n) => n.coordinates)) {
      const [col, row] = n.coordinates!;
      this.occupiedGrid.set(`${col},${row}`, n.id);
    }
    // 座標なしノードに自動配置
    await this.assignCoordinates(graph.nodes.filter((n) => !n.coordinates));

    // 色はテーマ切替に追従するよう毎フレーム評価する関数で持つ
    const dark = () => document.body.classList.contains("theme-dark");
    const linkColor = () =>
      dark() ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)";
    const gridDotColor = () =>
      dark() ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)";
    const labelColor = () =>
      dark() ? "rgba(255,255,255,1.0)" : "rgba(0,0,0,0.85)";
    const themeDef =
      COLOR_THEMES[this.settings.colorTheme] ?? COLOR_THEMES.default;
    const nodeColorFn = (node: FGNode): string => {
      if (!node.folderPath || node.folderPath === "/") {
        return accentColor();
      }
      return hashColor(node.folderPath, dark(), themeDef);
    };

    // assignCoordinates 完了後にノードを構築（全ノードに coordinates が入っている）
    const fgNodes: FGNode[] = graph.nodes.map((n) => {
      const fgNode: FGNode = {
        id: n.id,
        label: n.label,
        folderPath: n.folderPath,
        _domainNode: n,
      };
      if (n.coordinates) {
        const [col, row] = n.coordinates;
        fgNode.gridCol = col;
        fgNode.gridRow = row;
        const { x, y } = gridToPixel(col, row, L);
        fgNode.fx = x;
        fgNode.fy = y;
        fgNode.x = x;
        fgNode.y = y;
      }
      return fgNode;
    });

    const fgLinks: FGLink[] = graph.edges.map((e) => ({
      source: e.from,
      target: e.to,
      label: e.label,
    }));

    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const FG = ForceGraph as any;
    this.fg = new FG(this.container)
      .width(width)
      .height(height)
      .graphData({ nodes: fgNodes, links: fgLinks })
      .backgroundColor("rgba(0,0,0,0)")
      // ── Node ────────────────────────────────────────────────────────────
      .nodeId("id")
      .nodeLabel(() => "")
      .nodeCanvasObjectMode(() => "replace")
      .nodeCanvasObject(
        (node: FGNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
          const n = node as FGNode;
          if (n.x === undefined || n.y === undefined) {
            return;
          }

          const color = nodeColorFn(n);
          const r = Math.max(4, 6 / globalScale);

          // 塗りつぶしのみ（枠線なし）
          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();

          // label below node
          const fontSize = Math.max(9 / globalScale, 2);
          ctx.font = `${fontSize}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = labelColor();
          ctx.fillText(
            truncateLabel(
              n.label,
              this.settings.labelMaxChars,
              this.settings.labelTailChars,
            ),
            n.x,
            n.y + r + 1.5 / globalScale,
          );
        },
      )
      .nodePointerAreaPaint(
        (
          node: FGNode,
          color: string,
          ctx: CanvasRenderingContext2D,
          globalScale: number,
        ) => {
          const n = node as FGNode;
          if (n.x === undefined || n.y === undefined) {
            return;
          }
          const r = Math.max(4, 6 / globalScale) + 3 / globalScale;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
          ctx.fill();
        },
      )
      // ── Links ────────────────────────────────────────────────────────────
      .linkColor(() => linkColor())
      .linkWidth(0.8)
      .linkDirectionalArrowLength(4)
      .linkDirectionalArrowRelPos(1)
      .linkDirectionalArrowColor(() => linkColor())
      .linkDirectionalParticles(2)
      .linkDirectionalParticleSpeed(0.005)
      .linkDirectionalParticleWidth(2)
      .linkDirectionalParticleColor((link) => {
        const l = link as FGLink;
        const src = typeof l.source === "object" ? l.source : null;
        return src ? nodeColorFn(src) : linkColor();
      })
      .linkCanvasObjectMode(() =>
        this.settings.showEdgeLabels ? "after" : undefined,
      )
      .linkCanvasObject(
        (link, ctx: CanvasRenderingContext2D, globalScale: number) => {
          const l = link as FGLink;
          const src = typeof l.source === "object" ? l.source : null;
          const tgt = typeof l.target === "object" ? l.target : null;
          if (
            !src ||
            !tgt ||
            src.x === undefined ||
            src.y === undefined ||
            tgt.x === undefined ||
            tgt.y === undefined
          ) {
            return;
          }
          const mx = (src.x + tgt.x) / 2;
          const my = (src.y + tgt.y) / 2;
          const fontSize = Math.max(6 / globalScale, 1.5);
          ctx.font = `${fontSize}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = linkColor();
          ctx.fillText(l.label, mx, my);
        },
      )
      // ── Triangle grid ────────────────────────────────────────────────────
      .onRenderFramePre(
        (ctx: CanvasRenderingContext2D, globalScale: number) => {
          // d3-zoom が canvas 要素の __zoom プロパティに transform を保持している
          const canvas = this.container.querySelector("canvas") as
            | (HTMLCanvasElement & {
                __zoom?: { x: number; y: number; k: number };
              })
            | null;
          const zoom = canvas?.__zoom;
          const tx = zoom?.x ?? 0;
          const ty = zoom?.y ?? 0;
          const k = zoom?.k ?? globalScale;
          const pxRatio = window.devicePixelRatio || 1;
          const w = this.container.clientWidth;
          const h = this.container.clientHeight;

          // スクリーン座標 → ワールド座標（可視範囲計算）
          const minX = (0 - tx) / k;
          const maxX = (w - tx) / k;
          const minY = (0 - ty) / k;
          const maxY = (h - ty) / k;

          const H = (L * Math.sqrt(3)) / 2;
          const padX = Math.ceil((maxX - minX) / L) + 4;
          const padY = Math.ceil((maxY - minY) / H) + 4;
          const rowMin = Math.floor(minY / H) - padY;
          const rowMax = Math.ceil(maxY / H) + padY;
          const colMin = Math.floor(minX / L) - padX;
          const colMax = Math.ceil(maxX / L) + padX;

          ctx.save();
          // DPR スケール済みのスクリーン座標系から、ワールド座標系に変換
          ctx.setTransform(
            k * pxRatio,
            0,
            0,
            k * pxRatio,
            tx * pxRatio,
            ty * pxRatio,
          );

          // 空き頂点のみマーカーを描画
          ctx.fillStyle = gridDotColor();
          for (let row = rowMin; row <= rowMax; row++) {
            for (let col = colMin; col <= colMax; col++) {
              if (this.occupiedGrid.has(`${col},${row}`)) {
                continue;
              }
              const { x, y } = gridToPixel(col, row, L);
              const dotR = 2 / k;
              ctx.beginPath();
              ctx.arc(x, y, dotR, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.restore();
        },
      )
      // ── Interaction ──────────────────────────────────────────────────────
      .onNodeClick((node: FGNode) => {
        const n = node as FGNode;
        const now = Date.now();
        if (now - this.lastClickTime < 300 && this.lastClickNodeId === n.id) {
          // ダブルクリック: エディタで開く
          this.app.workspace.openLinkText(n.id, "", false);
        }
        this.lastClickTime = now;
        this.lastClickNodeId = n.id;
      })
      // ── Drag & snap with collision avoidance ─────────────────────────────
      .onNodeDragEnd(async (node: FGNode) => {
        const n = node as FGNode;

        // 移動前の占有グリッドキーを解放
        if (n.gridCol !== undefined && n.gridRow !== undefined) {
          this.occupiedGrid.delete(`${n.gridCol},${n.gridRow}`);
        }

        // 自分を除いた占有セットで最近傍の空き頂点を探す
        const occupiedSet = new Set(this.occupiedGrid.keys());
        const snapped = snapToGridAvoid(n.x ?? 0, n.y ?? 0, L, occupiedSet);
        // 整数・-0 を正規化
        const sc = snapped.col === 0 ? 0 : snapped.col;
        const sr = snapped.row === 0 ? 0 : snapped.row;

        const { x: sx, y: sy } = gridToPixel(sc, sr, L);
        n.fx = sx;
        n.fy = sy;
        n.x = sx;
        n.y = sy;
        n.gridCol = sc;
        n.gridRow = sr;
        this.occupiedGrid.set(`${sc},${sr}`, n.id);

        await this.graphService.updateNodeCoordinates(n.id, sc, sr);
      });
  }

  /**
   * coordinates なしノードにグリッド座標を割り当て、occupiedGrid を更新しフロントマターに保存する。
   * - 占有ノードがなければ [0, 0] に配置
   * - すでに占有ノードがあれば、占有ノードの重心に近い空き頂点に BFS で配置
   */
  private async assignCoordinates(nodes: GraphNode[]): Promise<void> {
    if (nodes.length === 0) {
      return;
    }

    for (const node of nodes) {
      let col: number;
      let row: number;

      if (this.occupiedGrid.size === 0) {
        // 初めてのノード: [0, 0] に配置
        col = 0;
        row = 0;
      } else {
        // 占有ノードの重心を求め、そこから BFS で空き頂点を探す
        const keys = Array.from(this.occupiedGrid.keys());
        let sumCol = 0,
          sumRow = 0;
        for (const k of keys) {
          const [kc, kr] = k.split(",").map(Number);
          sumCol += kc;
          sumRow += kr;
        }
        const cx = Math.round(sumCol / keys.length);
        const cy = Math.round(sumRow / keys.length);

        const gridOccupied = new Set(this.occupiedGrid.keys());
        const gkey = (c: number, r: number) => `${c},${r}`;
        const startKey = gkey(cx, cy);

        if (!gridOccupied.has(startKey)) {
          col = cx;
          row = cy;
        } else {
          const visited = new Set<string>([startKey]);
          const queue: Array<{ col: number; row: number }> = [
            { col: cx, row: cy },
          ];
          col = cx;
          row = cy; // fallback

          outer: while (queue.length > 0) {
            const cur = queue.shift()!;
            const neighbours = triangleNeighbours(cur.col, cur.row);
            // 重心からのグリッド距離順にソート
            neighbours.sort(
              (a, b) =>
                Math.hypot(a.col - cx, a.row - cy) -
                Math.hypot(b.col - cx, b.row - cy),
            );
            for (const nb of neighbours) {
              const k = gkey(nb.col, nb.row);
              if (visited.has(k)) {
                continue;
              }
              visited.add(k);
              if (!gridOccupied.has(k)) {
                col = nb.col;
                row = nb.row;
                break outer;
              }
              queue.push(nb);
            }
          }
        }
      }

      node.coordinates = [col, row];
      this.occupiedGrid.set(`${col},${row}`, node.id);
      await this.graphService.updateNodeCoordinates(node.id, col, row);
    }
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.fg) {
      (this.fg as unknown as { _destructor?: () => void })._destructor?.();
      this.fg = null;
    }
    this.container.empty();
    this.occupiedGrid.clear();
  }
}
