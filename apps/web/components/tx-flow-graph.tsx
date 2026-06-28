"use client";

/**
 * TxFlowGraph — the asset flow as a React Flow node graph with rich, themed nodes.
 *
 * Layout: "You" sits in the centre; OUTflows fan to the right (you → counterparty),
 * INflows arrive from the left (counterparty → you). Every edge connects a distinct
 * node pair, so two edges never overlap.
 *
 * Nodes are custom (FlowNode): an icon per kind (wallet / recipient / protocol), a bold
 * label, and a sub-line showing the SuiNS name or short 0x when we have it. `interactive`
 * gates pan/zoom/drag — off for the in-card preview, on inside the "view full" dialog.
 */

import { useMemo, type CSSProperties } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Wallet, UserRound, ArrowLeftRight, CircleHelp } from "lucide-react";
import { useSuinsNames } from "@/lib/use-suins-names";
import { ProtocolLogo, protocolLogoIdFromName } from "./chat/asset-logos";
import {
  deriveFlowRows,
  deriveCompositeFlow,
  short0x,
  type FlowPreviewInput,
  type FlowRow,
  type CompositeFlowStep,
} from "./tx-preview-format";

const OUT = "var(--destructive)";
const IN = "var(--success)";
const COL_W = 230; // horizontal gap between sibling nodes at the same level
const LEVEL_H = 132; // vertical gap between levels (sources → you → destinations)

type NodeKind = "you" | "recipient" | "protocol" | "counterparty";
interface NodeMeta { kind: NodeKind; label: string; sub?: string; primary?: boolean; logoId?: string }

const ICONS: Record<NodeKind, typeof Wallet> = {
  you: Wallet,
  recipient: UserRound,
  protocol: ArrowLeftRight,
  counterparty: CircleHelp,
};

const CATEGORY_LABEL: Record<string, string> = {
  dex: "DEX", aggregator: "Aggregator route", lending: "Lending",
  lst: "Liquid staking", perps: "Perps", bridge: "Bridge", yield: "Yield",
};

// ---- custom node ----------------------------------------------------------

const handleStyle: CSSProperties = { width: 7, height: 7, background: "var(--border)", border: "none" };

function FlowNode({ data }: NodeProps) {
  const d = data as unknown as NodeMeta;
  const Icon = ICONS[d.kind];
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 9,
        minWidth: 132, maxWidth: 188,
        padding: "8px 12px", borderRadius: 12,
        background: d.primary ? "var(--accent-soft)" : "var(--bg-elev)",
        border: `1px solid ${d.primary ? "var(--accent)" : "var(--border)"}`,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <Handle type="target" position={Position.Top} style={handleStyle} />
      {d.logoId ? (
        // Real protocol brand mark (Cetus / NAVI / …); falls back to a monogram internally.
        <ProtocolLogo id={d.logoId} size={26} />
      ) : (
        <span
          style={{
            flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 26, height: 26, borderRadius: 8,
            background: d.primary ? "var(--accent)" : "var(--bg-sub)",
            color: d.primary ? "#fff" : "var(--fg-muted)",
          }}
        >
          <Icon size={14} aria-hidden />
        </span>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: d.primary ? "var(--accent-ink)" : "var(--fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {d.label}
        </div>
        {d.sub && (
          <div className="mono" style={{ fontSize: 9.5, color: "var(--fg-faint)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {d.sub}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </div>
  );
}

const nodeTypes = { flow: FlowNode };

// ---- graph builder --------------------------------------------------------

function counterpartyMeta(row: FlowRow, preview: FlowPreviewInput, suins: Record<string, string>): NodeMeta {
  const cp = row.counterparty;
  if (preview.recipientAddress && cp === "Recipient") {
    const a = preview.recipientAddress;
    return { kind: "recipient", label: "Recipient", sub: suins[a.toLowerCase()] ?? short0x(a) };
  }
  const contract = preview.contractsCalled?.find((c) => c.protocolName === cp);
  if (contract)
    return {
      kind: "protocol",
      label: cp,
      sub: CATEGORY_LABEL[contract.category] ?? contract.category,
      logoId: protocolLogoIdFromName(cp),
    };
  return { kind: "counterparty", label: cp, sub: row.sub };
}

function edgeProps(color: string) {
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

function buildGraph(
  rows: FlowRow[],
  preview: FlowPreviewInput,
  walletAddress: string | undefined,
  suins: Record<string, string>,
): { nodes: Node[]; edges: Edge[] } {
  const outs = rows.filter((r) => r.direction === "out");
  const ins = rows.filter((r) => r.direction === "in");
  // Vertical river: sources (inflows) on top → You in the middle → destinations
  // (outflows) at the bottom. Every edge flows downward, so they never cross or overlap.
  const rowX = (count: number, i: number) => (i - (count - 1) / 2) * COL_W; // centred around 0

  const youSub = walletAddress ? (suins[walletAddress.toLowerCase()] ?? short0x(walletAddress)) : undefined;
  const node = (id: string, x: number, y: number, data: NodeMeta): Node => ({ id, type: "flow", position: { x, y }, data: data as unknown as Record<string, unknown> });

  const nodes: Node[] = [
    ...ins.map((r, i) => node(`in-${i}`, rowX(ins.length, i), 0, counterpartyMeta(r, preview, suins))),
    node("you", 0, LEVEL_H, { kind: "you", label: "You", sub: youSub, primary: true }),
    ...outs.map((r, i) => node(`out-${i}`, rowX(outs.length, i), 2 * LEVEL_H, counterpartyMeta(r, preview, suins))),
  ];

  const edges: Edge[] = [
    ...ins.map((r, i) => ({ id: `ei-${i}`, source: `in-${i}`, target: "you", label: `+${r.amountFormatted} ${r.ticker}`, ...edgeProps(IN) })),
    ...outs.map((r, i) => ({ id: `eo-${i}`, source: "you", target: `out-${i}`, label: `−${r.amountFormatted} ${r.ticker}`, ...edgeProps(OUT) })),
  ];

  return { nodes, edges };
}

// Composite flow: the correct in/out topology, NOT a forced sequential river. An INDEPENDENT leg
// (a send, or a swap not fed by a prior leg) draws from the wallet, so its edge starts at You; a
// CHAINED leg (amountFrom=prev-output, e.g. the lend in swap→lend) connects to the prior node.
// So "send X to A and B" renders TWO outflows from You; swap→lend renders You → Cetus → NAVI.
function buildCompositeGraph(
  steps: CompositeFlowStep[],
  walletAddress: string | undefined,
  suins: Record<string, string>,
): { nodes: Node[]; edges: Edge[] } {
  const youSub = walletAddress ? (suins[walletAddress.toLowerCase()] ?? short0x(walletAddress)) : undefined;
  const node = (id: string, x: number, y: number, data: NodeMeta): Node => ({ id, type: "flow", position: { x, y }, data: data as unknown as Record<string, unknown> });

  // Each independent leg gets its own column at depth 1 (branches straight from You); a chained
  // leg sits one level below its parent in the same column (a vertical sub-chain).
  const colOf: number[] = [];
  const depthOf: number[] = [];
  let branches = 0;
  steps.forEach((s, i) => {
    if (s.chained && i > 0) {
      colOf[i] = colOf[i - 1];
      depthOf[i] = depthOf[i - 1] + 1;
    } else {
      colOf[i] = branches++;
      depthOf[i] = 1;
    }
  });
  const centeredX = (c: number) => (c - (branches - 1) / 2) * COL_W; // centre the branches under You

  const nodes: Node[] = [node("you", 0, 0, { kind: "you", label: "You", sub: youSub, primary: true })];
  const edges: Edge[] = [];
  steps.forEach((s, i) => {
    const id = `leg-${i}`;
    nodes.push(node(id, centeredX(colOf[i]), depthOf[i] * LEVEL_H, { kind: "protocol", label: s.nodeLabel, sub: s.nodeSub, logoId: s.logoId }));
    const chained = s.chained && i > 0;
    edges.push({
      id: `el-${i}`,
      source: chained ? `leg-${i - 1}` : "you",
      target: id,
      // From the wallet → outflow (−); from a prior leg → the intermediate coin (accent colour).
      label: chained ? s.edgeLabel : `−${s.edgeLabel}`,
      ...edgeProps(chained ? "var(--accent)" : OUT),
    });
  });
  return { nodes, edges };
}

// ---- component ------------------------------------------------------------

export function TxFlowGraph({
  preview,
  walletAddress,
  interactive = false,
}: {
  preview: FlowPreviewInput;
  walletAddress?: string;
  interactive?: boolean;
}) {
  const rows = useMemo(() => deriveFlowRows(preview, walletAddress), [preview, walletAddress]);
  const addrs = useMemo(
    () => [walletAddress, preview.recipientAddress].filter((a): a is string => !!a),
    [walletAddress, preview.recipientAddress],
  );
  const suins = useSuinsNames(addrs);

  const initial = useMemo(() => {
    // Composite (e.g. swap→lend): render the explicit leg chain so every protocol is a node.
    if (preview.compositeFlow && preview.compositeFlow.length > 0) {
      return buildCompositeGraph(deriveCompositeFlow(preview.compositeFlow, preview.coinDecimals), walletAddress, suins);
    }
    return buildGraph(rows, preview, walletAddress, suins);
  }, [rows, preview, walletAddress, suins]);
  const [nodes, , onNodesChange] = useNodesState(initial.nodes);
  const [edges, , onEdgesChange] = useEdgesState(initial.edges);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
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
