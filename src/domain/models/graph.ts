import { GraphNode } from "./graph-node";
import { GraphEdge } from "./graph-edge";

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
