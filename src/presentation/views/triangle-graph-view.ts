import { ItemView, WorkspaceLeaf } from "obsidian";
import TriangleGraphPlugin from "../plugin/triangle-plugin";
import { BuildGraphService } from "../../application/services/build-graph-service";
import { GraphRenderer } from "../components/graph-renderer";

export const TRIANGLE_GRAPH_VIEW = "TRIANGLE_GRAPH_VIEW";

export class TriangleGraphView extends ItemView {
  private renderer: GraphRenderer | null = null;
  private graphService: BuildGraphService;
  // debounce timer for auto-refresh
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private plugin: TriangleGraphPlugin,
  ) {
    super(leaf);
    this.graphService = new BuildGraphService(this.app);
  }

  getViewType(): string {
    return TRIANGLE_GRAPH_VIEW;
  }

  getDisplayText(): string {
    return "Triangle Graph View";
  }

  getIcon(): string {
    return "triangle";
  }

  async onOpen(): Promise<void> {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass("triangle-graph-view");

    const graphContainer = root.createDiv({ cls: "tgv-graph-container" });

    this.renderer = new GraphRenderer(
      graphContainer,
      this.app,
      this.graphService,
      this.plugin.settings,
    );

    await this.renderer.render();

    // Markdown が更新されたら自動再描画（debounce 500ms）
    this.registerEvent(
      this.app.metadataCache.on("resolved", () => {
        this.scheduleRefresh();
      }),
    );
  }

  async onClose(): Promise<void> {
    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.renderer?.destroy();
    this.renderer = null;
  }

  async refresh(): Promise<void> {
    if (this.renderer) {
      this.renderer.updateSettings(this.plugin.settings);
      await this.renderer.render();
    }
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer !== null) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      // カメラ位置を保ったまま再描画
      this.renderer?.softRender();
    }, 500);
  }
}
