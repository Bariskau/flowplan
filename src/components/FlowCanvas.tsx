import React, { useMemo, useCallback, useRef, useEffect } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  useReactFlow,
  useOnViewportChange,
  type Node,
  type Edge,
} from "@xyflow/react";
import type { Card, FileChange } from "../types";
import CardNode from "./CardNode";

/* ---- Bright dots overlay: matches ReactFlow Background pattern exactly ---- */
const BG_GAP = 24;
const BG_SIZE = 0.8;

function BrightDotsOverlay() {
  const svgRef = useRef<SVGSVGElement>(null);
  const patRef = useRef<SVGPatternElement>(null);
  const maskCircleRef = useRef<SVGCircleElement>(null);

  // Match ReactFlow Background pattern:
  // scaledGap = gap * zoom
  // pattern x = transform.x % scaledGap
  // pattern y = transform.y % scaledGap
  // patternTransform = translate(-(scaledGap/2), -(scaledGap/2))
  // dot: cx=radius, cy=radius, r=radius  (radius = size * zoom / 2)
  useOnViewportChange({
    onChange: useCallback((vp: { zoom: number; x: number; y: number }) => {
      if (!patRef.current) return;
      const scaledGap = BG_GAP * vp.zoom;
      const radius = (BG_SIZE * vp.zoom) / 2;
      const px = vp.x % scaledGap;
      const py = vp.y % scaledGap;
      const offsetX = 1 + scaledGap / 2;
      const offsetY = 1 + scaledGap / 2;

      patRef.current.setAttribute("width", String(scaledGap));
      patRef.current.setAttribute("height", String(scaledGap));
      patRef.current.setAttribute("x", String(px));
      patRef.current.setAttribute("y", String(py));
      patRef.current.setAttribute("patternTransform", `translate(-${offsetX},-${offsetY})`);
      const dot = patRef.current.querySelector("circle");
      if (dot) {
        dot.setAttribute("cx", String(radius));
        dot.setAttribute("cy", String(radius));
        dot.setAttribute("r", String(Math.max(0.2, radius)));
      }
    }, []),
  });

  useEffect(() => {
    const svg = svgRef.current;
    const onMove = (e: MouseEvent) => {
      if (!maskCircleRef.current || !svg) return;
      const rect = svg.getBoundingClientRect();
      maskCircleRef.current.setAttribute("cx", String(e.clientX - rect.left));
      maskCircleRef.current.setAttribute("cy", String(e.clientY - rect.top));
    };
    const onLeave = () => {
      if (maskCircleRef.current) {
        maskCircleRef.current.setAttribute("cx", "-500");
        maskCircleRef.current.setAttribute("cy", "-500");
      }
    };
    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  const initRadius = (BG_SIZE * 1) / 2;

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 1 }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          ref={patRef}
          id="fp-bright-dots"
          x="0" y="0"
          width={BG_GAP} height={BG_GAP}
          patternUnits="userSpaceOnUse"
          patternTransform={`translate(-${1 + BG_GAP / 2},-${1 + BG_GAP / 2})`}
        >
          <circle cx={initRadius} cy={initRadius} r={initRadius} fill="#bbb" />
        </pattern>
        <radialGradient id="fp-mask-grad">
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </radialGradient>
        <mask id="fp-cursor-mask">
          <circle ref={maskCircleRef} cx="-500" cy="-500" r="120" fill="url(#fp-mask-grad)" />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="url(#fp-bright-dots)" mask="url(#fp-cursor-mask)" />
    </svg>
  );
}

const CW = 240;
const CH = 140;
const GX = 60;
const GY = 32;

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
  onEditCard?: (cardId: string) => void;
  onDeleteCard?: (cardId: string) => void;
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
          stroke: "#3f3f46",
          strokeDasharray: "4 3",
          strokeWidth: 1,
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
  onEditCard,
  onDeleteCard,
}: FlowCanvasProps) {
  const { fitView } = useReactFlow();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFitView = useRef(false);

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
          onEdit: onEditCard,
          onDelete: onDeleteCard,
          highlight: highlightMap[card.id] || null,
        },
      };
    });
  }, [cards, savedPositions, autoLayout, feedbackCounts, feedbackTypes, planTitle, planId, onFileClick, onEditCard, onDeleteCard, highlightMap]);

  const initialEdges = useMemo(() => cardsToEdges(cards), [cards]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const prevCardIdsRef = useRef<string>("");

  // Sync nodes when inputs change - preserve dragged positions
  useEffect(() => {
    const newCardIds = cards.map(c => c.id).sort().join(",");
    const cardsChanged = newCardIds !== prevCardIdsRef.current;
    prevCardIdsRef.current = newCardIds;

    if (cardsChanged) {
      // Cards added/removed - full reset with positions
      setNodes(initialNodes);
    } else {
      // Only data changed (feedback counts, highlights, etc.) - preserve current positions
      setNodes(prev => prev.map(n => {
        const updated = initialNodes.find(init => init.id === n.id);
        if (!updated) return n;
        return { ...n, data: updated.data };
      }));
    }
  }, [initialNodes, setNodes, cards]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // fitView on first render
  useEffect(() => {
    if (!hasFitView.current && cards.length > 0) {
      hasFitView.current = true;
      const t = setTimeout(() => fitView({ padding: 0.3, duration: 300 }), 50);
      return () => clearTimeout(t);
    }
  }, [cards.length, fitView]);

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node, allNodes: Node[]) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const positions: Record<string, { x: number; y: number }> = {};
        for (const n of allNodes) {
          positions[n.id] = { x: Math.round(n.position.x), y: Math.round(n.position.y) };
        }
        onPositionsChange(positions);
      }, 300);
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

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, _node: Node) => {
      // Prevent the default browser context menu; the CardNode handles its own context menu
      event.preventDefault();
    },
    []
  );

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeDragStop={handleNodeDragStop}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onNodeContextMenu={handleNodeContextMenu}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        style={{ background: "transparent" }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={0.8} color="#555" />
        <BrightDotsOverlay />
        <Controls
          showInteractive={false}
          style={{
            left: 10,
            bottom: 10,
            background: "rgba(24,24,27,0.80)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 8,
            backdropFilter: "blur(12px)",
          }}
        />
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
