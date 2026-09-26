declare module "d3-force-3d" {
  export type ForceFn<Node> = {
    initialize?: (nodes: Node[], random?: () => number) => void;
    id: (fn: (node: Node) => string) => ForceFn<Node>;
    distance: (value: number) => ForceFn<Node>;
    strength: (value: number) => ForceFn<Node>;
  };

  export type Simulation<Node> = {
    force: (name: string, force: unknown) => Simulation<Node>;
    stop: () => Simulation<Node>;
    tick: (iterations?: number) => Simulation<Node>;
    nodes: () => Node[];
  };

  export function forceSimulation<Node>(nodes?: Node[], numDimensions?: number): Simulation<Node>;
  export function forceLink<Node>(links?: unknown[]): ForceFn<Node>;
  export function forceManyBody<Node>(): ForceFn<Node>;
  export function forceCenter(x?: number, y?: number, z?: number): unknown;
  export function forceZ(z?: number): ForceFn<unknown>;
}
