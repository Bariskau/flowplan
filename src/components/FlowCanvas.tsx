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
  getNodesBounds,
  type Node,
  type Edge,
  type Connection,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import {
  Plus,
  Minus,
  ArrowsOutCardinal,
  PencilSimple,
  Trash,
  Copy,
  X,
} from "@phosphor-icons/react";
import { toPng } from "html-to-image";
import type { Card, FileChange } from "../types";
import { formatCardRef } from "../lib/refs";
import CardNode, { type CardNodeData } from "./CardNode";

/* ---- Zoom button ---- */
function ZoomBtn({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      disabled={disabled}
      className={`w-7 h-7 flex items-center justify-center rounded-full bg-transparent border-none transition-all duration-150 ${
        disabled
          ? "text-white/18 cursor-default"
          : "text-white/50 cursor-pointer hover:bg-white/8 hover:text-white/90 active:bg-white/12 active:scale-95"
      }`}
    >
      {icon}
    </button>
  );
}

/* ---- Bright dots overlay: second Background layer, same viewport math as base ---- */
const BG_GAP = 18;
const BG_SIZE = 0.8;
const BG_BRIGHT_SIZE = 1.05;

function BrightDotsOverlay({ containerRef }: { containerRef: React.RefObject<HTMLDivElement> }) {
  const [mask, setMask] = useState<{ x: number; y: number; visible: boolean }>({
    x: -500,
    y: -500,
    visible: false,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    let rafId: number | null = null;

    const showAt = (x: number, y: number) => {
      setMask({ x, y, visible: true });
      if (fadeTimer) clearTimeout(fadeTimer);
      fadeTimer = setTimeout(() => {
        setMask((prev) => ({ ...prev, visible: false }));
      }, 1500);
    };

    const onMove = (event: MouseEvent) => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const rect = container.getBoundingClientRect();
        showAt(event.clientX - rect.left, event.clientY - rect.top);
      });
    };

    const onLeave = () => {
      if (fadeTimer) clearTimeout(fadeTimer);
      setMask((prev) => ({ ...prev, visible: false }));
    };

    container.addEventListener("mousemove", onMove);
    container.addEventListener("mouseleave", onLeave);

    return () => {
      container.removeEventListener("mousemove", onMove);
      container.removeEventListener("mouseleave", onLeave);
      if (fadeTimer) clearTimeout(fadeTimer);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [containerRef]);

  const maskImage = `radial-gradient(circle 120px at ${mask.x}px ${mask.y}px, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)`;

  return (
    <Background
      id="fp-bright-dots"
      variant={BackgroundVariant.Dots}
      gap={BG_GAP}
      size={BG_BRIGHT_SIZE}
      color="#ffffff"
      bgColor="transparent"
      className="pointer-events-none"
      style={{
        opacity: mask.visible ? 1 : 0,
        transition: "opacity 0.6s ease",
        filter: "drop-shadow(0 0 8px rgba(255,255,255,0.4))",
        maskImage,
        WebkitMaskImage: maskImage,
      }}
    />
  );
}

const CW = 240;
const CH = 140;
const GX = 60;
const GY = 32;
type FlowNode = Node<CardNodeData, "card">;
type FlowViewport = { x: number; y: number; zoom: number };

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
  onExportSvgReady?: (exporter: (() => Promise<Blob | null>) | null) => void;
  onFrameChange?: (frame: { left: number; top: number; width: number; height: number } | null) => void;
  onViewportChange?: (viewport: FlowViewport | null) => void;
  readOnly?: boolean;
  readOnlyLabel?: string;
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
  if (prev.onExportSvgReady !== next.onExportSvgReady) return false;
  if (prev.onFrameChange !== next.onFrameChange) return false;
  if (prev.onViewportChange !== next.onViewportChange) return false;
  if (prev.readOnly !== next.readOnly || prev.readOnlyLabel !== next.readOnlyLabel) return false;
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

function isNodePositionEqual(
  prev: { x: number; y: number },
  next: { x: number; y: number },
) {
  return prev.x === next.x && prev.y === next.y;
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
  onExportSvgReady,
  onFrameChange,
  onViewportChange,
  readOnly = false,
  readOnlyLabel,
}: FlowCanvasProps) {
  const { fitView, zoomIn, zoomOut, getNodes, getViewport } = useReactFlow();
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
          onEdit: readOnly ? undefined : onEditCard,
          onDelete: readOnly ? undefined : onDeleteCard,
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
    readOnly,
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
      // Keep local node instances, but still apply remote position updates.
      const nodeMap = new Map(initialNodes.map((n) => [n.id, n]));
      setNodes((prev) => {
        let changed = false;
        const nextNodes = prev.map((n) => {
          const updated = nodeMap.get(n.id);
          if (!updated) return n;
          let nextNode = n;
          if (!isNodeDataEqual(n.data, updated.data)) {
            nextNode = { ...nextNode, data: updated.data };
            changed = true;
          }
          if (!isNodePositionEqual(n.position, updated.position)) {
            nextNode = { ...nextNode, position: updated.position };
            changed = true;
          }
          return nextNode;
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

  useEffect(() => {
    if (!readOnly) return;
    setSelectedNodeIds([]);
    setCtxMenu(null);
  }, [readOnly]);

  const handleSelectionChange = useCallback(({ nodes: sel }: OnSelectionChangeParams) => {
    if (readOnly) {
      setSelectedNodeIds([]);
      return;
    }
    setSelectedNodeIds(sel.map((n) => n.id));
  }, [readOnly]);

  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (event.ctrlKey || event.metaKey) return;
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
      if (readOnly) return;
      if (connection.source && connection.target && connection.source !== connection.target) {
        onConnectCards?.(connection.source, connection.target);
      }
    },
    [onConnectCards, readOnly],
  );

  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      if (readOnly) return;
      onDisconnectCards?.(edge.source, edge.target);
    },
    [onDisconnectCards, readOnly],
  );

  const handleCopyRefs = useCallback(() => {
    const sel = cards.filter((c) => selectedNodeIds.includes(c.id));
    const refs = sel.map((card) => formatCardRef(planTitle, card));
    navigator.clipboard.writeText(refs.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [cards, planTitle, selectedNodeIds]);

  const createSvgBlob = useCallback(async () => {
    const viewportEl = flowRef.current?.querySelector<HTMLElement>(".react-flow__viewport");
    const flowNodes = getNodes();
    if (!viewportEl || flowNodes.length === 0) return null;

    const bounds = getNodesBounds(flowNodes);
    const padding = 32;
    const width = Math.max(1, Math.ceil(bounds.width + padding * 2));
    const height = Math.max(1, Math.ceil(bounds.height + padding * 2));

    const pngDataUrl = await toPng(viewportEl, {
      backgroundColor: "#202124",
      cacheBust: true,
      pixelRatio: 2,
      width,
      height,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate(${-bounds.x + padding}px, ${-bounds.y + padding}px) scale(1)`,
        transformOrigin: "0 0",
      },
      filter: (node) => {
        const el = node as HTMLElement;
        if (el.classList?.contains("react-flow__background")) return false;
        if (el.classList?.contains("react-flow__selection")) return false;
        if (el.classList?.contains("react-flow__nodesselection")) return false;
        if (el.classList?.contains("react-flow__nodesselection-rect")) return false;
        if (el.classList?.contains("react-flow__panel")) return false;
        return true;
      },
    });

    const svgMarkup = `
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#202124" />
  <image width="${width}" height="${height}" preserveAspectRatio="none" href="${pngDataUrl}" xlink:href="${pngDataUrl}" />
</svg>`;

    return new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  }, [getNodes]);

  useEffect(() => {
    onExportSvgReady?.(createSvgBlob);
    return () => onExportSvgReady?.(null);
  }, [createSvgBlob, onExportSvgReady]);

  useOnViewportChange({
    onChange: useCallback((viewport: FlowViewport) => {
      onViewportChange?.(viewport);
    }, [onViewportChange]),
  });

  useEffect(() => {
    const updateFrame = () => {
      const rect = flowRef.current?.getBoundingClientRect();
      onFrameChange?.(
        rect
          ? {
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
            }
          : null,
      );
      onViewportChange?.(getViewport());
    };

    updateFrame();
    const resizeObserver = typeof ResizeObserver !== "undefined" && flowRef.current
      ? new ResizeObserver(updateFrame)
      : null;
    if (flowRef.current && resizeObserver) {
      resizeObserver.observe(flowRef.current);
    }
    window.addEventListener("resize", updateFrame);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateFrame);
      onFrameChange?.(null);
      onViewportChange?.(null);
    };
  }, [getViewport, onFrameChange, onViewportChange, planId, readOnlyLabel]);

  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    if (readOnly) return;
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
  }, [readOnly]);

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
        minZoom={0.12}
        connectionLineStyle={{
          stroke: "rgba(229, 231, 235, 0.92)",
          strokeWidth: 2.25,
          strokeDasharray: "6 5",
        }}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        proOptions={{ hideAttribution: true }}
        style={{ background: "transparent" }}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={0.8} color="#5a5a5a" bgColor="#202124" />
        <BrightDotsOverlay containerRef={flowRef} />
      </ReactFlow>

      {/* Context menu */}
      {ctxMenu && !readOnly && (
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
      {readOnlyLabel && (
        <div className="absolute top-[14px] right-[14px] flex items-center gap-2 animate-zoom-in">
          <div className="px-2.5 h-8 rounded-full border border-white/8 bg-[rgba(32,33,36,0.72)] backdrop-blur-[20px] inline-flex items-center text-[11px] font-medium text-white/65">
            {readOnlyLabel}
          </div>
        </div>
      )}

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
      {!readOnly && selectedNodeIds.length > 0 && (
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
