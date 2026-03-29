import React, { useMemo, useCallback, useRef, useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  useReactFlow,
  useOnViewportChange,
  type Node,
  type Edge,
  type Connection,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import { Plus, Minus, ArrowsOutCardinal, PencilSimple, Trash, Copy, X } from "@phosphor-icons/react";
import type { Card, FileChange } from "../types";
import CardNode, { type CardNodeData } from "./CardNode";

/* ---- Zoom button ---- */
function ZoomBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="w-7 h-7 flex items-center justify-center rounded-full bg-transparent border-none text-white/50 cursor-pointer transition-all duration-150 hover:bg-white/8 hover:text-white/90 active:bg-white/12 active:scale-95"
    >
      {icon}
    </button>
  );
}

/* ---- Bright dots overlay: matches ReactFlow Background pattern exactly ---- */
const BG_GAP = 18;
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
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    let rafId: number | null = null;

    const onMove = (e: MouseEvent) => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (!maskCircleRef.current || !svg) return;
        const rect = svg.getBoundingClientRect();
        maskCircleRef.current.setAttribute("cx", String(e.clientX - rect.left));
        maskCircleRef.current.setAttribute("cy", String(e.clientY - rect.top));
        // Show
        svg.style.opacity = "1";
        // Reset fade timer
        if (fadeTimer) clearTimeout(fadeTimer);
        fadeTimer = setTimeout(() => {
          if (svg) svg.style.opacity = "0";
        }, 1500);
      });
    };
    const onLeave = () => {
      if (maskCircleRef.current) {
        maskCircleRef.current.setAttribute("cx", "-500");
        maskCircleRef.current.setAttribute("cy", "-500");
      }
      if (svg) svg.style.opacity = "0";
      if (fadeTimer) clearTimeout(fadeTimer);
    };
    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      if (fadeTimer) clearTimeout(fadeTimer);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  const initRadius = (BG_SIZE * 1) / 2;

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 1, opacity: 0, transition: "opacity 0.6s ease" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          ref={patRef}
          id="fp-bright-dots"
          x="0"
          y="0"
          width={BG_GAP}
          height={BG_GAP}
          patternUnits="userSpaceOnUse"
          patternTransform={`translate(-${1 + BG_GAP / 2},-${1 + BG_GAP / 2})`}
        >
          <circle cx={initRadius} cy={initRadius} r={initRadius} fill="#ffffff" />
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
type FlowNode = Node<CardNodeData, "card">;

interface FlowCanvasProps {
  cards: Card[];
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
  onConnectCards?: (sourceId: string, targetId: string) => void;
  onDisconnectCards?: (sourceId: string, targetId: string) => void;
}

function areStringArraysEqual(prev: string[] = [], next: string[] = []) {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;
  return prev.every((value, index) => value === next[index]);
}

function areCardListsEqual(prev: Card[], next: Card[]) {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;
  return prev.every((card, index) => card === next[index]);
}

function areCardScopedCountsEqual(
  prev: Record<string, number>,
  next: Record<string, number>,
  cards: Card[],
) {
  return cards.every((card) => (prev[card.id] || 0) === (next[card.id] || 0));
}

function areCardScopedTypesEqual(
  prev: Record<string, string[]>,
  next: Record<string, string[]>,
  cards: Card[],
) {
  return cards.every((card) => areStringArraysEqual(prev[card.id] || [], next[card.id] || []));
}

function areCardScopedHighlightsEqual(
  prev: Record<string, "added" | "modified">,
  next: Record<string, "added" | "modified">,
  cards: Card[],
) {
  return cards.every((card) => (prev[card.id] || null) === (next[card.id] || null));
}

function areCardScopedPositionsEqual(
  prev: Record<string, { x: number; y: number }>,
  next: Record<string, { x: number; y: number }>,
  cards: Card[],
) {
  return cards.every((card) => {
    const prevPos = prev[card.id];
    const nextPos = next[card.id];
    if (!prevPos && !nextPos) return true;
    if (!prevPos || !nextPos) return false;
    return prevPos.x === nextPos.x && prevPos.y === nextPos.y;
  });
}

function areFlowCanvasPropsEqual(prev: FlowCanvasProps, next: FlowCanvasProps) {
  if (!areCardListsEqual(prev.cards, next.cards)) return false;
  if (prev.planTitle !== next.planTitle || prev.planId !== next.planId) return false;
  if (!areCardScopedCountsEqual(prev.feedbackCounts, next.feedbackCounts, next.cards)) return false;
  if (!areCardScopedTypesEqual(prev.feedbackTypes, next.feedbackTypes, next.cards)) return false;
  if (!areCardScopedHighlightsEqual(prev.highlightMap, next.highlightMap, next.cards)) return false;
  if (!areCardScopedPositionsEqual(prev.savedPositions, next.savedPositions, next.cards)) return false;
  if (prev.onSelectCard !== next.onSelectCard) return false;
  if (prev.onFileClick !== next.onFileClick) return false;
  if (prev.onPositionsChange !== next.onPositionsChange) return false;
  if (prev.onEditCard !== next.onEditCard) return false;
  if (prev.onDeleteCard !== next.onDeleteCard) return false;
  if (prev.onConnectCards !== next.onConnectCards) return false;
  if (prev.onDisconnectCards !== next.onDisconnectCards) return false;
  return true;
}

function isNodeDataEqual(prev: CardNodeData, next: CardNodeData) {
  return (
    prev.card === next.card &&
    prev.feedbackCount === next.feedbackCount &&
    prev.feedbackTypes === next.feedbackTypes &&
    prev.planTitle === next.planTitle &&
    prev.planId === next.planId &&
    prev.onFileClick === next.onFileClick &&
    prev.onEdit === next.onEdit &&
    prev.onDelete === next.onDelete &&
    prev.highlight === next.highlight
  );
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
        }),
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
  Object.values(groups).forEach((ids) => ids.sort((a, b) => (orderMap.get(a) ?? 0) - (orderMap.get(b) ?? 0)));

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
          strokeWidth: 1.5,
          cursor: "pointer",
        },
        className: "hover:!stroke-fp-danger transition-colors",
      });
    }
  }
  return edges;
}

const nodeTypes = { card: CardNode };

function FlowCanvasInner({
  cards,
  onSelectCard,
  feedbackCounts,
  feedbackTypes,
  planTitle,
  planId,
  onFileClick,
  highlightMap,
  savedPositions,
  onPositionsChange,
  onEditCard,
  onDeleteCard,
  onConnectCards,
  onDisconnectCards,
}: FlowCanvasProps) {
  const { fitView, zoomIn, zoomOut, getNodes } = useReactFlow();
  const hasFitView = useRef(false);
  const flowRef = useRef<HTMLDivElement>(null);
  const [ctxMenu, setCtxMenu] = useState<{
    id: string;
    top?: number;
    left?: number;
    right?: number;
    bottom?: number;
  } | null>(null);

  const autoLayout = useMemo(() => computeLayout(cards), [cards]);

  const initialNodes = useMemo<FlowNode[]>(() => {
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
  }, [
    cards,
    savedPositions,
    autoLayout,
    feedbackCounts,
    feedbackTypes,
    planTitle,
    planId,
    onFileClick,
    onEditCard,
    onDeleteCard,
    highlightMap,
  ]);

  const initialEdges = useMemo(() => cardsToEdges(cards), [cards]);

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const prevCardIdsRef = useRef<string>("");

  // Sync nodes when inputs change - preserve dragged positions
  useEffect(() => {
    const newCardIds = cards
      .map((c) => c.id)
      .sort()
      .join(",");
    const cardsChanged = newCardIds !== prevCardIdsRef.current;
    prevCardIdsRef.current = newCardIds;

    if (cardsChanged) {
      // Cards added/removed - full reset with positions
      setNodes(initialNodes);
    } else {
      // Only data changed (feedback counts, highlights, etc.) - preserve current positions
      const nodeMap = new Map(initialNodes.map((n) => [n.id, n]));
      setNodes((prev) => {
        let changed = false;
        const nextNodes = prev.map((n) => {
          const updated = nodeMap.get(n.id);
          if (!updated) return n;
          if (isNodeDataEqual(n.data, updated.data)) return n;
          changed = true;
          return { ...n, data: updated.data };
        });
        return changed ? nextNodes : prev;
      });
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
  }, [planId, cards.length, fitView]);

  const handleNodeDragStop = useCallback(
    () => {
      const positions: Record<string, { x: number; y: number }> = {};
      for (const n of getNodes()) {
        positions[n.id] = { x: Math.round(n.position.x), y: Math.round(n.position.y) };
      }
      onPositionsChange(positions);
    },
    [getNodes, onPositionsChange],
  );

  /* ---- Multi-select via ReactFlow native selection ---- */
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    hasFitView.current = false;
    setSelectedNodeIds([]);
    setCtxMenu(null);
  }, [planId]);

  const handleSelectionChange = useCallback(({ nodes: sel }: OnSelectionChangeParams) => {
    setSelectedNodeIds(sel.map((n) => n.id));
  }, []);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onSelectCard(node.id);
    },
    [onSelectCard],
  );

  const handlePaneClick = useCallback(() => {
    setCtxMenu(null);
    onSelectCard(null);
  }, [onSelectCard]);

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target && connection.source !== connection.target) {
        onConnectCards?.(connection.source, connection.target);
      }
    },
    [onConnectCards],
  );

  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      onDisconnectCards?.(edge.source, edge.target);
    },
    [onDisconnectCards],
  );

  const handleCopyRefs = useCallback(() => {
    const sel = cards.filter((c) => selectedNodeIds.includes(c.id));
    const refs = sel.flatMap((c) => c.files).filter(Boolean);
    navigator.clipboard.writeText(refs.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [cards, selectedNodeIds]);

  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    if (!flowRef.current) return;
    const pane = flowRef.current.getBoundingClientRect();
    setCtxMenu({
      id: node.id,
      top: event.clientY < pane.height - 200 ? event.clientY - pane.top : undefined,
      left: event.clientX < pane.width - 200 ? event.clientX - pane.left : undefined,
      right: event.clientX >= pane.width - 200 ? pane.right - event.clientX : undefined,
      bottom: event.clientY >= pane.height - 200 ? pane.bottom - event.clientY : undefined,
    });
  }, []);

  const closeCtxMenu = useCallback(() => setCtxMenu(null), []);

  // Close context menu on any click
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [ctxMenu]);

  return (
    <div ref={flowRef} className="w-full h-full relative">
      <ReactFlow<FlowNode, Edge>
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeDragStop={handleNodeDragStop}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onConnect={handleConnect}
        onEdgeClick={handleEdgeClick}
        onSelectionChange={handleSelectionChange}
        onNodeContextMenu={handleNodeContextMenu}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        style={{ background: "transparent" }}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={0.8} color="#5a5a5a" bgColor="#202124" />
        <BrightDotsOverlay />
      </ReactFlow>

      {/* Context menu */}
      {ctxMenu && (
        <div
          className="absolute z-[50] min-w-[140px] rounded-2xl animate-ctx-menu bg-[rgba(32,33,36,0.85)] backdrop-blur-[40px] border border-white/10 p-1.5"
          style={{ top: ctxMenu.top, left: ctxMenu.left, right: ctxMenu.right, bottom: ctxMenu.bottom }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditCard?.(ctxMenu.id);
              closeCtxMenu();
            }}
            className="w-full bg-transparent border border-transparent cursor-pointer py-2 px-3 rounded-xl flex items-center gap-2.5 text-[13px] font-medium font-sans whitespace-nowrap transition-all duration-150 ease-out text-fp-text hover:bg-white/6 active:bg-white/8"
          >
            <PencilSimple size={14} className="text-white/50" />
            <span>Edit</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteCard?.(ctxMenu.id);
              closeCtxMenu();
            }}
            className="w-full bg-transparent border border-transparent cursor-pointer py-2 px-3 rounded-xl flex items-center gap-2.5 text-[13px] font-medium font-sans whitespace-nowrap transition-all duration-150 ease-out text-fp-danger hover:bg-fp-danger-dim active:bg-fp-danger/20"
          >
            <Trash size={14} />
            <span>Delete</span>
          </button>
        </div>
      )}

      {/* Custom zoom controls */}
      <div
        className="absolute flex items-center gap-0.5 p-1 rounded-full border border-white/8 bg-[rgba(32,33,36,0.72)] backdrop-blur-[20px] animate-zoom-in"
        style={{ bottom: 14, left: "calc(var(--spacing-fp-sidebar) + var(--spacing-fp-gap) * 2 + 14px)" }}
      >
        <ZoomBtn
          icon={<Minus size={14} weight="regular" />}
          label="Zoom out"
          onClick={() => zoomOut({ duration: 200 })}
        />
        <ZoomBtn
          icon={<ArrowsOutCardinal size={14} weight="regular" />}
          label="Fit view"
          onClick={() => fitView({ padding: 0.3, duration: 300 })}
        />
        <ZoomBtn icon={<Plus size={14} weight="regular" />} label="Zoom in" onClick={() => zoomIn({ duration: 200 })} />
      </div>

      {/* Multi-select action bar */}
      {selectedNodeIds.length > 0 && (
        <div
          className="absolute flex items-center gap-2 py-1.5 pl-3 pr-1.5 rounded-full border border-white/8 bg-[rgba(32,33,36,0.72)] backdrop-blur-[20px]  animate-slide-up"
          style={{ bottom: 14, right: 14 }}
        >
          <span className="text-[12px] text-white/60 font-medium">
            {selectedNodeIds.length} card{selectedNodeIds.length > 1 ? "s" : ""} selected
          </span>
          <button
            onClick={handleCopyRefs}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-white/8 border-none text-[12px] font-medium text-white/80 cursor-pointer transition-all duration-150 hover:bg-white/12 hover:text-white active:scale-95"
          >
            <Copy size={13} weight="bold" />
            {copied ? "Copied!" : "Copy refs"}
          </button>
          <button
            onClick={() => setSelectedNodeIds([])}
            title="Clear selection"
            className="w-7 h-7 flex items-center justify-center rounded-full bg-transparent border-none text-white/40 cursor-pointer transition-all duration-150 hover:bg-white/8 hover:text-white/80"
          >
            <X size={13} weight="bold" />
          </button>
        </div>
      )}
    </div>
  );
}

export default React.memo(function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}, areFlowCanvasPropsEqual);
