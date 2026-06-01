import { App, TFile, TFolder } from "obsidian";
import matter from "gray-matter";
import yaml from "js-yaml";
import { GraphNode } from "../../domain/models/graph-node";
import { GraphEdge } from "../../domain/models/graph-edge";
import { Graph } from "../../domain/models/graph";

export class ObsidianGraphRepository {
  constructor(private app: App) {}

  async buildGraph(): Promise<Graph> {
    const files = this.getMarkdownFiles();

    // Build node map keyed by file.path
    const nodeMap = new Map<string, GraphNode>();
    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      const coords = this.parseCoordinates(cache?.frontmatter?.["coordinates"]);
      nodeMap.set(file.path, {
        id: file.path,
        label: file.basename,
        // vault root files have parent.path === "/" or ""
        folderPath: file.parent?.path === "/" ? "" : (file.parent?.path ?? ""),
        coordinates: coords,
      });
    }

    // Build edges using metadataCache.resolvedLinks
    // resolvedLinks[sourcePath][targetPath] = count
    const edges: GraphEdge[] = [];
    const seen = new Set<string>();

    for (const file of files) {
      const resolved = this.app.metadataCache.resolvedLinks[file.path] ?? {};
      for (const targetPath of Object.keys(resolved)) {
        if (!nodeMap.has(targetPath)) {
          continue;
        }
        const key = `${file.path}→${targetPath}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        const fromLabel = nodeMap.get(file.path)?.label ?? file.basename;
        const toLabel = nodeMap.get(targetPath)?.label ?? targetPath;
        edges.push({
          from: file.path,
          to: targetPath,
          label: `${fromLabel} → ${toLabel}`,
        });
      }
    }

    return { nodes: Array.from(nodeMap.values()), edges };
  }

  private getMarkdownFiles(): TFile[] {
    const files: TFile[] = [];
    const root = this.app.vault.getRoot();

    const collect = (folder: TFolder) => {
      for (const child of folder.children) {
        if (child instanceof TFile && child.extension === "md") {
          files.push(child);
        } else if (child instanceof TFolder) {
          collect(child);
        }
      }
    };

    if (root instanceof TFolder) {
      collect(root);
    } else {
      collect(this.app.vault.getRoot());
    }

    return files;
  }

  private parseCoordinates(value: unknown): [number, number] | undefined {
    if (Array.isArray(value) && value.length >= 2) {
      const col = Number(value[0]);
      const row = Number(value[1]);
      if (Number.isFinite(col) && Number.isFinite(row)) {
        return [Math.round(col), Math.round(row)];
      }
    }
    return undefined;
  }

  async updateCoordinates(
    filePath: string,
    col: number,
    row: number,
  ): Promise<void> {
    // 整数値を保証（-0 を 0 に正規化）
    const c = Object.is(col, -0) ? 0 : Math.round(col);
    const r = Object.is(row, -0) ? 0 : Math.round(row);
    await this.modifyFrontmatter(filePath, (data) => {
      data["coordinates"] = [c, r];
    });
  }

  async clearCoordinates(filePath: string): Promise<void> {
    await this.modifyFrontmatter(filePath, (data) => {
      delete data["coordinates"];
    });
  }

  private async modifyFrontmatter(
    filePath: string,
    mutate: (data: Record<string, unknown>) => void,
  ): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
      return;
    }

    const content = await this.app.vault.read(file);
    const parsed = matter(content);
    mutate(parsed.data);
    // flowLevel: 1 でトップレベルはブロック、値が配列の場合はフロー形式（[x, y]）にする
    const newContent = matter.stringify(parsed.content, parsed.data, {
      engines: {
        yaml: {
          stringify: (obj: unknown) =>
            yaml.dump(obj, { flowLevel: 1, lineWidth: -1 }),
          parse: (str: string) => yaml.load(str),
        },
      },
    });
    await this.app.vault.modify(file, newContent);
  }
}
