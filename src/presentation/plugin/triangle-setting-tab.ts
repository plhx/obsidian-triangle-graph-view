import { App, PluginSettingTab, Setting } from "obsidian";
import TriangleGraphPlugin from "./triangle-plugin";
import { COLOR_THEMES, type ColorTheme } from "./plugin-settings";

export class TriangleSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: TriangleGraphPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Triangle Graph View Settings" });

    new Setting(containerEl)
      .setName("Color theme")
      .setDesc("Color palette used to tint folder nodes in the graph.")
      .addDropdown((drop) => {
        for (const [key, def] of Object.entries(COLOR_THEMES)) {
          drop.addOption(key, def.label);
        }
        drop
          .setValue(this.plugin.settings.colorTheme)
          .onChange(async (value) => {
            this.plugin.settings.colorTheme = value as ColorTheme;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Show edge labels")
      .setDesc("Display link labels at the midpoint of each edge.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showEdgeLabels)
          .onChange(async (value) => {
            this.plugin.settings.showEdgeLabels = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Grid size (L)")
      .setDesc(
        "Side length of equilateral triangles in graph coordinates. Default: 60.",
      )
      .addText((text) =>
        text
          .setPlaceholder("60")
          .setValue(String(this.plugin.settings.gridSize))
          .onChange(async (value) => {
            const n = parseInt(value, 10);
            if (!isNaN(n) && n > 0) {
              this.plugin.settings.gridSize = n;
              await this.plugin.saveSettings();
            }
          }),
      );

    new Setting(containerEl)
      .setName("Label max characters")
      .setDesc(
        'Maximum number of Unicode characters shown in a node label. Labels longer than this are truncated with "\u2026". Set to 0 for no limit. Default: 14.',
      )
      .addText((text) =>
        text
          .setPlaceholder("14")
          .setValue(String(this.plugin.settings.labelMaxChars))
          .onChange(async (value) => {
            const n = parseInt(value, 10);
            if (!isNaN(n) && n >= 0) {
              this.plugin.settings.labelMaxChars = n;
              await this.plugin.saveSettings();
            }
          }),
      );

    new Setting(containerEl)
      .setName("Label tail characters")
      .setDesc(
        'When a label is truncated, how many characters to preserve from the end (e.g. 3 gives "head\u2026tail"). Set to 0 to omit the tail. Default: 0.',
      )
      .addText((text) =>
        text
          .setPlaceholder("0")
          .setValue(String(this.plugin.settings.labelTailChars))
          .onChange(async (value) => {
            const n = parseInt(value, 10);
            if (!isNaN(n) && n >= 0) {
              this.plugin.settings.labelTailChars = n;
              await this.plugin.saveSettings();
            }
          }),
      );
  }
}
