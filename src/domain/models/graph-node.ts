export interface GraphNode {
  id: string;
  label: string;
  folderPath: string;
  coordinates?: [number, number]; // [col, row] in triangle grid coords
}
