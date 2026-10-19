import { useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import type { Point } from '@sorenb/xaml-core';
import { ActivityIcon, type ActivityFamily } from './icons.js';

export type NodeShape = 'start' | 'step' | 'decision' | 'switch' | 'state' | 'final';

export interface GraphNode {
  id: string;
  label: string;
  shape: NodeShape;
  family: ActivityFamily;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  label?: string;
  /** Connector points stored by Studio, in canvas coordinates. */
  points?: Point[];
}

interface Placed extends GraphNode {
  x: number;
  y: number;
  w: number;
  h: number;
}

const DEFAULT_SIZE: Record<NodeShape, [number, number]> = {
  start: [60, 60],
  step: [200, 52],
  decision: [120, 80],
  switch: [120, 80],
  state: [200, 72],
  final: [200, 60],
};

/** Uses Studio's stored positions when every node has one, otherwise a simple layered layout from the start node. */
function layout(nodes: GraphNode[], edges: GraphEdge[], startId?: string): { placed: Placed[]; usesStudioLayout: boolean } {
  const sized = nodes.map((n) => {
    const [w, h] = DEFAULT_SIZE[n.shape];
    return { ...n, w: n.w ?? w, h: n.h ?? h };
  });
  if (sized.every((n) => n.x !== undefined && n.y !== undefined)) {
    return { placed: sized as Placed[], usesStudioLayout: true };
  }
  const layer = new Map<string, number>();
  const incoming = new Set(edges.map((e) => e.to));
  const queue = (startId ? [startId] : sized.filter((n) => !incoming.has(n.id)).map((n) => n.id)).slice();
  queue.forEach((id) => layer.set(id, 0));
  while (queue.length) {
    const id = queue.shift()!;
    for (const e of edges.filter((x) => x.from === id)) {
      if (!layer.has(e.to)) {
        layer.set(e.to, layer.get(id)! + 1);
        queue.push(e.to);
      }
    }
  }
  const maxLayer = Math.max(0, ...layer.values());
  sized.forEach((n) => !layer.has(n.id) && layer.set(n.id, maxLayer + 1));
  const rows = new Map<number, typeof sized>();
  sized.forEach((n) => rows.set(layer.get(n.id)!, [...(rows.get(layer.get(n.id)!) ?? []), n]));
  const placed: Placed[] = [];
  let y = 0;
  for (const l of [...rows.keys()].sort((a, b) => a - b)) {
    const row = rows.get(l)!;
    const rowWidth = row.reduce((s, n) => s + n.w, 0) + (row.length - 1) * 48;
    let x = -rowWidth / 2;
    const rowHeight = Math.max(...row.map((n) => n.h));
    for (const n of row) {
      placed.push({ ...n, x, y: y + (rowHeight - n.h) / 2 });
      x += n.w + 48;
    }
    y += rowHeight + 64;
  }
  return { placed, usesStudioLayout: false };
}

function edgePath(e: GraphEdge, from: Placed, to: Placed, useStored: boolean): Point[] {
  if (useStored && e.points && e.points.length >= 2) return e.points;
  const start = { x: from.x + from.w / 2, y: from.y + from.h };
  const end = { x: to.x + to.w / 2, y: to.y };
  if (to.y > from.y + from.h) {
    const midY = (start.y + end.y) / 2;
    return [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end];
  }
  // Loops back up: leave and enter on the right side.
  const out = { x: from.x + from.w, y: from.y + from.h / 2 };
  const into = { x: to.x + to.w, y: to.y + to.h / 2 };
  const side = Math.max(out.x, into.x) + 32;
  return [out, { x: side, y: out.y }, { x: side, y: into.y }, into];
}

const truncate = (s: string, w: number) => {
  const max = Math.max(4, Math.floor((w - 40) / 7));
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  startId?: string;
  selectedId?: string;
  onSelect: (id: string) => void;
  ariaLabel: string;
}

export function GraphCanvas({ nodes, edges, startId, selectedId, onSelect, ariaLabel }: Props) {
  const { placed, usesStudioLayout } = useMemo(() => layout(nodes, edges, startId), [nodes, edges, startId]);
  const byId = useMemo(() => new Map(placed.map((n) => [n.id, n])), [placed]);
  const paths = useMemo(
    () => edges.filter((e) => byId.has(e.from) && byId.has(e.to)).map((e) => ({ e, pts: edgePath(e, byId.get(e.from)!, byId.get(e.to)!, usesStudioLayout) })),
    [edges, byId, usesStudioLayout],
  );
  const bounds = useMemo(() => {
    const xs = [...placed.flatMap((n) => [n.x, n.x + n.w]), ...paths.flatMap((p) => p.pts.map((q) => q.x))];
    const ys = [...placed.flatMap((n) => [n.y, n.y + n.h]), ...paths.flatMap((p) => p.pts.map((q) => q.y))];
    const pad = 32;
    const x = Math.min(...xs) - pad;
    const y = Math.min(...ys) - pad;
    return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y };
  }, [placed, paths]);

  const [view, setView] = useState(bounds);
  const [lastBounds, setLastBounds] = useState(bounds);
  if (lastBounds !== bounds) {
    setLastBounds(bounds);
    setView(bounds);
  }
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const scale = () => {
    const r = svgRef.current?.getBoundingClientRect();
    return r && r.width ? Math.max(view.w / r.width, view.h / r.height) : 1;
  };
  const zoom = (factor: number, cx = view.x + view.w / 2, cy = view.y + view.h / 2) =>
    setView((v) => ({ x: cx - (cx - v.x) * factor, y: cy - (cy - v.y) * factor, w: v.w * factor, h: v.h * factor }));

  const onWheel = (ev: WheelEvent<SVGSVGElement>) => {
    if (!ev.ctrlKey && !ev.metaKey) return;
    ev.preventDefault();
    const r = svgRef.current!.getBoundingClientRect();
    const s = scale();
    zoom(ev.deltaY > 0 ? 1.15 : 1 / 1.15, view.x + (ev.clientX - r.left) * s, view.y + (ev.clientY - r.top) * s);
  };
  const onPointerDown = (ev: PointerEvent<SVGSVGElement>) => {
    if ((ev.target as Element).closest('.sbv-gnode')) return;
    drag.current = { x: ev.clientX, y: ev.clientY, vx: view.x, vy: view.y };
    (ev.target as Element).setPointerCapture?.(ev.pointerId);
  };
  const onPointerMove = (ev: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const s = scale();
    setView((v) => ({ ...v, x: d.vx - (ev.clientX - d.x) * s, y: d.vy - (ev.clientY - d.y) * s }));
  };
  const height = Math.min(Math.max(bounds.h, 220), 640);

  return (
    <div className="sbv-graph">
      <div className="sbv-graph__tools">
        <span className="sbv-muted">{usesStudioLayout ? 'Studio layout' : 'Automatic layout'} · drag to pan, Ctrl + scroll to zoom</span>
        <span className="sbv-graph__buttons">
          <button type="button" className="sbv-btn" onClick={() => zoom(1 / 1.25)} aria-label="Zoom in">+</button>
          <button type="button" className="sbv-btn" onClick={() => zoom(1.25)} aria-label="Zoom out">−</button>
          <button type="button" className="sbv-btn" onClick={() => setView(bounds)}>Fit</button>
        </span>
      </div>
      <svg
        ref={svgRef}
        className="sbv-graph__svg"
        role="group"
        aria-label={ariaLabel}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        style={{ height }}
        preserveAspectRatio="xMidYMin meet"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
        onPointerLeave={() => (drag.current = null)}
      >
        <defs>
          <marker id="sbv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" className="sbv-arrowhead" />
          </marker>
        </defs>
        {paths.map(({ e, pts }, i) => {
          const mid = pts[Math.floor((pts.length - 1) / 2)];
          const next = pts[Math.floor((pts.length - 1) / 2) + 1] ?? mid;
          const lx = (mid.x + next.x) / 2;
          const ly = (mid.y + next.y) / 2;
          return (
            <g key={i} className="sbv-gedge">
              <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} markerEnd="url(#sbv-arrow)" />
              {e.label && (
                <g transform={`translate(${lx},${ly})`}>
                  <rect x={-(e.label.length * 3.4 + 6)} y={-9} width={e.label.length * 6.8 + 12} height={18} rx={2} />
                  <text textAnchor="middle" dominantBaseline="central">{e.label}</text>
                </g>
              )}
            </g>
          );
        })}
        {placed.map((n) => {
          const selected = n.id === selectedId;
          const cx = n.x + n.w / 2;
          const cy = n.y + n.h / 2;
          const cls = `sbv-gnode sbv-gnode--${n.shape}${selected ? ' is-selected' : ''}`;
          const activate = () => onSelect(n.id);
          return (
            <g
              key={n.id}
              className={cls}
              tabIndex={0}
              role="button"
              aria-pressed={selected}
              aria-label={n.label}
              onClick={activate}
              onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), activate())}
            >
              {n.shape === 'start' ? (
                <>
                  <circle cx={cx} cy={cy} r={Math.min(n.w, n.h) / 2} />
                  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">Start</text>
                </>
              ) : n.shape === 'decision' || n.shape === 'switch' ? (
                <>
                  <polygon points={`${cx},${n.y} ${n.x + n.w},${cy} ${cx},${n.y + n.h} ${n.x},${cy}`} />
                  <text x={cx + n.w / 4 + 6} y={n.y + n.h / 4 - 4} className="sbv-gnode__caption">{truncate(n.label, 260)}</text>
                  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" className="sbv-muted-text">{n.shape === 'switch' ? 'Switch' : 'If'}</text>
                </>
              ) : (
                <>
                  <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={4} />
                  {n.shape === 'final' && <rect x={n.x + 3} y={n.y + 3} width={n.w - 6} height={n.h - 6} rx={2} className="sbv-gnode__inner" />}
                  <foreignObject x={n.x + 10} y={cy - 8} width={16} height={16}>
                    <ActivityIcon family={n.family} />
                  </foreignObject>
                  <text x={n.x + 32} y={cy} dominantBaseline="central">{truncate(n.label, n.w)}</text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
