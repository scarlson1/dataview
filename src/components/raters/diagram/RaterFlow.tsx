/**
 * Read-only React Flow rendering of a rater's logic, derived purely from the
 * definition (and optionally a run trace for executed-path highlighting).
 */

import Box from '@mui/material/Box';
import { useColorScheme, useTheme } from '@mui/material/styles';
import {
  Background,
  Controls,
  type Edge,
  MarkerType,
  type Node,
  ReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMemo } from 'react';
import type { RaterDefinition, TraceStep } from '#/types/raters';
import { definitionToFlow } from './flowGraph';
import { layoutFlow } from './layout';
import { RaterStepNode } from './RaterStepNode';

const nodeTypes = { raterStep: RaterStepNode };

interface RaterFlowProps {
  definition: RaterDefinition;
  trace?: TraceStep[] | null;
  height?: number | string;
}

export const RaterFlow = ({
  definition,
  trace,
  height = 480,
}: RaterFlowProps) => {
  const theme = useTheme();
  const { mode, systemMode } = useColorScheme();
  const colorMode = (mode === 'system' ? systemMode : mode) ?? 'light';

  const { nodes, edges } = useMemo(() => {
    const graph = layoutFlow(definitionToFlow(definition, trace ?? undefined));

    const flowNodes: Node[] = graph.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data as unknown as Record<string, unknown>,
      draggable: false,
      connectable: false,
      selectable: false,
    }));

    const flowEdges: Edge[] = graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      type: 'smoothstep',
      style: { opacity: e.dimmed ? 0.3 : 1 },
      labelStyle: {
        fontSize: 10.5,
        opacity: e.dimmed ? 0.4 : 1,
        fill: theme.vars.palette.text.secondary,
      },
      labelBgStyle: { fill: theme.vars.palette.background.paper },
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
    }));

    return { nodes: flowNodes, edges: flowEdges };
  }, [definition, trace, theme]);

  if (!definition.steps.length) {
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'text.secondary',
          fontSize: 13,
        }}
      >
        Add steps to see the logic diagram.
      </Box>
    );
  }

  return (
    <Box sx={{ height, '& .react-flow__attribution': { display: 'none' } }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode={colorMode}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
      >
        <Background gap={18} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </Box>
  );
};
