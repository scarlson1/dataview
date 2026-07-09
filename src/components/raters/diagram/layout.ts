/**
 * Dagre top-to-bottom layout for the rater diagram. Node sizes are estimates
 * (the nodes are fixed-width cards); dagre only needs rough boxes to produce
 * a clean rank layout.
 */

import dagre from '@dagrejs/dagre';
import type { RaterFlowGraph, RaterFlowNode } from './flowGraph';

export const NODE_WIDTH = 216;
export const NODE_HEIGHT = 64;

export const layoutFlow = (graph: RaterFlowGraph): RaterFlowGraph => {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 36, ranksep: 48 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of graph.nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of graph.edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const nodes: RaterFlowNode[] = graph.nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
    };
  });

  return { nodes, edges: graph.edges };
};
