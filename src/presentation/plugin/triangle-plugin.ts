import { Plugin, WorkspaceLeaf } from "obsidian";
import { TriangleGraphSettings, DEFAULT_SETTINGS } from "./plugin-settings";
import { TriangleSettingTab } from "./triangle-setting-tab";
import {
  TriangleGraphView,
  TRIANGLE_GRAPH_VIEW,
} from "../views/triangle-graph-view";

export default class TriangleGraphPlugin extends Plugin {
  settings: TriangleGraphSettings = { ...DEFAULT_SETTINGS };

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(
      TRIANGLE_GRAPH_VIEW,
      (leaf: WorkspaceLeaf) => new TriangleGraphView(leaf, this),
    );

    this.addRibbonIcon("triangle", "Triangle Graph View", () => {
      this.activateView();
    });

    this.addCommand({
      id: "open-triangle-graph-view",
      name: "Open Triangle Graph View",
      callback: () => this.activateView(),
    });

    this.addSettingTab(new TriangleSettingTab(this.app, this));
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(TRIANGLE_GRAPH_VIEW);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    // Refresh open views when settings change
    this.app.workspace.getLeavesOfType(TRIANGLE_GRAPH_VIEW).forEach((leaf) => {
      if (leaf.view instanceof TriangleGraphView) {
        leaf.view.refresh();
      }
    });
  }

  private async activateView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(TRIANGLE_GRAPH_VIEW);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: TRIANGLE_GRAPH_VIEW, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
}
