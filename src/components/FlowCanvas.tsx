import React, { useMemo, useCallback, useRef, useState, useEffect } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  useReactFlow,
  Panel,
  BackgroundVariant,
  useOnViewportChange,
  type Node,
  type Edge,
} from "@xyflow/react";
import type { Card, FileChange } from "../types";
import { T } from "../lib/theme";
import CardNode from "./CardNode";
import DotGrid from "./DotGrid";

const CW = 272;
const CH = 160;
const GX = 64;
const GY = 28;

interface FlowCanvasProps {
  cards: Card[];
  selectedId: string | null;
  onSelectCard: (id: string | null) => void;
  feedbackCounts: Record<string, number>;
  feedbackTypes: Record<string, string[]>;
  planTitle: string;
  planId: string;
  onFileClick: (path: string, change: FileChange) => void;
  highlightMap: Record<string, "added" | "modified">;
  savedPositions: Record<string, { x: number; y: number }>;
  onPositionsChange: (positions: Record<string, { x: number; y: number }>) => void;
  onAddCard: () => void;
}

function computeLayout(cards: Card[]): Record<string, { x: number; y: number }> {
  const cols: Record<string, number> = {};
  const vis = new Set<string>();

  function depth(s: Card): number {
    if (vis.has(s.id)) return cols[s.id] || 0;
    vis.add(s.id);
    if (!s.dependencies.length) {
      cols[s.id] = 0;
      return 0;
    }
    cols[s.id] =
      1 +
      Math.max(
        ...s.dependencies.map((x) => {
          const f = cards.find((z) => z.id === x);
          return f ? depth(f) : 0;
        })
      );
    return cols[s.id];
  }

  cards.forEach(depth);

  const groups: Record<number, string[]> = {};
  cards.forEach((s) => {
    const c = cols[s.id] || 0;
    (groups[c] = groups[c] || []).push(s.id);
  });

  const orderMap = new Map(cards.map((s) => [s.id, s.order ?? 0]));
  Object.values(groups).forEach((ids) =>
    ids.sort((a, b) => (orderMap.get(a) ?? 0) - (orderMap.get(b) ?? 0))
  );

  const positions: Record<string, { x: number; y: number }> = {};
  Object.keys(groups)
    .sort((a, b) => +a - +b)
    .forEach((c) => {
      const ids = groups[+c];
      const totalHeight = ids.length * CH + (ids.length - 1) * GY;
      const startY = -totalHeight / 2;
      ids.forEach((id, i) => {
        positions[id] = { x: +c * (CW + GX), y: startY + i * (CH + GY) };
      });
    });

  return positions;
}

function cardsToEdges(cards: Card[]): Edge[] {
  const edges: Edge[] = [];
  for (const card of cards) {
    for (const dep of card.dependencies) {
      edges.push({
        id: `e-${dep}-${card.id}`,
        source: dep,
        target: card.id,
        animated: false,
        style: {
          stroke: "#333",
          strokeDasharray: "4 3",
          strokeWidth: 1.5,
        },
      });
    }
  }
  return edges;
}

const nodeTypes = { card: CardNode };

function FlowCanvasInner({
  cards,
  selectedId,
  onSelectCard,
  feedbackCounts,
  feedbackTypes,
  planTitle,
  planId,
  onFileClick,
  highlightMap,
  savedPositions,
  onPositionsChange,
  onAddCard,
}: FlowCanvasProps) {
  const { fitView } = useReactFlow();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFitView = useRef(false);

  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  useOnViewportChange({
    onChange: useCallback((viewport: { zoom: number; x: number; y: number }) => {
      setZoom(viewport.zoom);
      setPanX(viewport.x);
      setPanY(viewport.y);
    }, []),
  });

  const autoLayout = useMemo(() => computeLayout(cards), [cards]);

  const initialNodes = useMemo<Node[]>(() => {
    return cards.map((card) => {
      const pos = savedPositions[card.id] || autoLayout[card.id] || { x: 0, y: 0 };
      return {
        id: card.id,
        type: "card" as const,
        position: { x: pos.x, y: pos.y },
        data: {
          card,
          feedbackCount: feedbackCounts[card.id] || 0,
          feedbackTypes: feedbackTypes[card.id] || [],
          planTitle,
          planId,
          onFileClick,
          highlight: highlightMap[card.id] || null,
        },
      };
    });
  }, [cards, savedPositions, autoLayout, feedbackCounts, feedbackTypes, planTitle, planId, onFileClick, highlightMap]);

  const initialEdges = useMemo(() => cardsToEdges(cards), [cards]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync nodes when inputs change
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // fitView on first render
  useEffect(() => {
    if (!hasFitView.current && cards.length > 0) {
      hasFitView.current = true;
      // Small timeout to let React Flow measure nodes
      const t = setTimeout(() => fitView({ padding: 0.15, duration: 300 }), 50);
      return () => clearTimeout(t);
    }
  }, [cards.length, fitView]);

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, _node: Node, allNodes: Node[]) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const positions: Record<string, { x: number; y: number }> = {};
        for (const n of allNodes) {
          positions[n.id] = { x: n.position.x, y: n.position.y };
        }
        onPositionsChange(positions);
      }, 500);
    },
    [onPositionsChange]
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onSelectCard(node.id);
    },
    [onSelectCard]
  );

  const handlePaneClick = useCallback(() => {
    onSelectCard(null);
  }, [onSelectCard]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <DotGrid zoom={zoom} panX={panX} panY={panY} />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeDragStop={handleNodeDragStop}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        colorMode="dark"
        fitView
        proOptions={{ hideAttribution: true }}
        style={{ background: "transparent" }}
      >
        <Controls
          showInteractive={false}
          style={{
            background: T.surfaceSolid,
            border: `1px solid ${T.border}`,
            borderRadius: 6,
          }}
        />
        <Panel position="bottom-left">
          <button
            onClick={onAddCard}
            style={{
              background: T.accent,
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: T.f,
              cursor: "pointer",
            }}
          >
            Add Card
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );
}

export default function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
