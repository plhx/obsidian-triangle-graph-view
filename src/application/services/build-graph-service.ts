import { App } from "obsidian";
import { Graph } from "../../domain/models/graph";
import { ObsidianGraphRepository } from "../../infra/repositories/obsidian-graph-repository";

export class BuildGraphService {
  private repository: ObsidianGraphRepository;

  constructor(app: App) {
    this.repository = new ObsidianGraphRepository(app);
  }

  async buildGraph(): Promise<Graph> {
    return this.repository.buildGraph();
  }

  async updateNodeCoordinates(
    filePath: string,
    col: number,
    row: number,
  ): Promise<void> {
    return this.repository.updateCoordinates(filePath, col, row);
  }

  async clearNodeCoordinates(filePath: string): Promise<void> {
    return this.repository.clearCoordinates(filePath);
  }
}
