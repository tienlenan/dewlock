"use client";

/**
 * TxFlowGraph — the asset flow as a React Flow node graph.
 *
 * Layout: "You" sits in the centre; OUTflows fan to the right (you → counterparty),
 * INflows arrive from the left (counterparty → you). Every edge connects a distinct
 * node pair, so there are never two overlapping edges between the same boxes — it stays
 * clean for a swap (pay-leg right, receive-leg left) and a transfer (single right edge).
 *
 * `interactive` gates pan/zoom/drag: false for the compact in-card preview, true inside
 * the "view full" dialog where there's room to explore.
 */

import { useMemo, type CSSProperties } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { FlowRow } from "./tx-preview-format";

const OUT = "var(--destructive)";
const IN = "var(--success)";
const ROW_H = 92;

function nodeStyle(primary: boolean): CSSProperties {
  return {
    background: primary ? "var(--accent-soft)" : "var(--bg-elev)",
    color: primary ? "var(--accent-ink)" : "var(--fg)",
    border: `1px solid ${primary ? "var(--accent)" : "var(--border)"}`,
    borderRadius: 10,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 600,
    width: "auto",
  };
}

function edgeLabelProps(color: string) {
  return {
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
    style: { stroke: color, strokeWidth: 2 },
    labelStyle: { fill: "var(--fg)", fontSize: 11, fontWeight: 600 },
    labelBgStyle: { fill: "var(--bg-elev)", stroke: color, strokeWidth: 1 },
    labelBgPadding: [6, 3] as [number, number],
    labelBgBorderRadius: 6,
  };
}

function buildGraph(rows: FlowRow[]): { nodes: Node[]; edges: Edge[] } {
  const outs = rows.filter((r) => r.direction === "out");
  const ins = rows.filter((r) => r.direction === "in");
  const midY = ((Math.max(outs.length, ins.length, 1) - 1) * ROW_H) / 2;

  const nodes: Node[] = [
    {
      id: "you",
      position: { x: 170, y: midY },
      data: { label: "You" },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: nodeStyle(true),
    },
    ...outs.map((r, i) => ({
      id: `out-${i}`,
      position: { x: 360, y: i * ROW_H },
      data: { label: r.counterparty },
      targetPosition: Position.Left,
      style: nodeStyle(false),
    })),
    ...ins.map((r, i) => ({
      id: `in-${i}`,
      position: { x: 0, y: i * ROW_H },
      data: { label: r.counterparty },
      sourcePosition: Position.Right,
      style: nodeStyle(false),
    })),
  ];

  const edges: Edge[] = [
    ...outs.map((r, i) => ({
      id: `eo-${i}`,
      source: "you",
      target: `out-${i}`,
      label: `−${r.amountFormatted} ${r.ticker}`,
      ...edgeLabelProps(OUT),
    })),
    ...ins.map((r, i) => ({
      id: `ei-${i}`,
      source: `in-${i}`,
      target: "you",
      label: `+${r.amountFormatted} ${r.ticker}`,
      ...edgeLabelProps(IN),
    })),
  ];

  return { nodes, edges };
}

export function TxFlowGraph({ rows, interactive = false }: { rows: FlowRow[]; interactive?: boolean }) {
  const initial = useMemo(() => buildGraph(rows), [rows]);
  const [nodes, , onNodesChange] = useNodesState(initial.nodes);
  const [edges, , onEdgesChange] = useEdgesState(initial.edges);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={interactive ? onNodesChange : undefined}
      onEdgesChange={interactive ? onEdgesChange : undefined}
      fitView
      fitViewOptions={{ padding: 0.25 }}
      proOptions={{ hideAttribution: true }}
      nodesDraggable={interactive}
      nodesConnectable={false}
      elementsSelectable={interactive}
      zoomOnScroll={interactive}
      zoomOnPinch={interactive}
      zoomOnDoubleClick={interactive}
      panOnDrag={interactive}
      panOnScroll={false}
      preventScrolling={interactive}
      minZoom={0.4}
      maxZoom={1.75}
    >
      <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--border)" />
      {interactive && <Controls showInteractive={false} position="bottom-right" />}
    </ReactFlow>
  );
}
