/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Damage, MemberType, getMemberColorClass } from '../types';
import { ZoomIn, ZoomOut, RotateCcw, Layers } from 'lucide-react';

interface DrawingCanvasProps {
  damages: Damage[];
  onAddMarker: (x: number, y: number) => void;
  drawingUrl: string | null;
  activeDamageId: string | null;
  onSelectDamage: (id: string) => void;
}

interface GroupedPoints {
  id: string; // Coordinate string with floor e.g., "50.5-42.3-지상1층"
  x: number;  // original percentage
  y: number;  // original percentage
  layoutY: number; // calculated layout position with collision avoidance
  damages: Damage[];
  primaryMember: MemberType;
}

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  damages,
  onAddMarker,
  drawingUrl,
  activeDamageId,
  onSelectDamage,
}) => {
  const [zoom, setZoom] = useState<number>(1.0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 600, height: 450 });
  
  // New visual parameters with requested default settings:
  // 1. 텍스트상자 투명도 80% (opacity 0.8)
  // 2. 텍스트상자 50%의 크기로 축소 (sizeScale 0.5)
  // 3. 겹치지 않도록 자동 위치 조정 기능 활성화 (autoAvoidOverlap)
  const [opacity, setOpacity] = useState<number>(0.8);
  const [sizeScale, setSizeScale] = useState<number>(0.5);
  const [autoAvoidOverlap, setAutoAvoidOverlap] = useState<boolean>(true);

  // States to manage custom dragged positions of text boxes (labels)
  const [customPositions, setCustomPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragOffsetStart, setDragOffsetStart] = useState<{ x: number; y: number } | null>(null);

  // 부재별 시각적 레이어 온오프 제어 상태
  const [visibleLayers, setVisibleLayers] = useState<Record<MemberType, boolean>>({
    '기둥': true,
    '벽체': true,
    '보': true,
    '슬래브': true,
  });

  const toggleLayer = (member: MemberType) => {
    setVisibleLayers((prev) => ({
      ...prev,
      [member]: !prev[member],
    }));
  };

  // Mouse drag handler on individual label cards
  const handleMouseDown = (e: React.MouseEvent, id: string, ix: number, iy: number) => {
    // If the user is clicking on scrollable items/buttons, don't trigger drag
    if ((e.target as HTMLElement).closest('.stop-drag')) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setDraggedId(id);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragOffsetStart({ x: ix, y: iy });
  };

  // Window-level mouse listener to make dragging butter-smooth
  useEffect(() => {
    if (!draggedId || !dragStart || !dragOffsetStart) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;

      // Convert pixel deltas to percentage coordinates on container size
      // Compensate for the physical zoom factor
      const pctDx = (dx / containerSize.width) * 100 / zoom;
      const pctDy = (dy / containerSize.height) * 100 / zoom;

      const newX = Math.max(0, Math.min(100, dragOffsetStart.x + pctDx));
      const newY = Math.max(0, Math.min(100, dragOffsetStart.y + pctDy));

      setCustomPositions((prev) => ({
        ...prev,
        [draggedId]: { x: newX, y: newY },
      }));
    };

    const handleMouseUp = () => {
      setDraggedId(null);
      setDragStart(null);
      setDragOffsetStart(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggedId, dragStart, dragOffsetStart, containerSize, zoom]);

  // Update container size dynamically to keep coordinates sync
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3.0));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.75));
  const handleZoomReset = () => setZoom(1.0);

  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svgElement = e.currentTarget;
    const rect = svgElement.getBoundingClientRect();
    
    // Absolute position within the SVG bounding box regardless of Zoom
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const percentX = (clickX / rect.width) * 100;
    const percentY = (clickY / rect.height) * 100;

    onAddMarker(percentX, percentY);
  };

  // 1. Group damages by location (Snap within 1.5% radius AND match same floor)
  const groupDamages = (): GroupedPoints[] => {
    const groups: GroupedPoints[] = [];
    const threshold = 1.6; // 1.5% - 1.6% radius

    // Filter damages with active markers and visible structural layers
    const markedDamages = damages.filter((d) => d.marker !== null && visibleLayers[d.member]);

    markedDamages.forEach((damage) => {
      if (!damage.marker) return;
      
      // Look for any existing close group on the SAME floor
      let joined = false;
      for (const g of groups) {
        const dx = g.x - damage.marker.x;
        const dy = g.y - damage.marker.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Match both coordinate proximity AND floor identity
        if (dist <= threshold && g.damages[0].floor === damage.floor) {
          g.damages.push(damage);
          joined = true;
          break;
        }
      }

      if (!joined) {
        groups.push({
          id: `${damage.marker.x.toFixed(2)}-${damage.marker.y.toFixed(2)}-${damage.floor}`,
          x: damage.marker.x,
          y: damage.marker.y,
          layoutY: damage.marker.y,
          damages: [damage],
          primaryMember: damage.member,
        });
      }
    });

    return groups;
  };

  const defectGroups = groupDamages();

  // 2. Perform Y-collision avoidance algorithm with dynamic minGap calculation
  const layoutLabels = (groups: GroupedPoints[]) => {
    const leftColumn: typeof groups = [];
    const rightColumn: typeof groups = [];

    // Split groups to left or right based on central coordinate
    groups.forEach((g) => {
      if (g.x < 50) {
        leftColumn.push({ ...g });
      } else {
        rightColumn.push({ ...g });
      }
    });

    // Sort both columns descending/ascending vertically
    leftColumn.sort((a, b) => a.y - b.y);
    rightColumn.sort((a, b) => a.y - b.y);

    // Separation between adjacent box centers in percentage scale.
    // Proportional to text-box size! (Smaller text-boxes require less spacing gap)
    const minGap = autoAvoidOverlap ? Math.max(3.5, 11 * sizeScale) : 0;

    // Push down pass (Forward)
    const resolveOverlapForward = (col: typeof groups) => {
      for (let i = 1; i < col.length; i++) {
        const prev = col[i - 1];
        const curr = col[i];
        if (curr.layoutY < prev.layoutY + minGap) {
          curr.layoutY = prev.layoutY + minGap;
        }
      }
    };

    // Push up pass (Backward) to prevent running below 100%
    const resolveOverlapBackward = (col: typeof groups) => {
      for (let i = col.length - 2; i >= 0; i--) {
        const next = col[i + 1];
        const curr = col[i];
        if (curr.layoutY > next.layoutY - minGap) {
          curr.layoutY = next.layoutY - minGap;
        }
      }
    };

    if (autoAvoidOverlap) {
      resolveOverlapForward(leftColumn);
      resolveOverlapBackward(leftColumn);
      resolveOverlapForward(rightColumn);
      resolveOverlapBackward(rightColumn);
    } else {
      // If auto avoidance is OFF, fall back to exact vertical markers values
      leftColumn.forEach((g) => { g.layoutY = g.y; });
      rightColumn.forEach((g) => { g.layoutY = g.y; });
    }

    // Keep layout coordinates within boundary
    leftColumn.forEach((g) => {
      if (g.layoutY < 5) g.layoutY = 5;
      if (g.layoutY > 95) g.layoutY = 95;
    });

    rightColumn.forEach((g) => {
      if (g.layoutY < 5) g.layoutY = 5;
      if (g.layoutY > 95) g.layoutY = 95;
    });

    return {
      leftLayout: leftColumn,
      rightLayout: rightColumn,
    };
  };

  const { leftLayout, rightLayout } = layoutLabels(defectGroups);

  // Helper inside loop - width percentage
  const baseWidthPct = 16.5;
  const widthPct = baseWidthPct * (sizeScale < 0.85 ? 0.9 : 1.0); // optimized container matching width

  // 1. Process all labels and calculate their actual top-left coordinates & attach points
  const rawAppliedLabels = [
    ...leftLayout.map((g) => {
      const dynamicWidthPct = widthPct * sizeScale;
      const defaultX = 1.0;
      const defaultY = g.layoutY - (5.0 * sizeScale);
      
      const boxX = customPositions[g.id] !== undefined ? customPositions[g.id].x : defaultX;
      const boxY = customPositions[g.id] !== undefined ? customPositions[g.id].y : defaultY;
      
      const side = boxX + dynamicWidthPct / 2 < g.x ? 'left' as const : 'right' as const;
      const attachX = side === 'left' ? boxX + dynamicWidthPct : boxX;
      const attachY = boxY + (5.0 * sizeScale);

      return {
        ...g,
        boxX,
        boxY,
        side,
        attachX,
        attachY,
        dynamicWidthPct,
      };
    }),
    ...rightLayout.map((g) => {
      const dynamicWidthPct = widthPct * sizeScale;
      const defaultX = 100 - dynamicWidthPct - 1.0;
      const defaultY = g.layoutY - (5.0 * sizeScale);
      
      const boxX = customPositions[g.id] !== undefined ? customPositions[g.id].x : defaultX;
      const boxY = customPositions[g.id] !== undefined ? customPositions[g.id].y : defaultY;
      
      const side = boxX + dynamicWidthPct / 2 < g.x ? 'left' as const : 'right' as const;
      const attachX = side === 'left' ? boxX + dynamicWidthPct : boxX;
      const attachY = boxY + (5.0 * sizeScale);

      return {
        ...g,
        boxX,
        boxY,
        side,
        attachX,
        attachY,
        dynamicWidthPct,
      };
    })
  ];

  // 2. Perform lane-striping layout to completely prevent indicator line overlaps
  const leftSideConns = rawAppliedLabels.filter((c) => c.side === 'left');
  const rightSideConns = rawAppliedLabels.filter((c) => c.side === 'right');

  // Sort by mX / x point coordinates to preserve clean tracks closest to card/marker
  leftSideConns.sort((a, b) => a.x - b.x);
  rightSideConns.sort((a, b) => b.x - a.x);

  // Map to get unique lane indices
  const allLayoutLabels = [
    ...leftSideConns.map((c, i) => ({ ...c, laneIndex: i })),
    ...rightSideConns.map((c, i) => ({ ...c, laneIndex: i })),
  ];

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
      {/* Control panel buttons */}
      <div className="flex items-center justify-between p-3 bg-slate-800/80 border-b border-slate-700/60 backdrop-blur-md">
        <span className="text-sm font-medium text-slate-200 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          스마트 도면 마킹 캔버스 뷰
        </span>
        <div className="flex gap-2">
          <button
            onClick={handleZoomIn}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-100 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 rounded-lg transition-colors border border-slate-600 cursor-pointer"
            title="확대 Zoom In"
          >
            <ZoomIn className="h-3.5 w-3.5" />
            확대
          </button>
          <button
            onClick={handleZoomOut}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-100 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 rounded-lg transition-colors border border-slate-600 cursor-pointer"
            title="축소 Zoom Out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
            축소
          </button>
          <button
            onClick={handleZoomReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700 cursor-pointer"
            title="초기화 Reset"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {Math.round(zoom * 100)}%
          </button>
        </div>
      </div>

      {/* Rich interactive configurations subheader bar */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2 bg-[#0e131f] border-b border-slate-800 text-xs font-medium text-slate-300">
        <div className="flex items-center gap-2 border-r border-slate-800/80 pr-4">
          <span className="text-slate-400 select-none">텍스트 정렬:</span>
          <button
            onClick={() => setAutoAvoidOverlap(!autoAvoidOverlap)}
            className={`px-2 py-1 rounded text-[10px] font-bold select-none cursor-pointer duration-100 ${
              autoAvoidOverlap
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/20'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
            }`}
          >
            {autoAvoidOverlap ? '자동 겹침 방지 ON' : '기본 중첩 위치 OFF'}
          </button>
        </div>

        <div className="flex items-center gap-2 border-r border-slate-800/80 pr-4">
          <span className="text-slate-400 select-none">투명도 수치:</span>
          <input
            type="range"
            min="0.2"
            max="1.0"
            step="0.05"
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            className="w-16 sm:w-20 accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
          />
          <span className="font-mono text-cyan-400 text-[10px] w-8 text-right">{Math.round(opacity * 100)}%</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 select-none">라벨 상자 크기:</span>
          <input
            type="range"
            min="0.30"
            max="1.10"
            step="0.05"
            value={sizeScale}
            onChange={(e) => setSizeScale(parseFloat(e.target.value))}
            className="w-16 sm:w-20 accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
          />
          <span className="font-mono text-cyan-400 text-[10px] w-8 text-right">{Math.round(sizeScale * 100)}%</span>
        </div>

        {/* Dynamic Reset Custom Positions handler */}
        {Object.keys(customPositions).length > 0 && (
          <button
            onClick={() => setCustomPositions({})}
            className="ml-auto px-25 py-1.5 rounded text-[10px] font-bold cursor-pointer bg-rose-950/40 border border-rose-500/30 hover:bg-rose-900/40 text-rose-300 transition duration-100 uppercase font-mono tracking-wider"
          >
            위치 초기화 Undo Drag
          </button>
        )}
      </div>

      {/* 구조부재 레이어 제어 패널 (Visual Toggle Layer Controls) */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-slate-800/40 border-b border-slate-800/80 text-xs text-slate-300">
        <span className="text-slate-400 font-medium select-none flex items-center gap-1.5 mr-1 font-sans">
          <Layers className="h-3.5 w-3.5 text-indigo-400" />
          부재 레이어 필터:
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {/* 기둥 (Columns) */}
          <button
            onClick={() => toggleLayer('기둥')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-150 cursor-pointer flex items-center gap-1.5 border ${
              visibleLayers['기둥']
                ? 'bg-rose-500/10 text-rose-300 border-rose-500/30 shadow-xs'
                : 'bg-slate-900/40 text-slate-500 border-slate-800 hover:border-slate-700/50'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${visibleLayers['기둥'] ? 'bg-rose-500 shadow-[0_0_6px_#ef4444]' : 'bg-slate-600'}`}></span>
            기둥
            <span className={`font-mono text-[9px] px-1.5 py-0.2 rounded-full ${visibleLayers['기둥'] ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-800 text-slate-600'}`}>
              {damages.filter((d) => d.marker !== null && d.member === '기둥').length}
            </span>
          </button>
          
          {/* 벽체 (Walls) */}
          <button
            onClick={() => toggleLayer('벽체')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-150 cursor-pointer flex items-center gap-1.5 border ${
              visibleLayers['벽체']
                ? 'bg-rose-500/10 text-rose-300 border-rose-500/30 shadow-xs'
                : 'bg-slate-900/40 text-slate-500 border-slate-800 hover:border-slate-700/50'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${visibleLayers['벽체'] ? 'bg-rose-500 shadow-[0_0_6px_#ef4444]' : 'bg-slate-600'}`}></span>
            벽체
            <span className={`font-mono text-[9px] px-1.5 py-0.2 rounded-full ${visibleLayers['벽체'] ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-800 text-slate-600'}`}>
              {damages.filter((d) => d.marker !== null && d.member === '벽체').length}
            </span>
          </button>

          {/* 보 (Beams) */}
          <button
            onClick={() => toggleLayer('보')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-150 cursor-pointer flex items-center gap-1.5 border ${
              visibleLayers['보']
                ? 'bg-sky-500/10 text-sky-400 border-sky-500/30 shadow-xs'
                : 'bg-slate-900/40 text-slate-500 border-slate-800 hover:border-slate-700/50'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${visibleLayers['보'] ? 'bg-sky-400 shadow-[0_0_6px_#38bdf8]' : 'bg-slate-600'}`}></span>
            보
            <span className={`font-mono text-[9px] px-1.5 py-0.2 rounded-full ${visibleLayers['보'] ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-800 text-slate-600'}`}>
              {damages.filter((d) => d.marker !== null && d.member === '보').length}
            </span>
          </button>

          {/* 슬래브 (Slabs) */}
          <button
            onClick={() => toggleLayer('슬래브')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-150 cursor-pointer flex items-center gap-1.5 border ${
              visibleLayers['슬래브']
                ? 'bg-sky-500/10 text-sky-400 border-sky-500/30 shadow-xs'
                : 'bg-slate-900/40 text-slate-500 border-slate-800 hover:border-slate-700/50'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${visibleLayers['슬래브'] ? 'bg-sky-400 shadow-[0_0_6px_#38bdf8]' : 'bg-slate-600'}`}></span>
            슬래브
            <span className={`font-mono text-[9px] px-1.5 py-0.2 rounded-full ${visibleLayers['슬래브'] ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-800 text-slate-600'}`}>
              {damages.filter((d) => d.marker !== null && d.member === '슬래브').length}
            </span>
          </button>
        </div>

        {/* Quick buttons */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setVisibleLayers({ '기둥': true, '벽체': true, '보': true, '슬래브': true })}
            className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-indigo-400 hover:bg-slate-800/80 rounded transition duration-150 border border-transparent hover:border-slate-700/30 cursor-pointer"
          >
            전체 켜기
          </button>
          <button
            onClick={() => setVisibleLayers({ '기둥': false, '벽체': false, '보': false, '슬래브': false })}
            className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded transition duration-150 border border-transparent hover:border-slate-700/30 cursor-pointer"
          >
            전체 끄기
          </button>
        </div>
      </div>

      {/* Main interactive area */}
      <div
        ref={containerRef}
        className="relative flex-1 bg-slate-950 overflow-auto flex items-center justify-center p-4 min-h-[380px]"
      >
        <div
          className="relative transition-transform duration-150 ease-out origin-center"
          style={{
            transform: `scale(${zoom})`,
            width: '100%',
            maxWidth: '900px',
            aspectRatio: '16/11',
          }}
        >
          {/* Layout Background Drawing Image or grid placeholder */}
          {drawingUrl ? (
            <img
              src={drawingUrl}
              alt="Structural Drawing"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none rounded-sm border border-slate-800 select-none bg-slate-900"
              referrerPolicy="no-referrer"
            />
          ) : (
            /* Elegant grid placeholder if no custom drawing */
            <div className="absolute inset-0 w-full h-full bg-[#111622] rounded-md border border-slate-800/80 flex flex-col justify-between p-4 flex-wrap relative select-none">
              {/* Construction Grid Pattern lines */}
              <div className="absolute inset-0 grid grid-cols-12 grid-rows-8 pointer-events-none">
                {Array.from({ length: 96 }).map((_, i) => (
                  <div key={i} className="border-t border-l border-sky-500/5 h-full w-full"></div>
                ))}
              </div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                <p className="text-slate-400 font-sans text-sm tracking-wide">
                  도면이 등록되지 않았습니다.
                </p>
                <p className="text-slate-500 font-mono text-[10px] mt-1 uppercase">
                  (클릭 시 가상 도면 영역에 마커가 저장됩니다)
                </p>
              </div>

              {/* Grid axes labels */}
              <div className="flex w-full justify-between text-[11px] font-mono text-cyan-500/45 px-2 pointer-events-none">
                <span>X1</span>
                <span>X2</span>
                <span>X3</span>
                <span>X4</span>
                <span>X5</span>
              </div>
              <div className="flex flex-col justify-between h-4/5 text-[11px] font-mono text-cyan-500/45 pointer-events-none">
                <span>Y4</span>
                <span>Y3</span>
                <span>Y2</span>
                <span>Y1</span>
              </div>
            </div>
          )}

          {/* Interactive SVG Overlay */}
          <svg
            className="absolute inset-0 w-full h-full cursor-crosshair select-none"
            onClick={handleCanvasClick}
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* 1. Render pointer lines & 2 connected line segments connecting labels to markers */}
            {allLayoutLabels.map((lbl) => {
              // Find where the marker is mapped (percentage)
              const mX = lbl.x;
              const mY = lbl.y; // Original exact coordinate of dot

              // Target layout coordinates
              const tX = lbl.attachX;
              const tY = lbl.attachY;
              const laneIndex = lbl.laneIndex ?? 0;

              // Calculate unique non-overlapping horizontal gutter lane for this pointer
              let elbowX = lbl.side === 'left' 
                ? tX + (2.0 + laneIndex * 1.2) * sizeScale 
                : tX - (2.0 + laneIndex * 1.2) * sizeScale;

              // Boundary check: ensure elbow stays between attachment and marker with safety padding
              if (lbl.side === 'left') {
                if (elbowX > mX - 1.5) {
                  elbowX = Math.max(tX + 0.5, (tX + mX) / 2);
                }
              } else {
                if (elbowX < mX + 1.5) {
                  elbowX = Math.min(tX - 0.5, (tX + mX) / 2);
                }
              }

              const isRed = getMemberColorClass(lbl.primaryMember) === 'red';
              const strokeColor = isRed ? '#ef4444' : '#3b82f6'; // Bright Red vs Bright Blue for high-fidelity lines

              return (
                <g key={`line-${lbl.id}`} className="pointer-events-none">
                  {/* First horizontal segment: marker point outwards to its unique gutter lane */}
                  <line
                    x1={`${mX}%`}
                    y1={`${mY}%`}
                    x2={`${elbowX}%`}
                    y2={`${mY}%`}
                    stroke={strokeColor}
                    strokeWidth={1.8 / zoom}
                    strokeDasharray="2,2"
                    className="opacity-90"
                  />
                  {/* Second vertical segment: vertical routing along helper lane */}
                  <line
                    x1={`${elbowX}%`}
                    y1={`${mY}%`}
                    x2={`${elbowX}%`}
                    y2={`${tY}%`}
                    stroke={strokeColor}
                    strokeWidth={1.8 / zoom}
                    strokeDasharray="2,2"
                    className="opacity-95"
                  />
                  {/* Third horizontal segment: gutter lane into label card attachment point */}
                  <line
                    x1={`${elbowX}%`}
                    y1={`${tY}%`}
                    x2={`${tX}%`}
                    y2={`${tY}%`}
                    stroke={strokeColor}
                    strokeWidth={2.0 / zoom}
                    className="opacity-100"
                  />
                </g>
              );
            })}

            {/* 2. Render physical Small Dots for markers (Grouped) */}
            {defectGroups.map((g) => {
              const isRed = getMemberColorClass(g.primaryMember) === 'red';
              const dotColor = isRed ? '#ef4444' : '#3b82f6'; // Red-500 vs Blue-500
              const isSelectedGroup = g.damages.some((d) => d.id === activeDamageId);

              return (
                <g key={`marker-dot-${g.id}`}>
                  {/* Subtle pulsing background if selected */}
                  {isSelectedGroup && (
                    <circle
                      cx={`${g.x}%`}
                      cy={`${g.y}%`}
                      r={10 / zoom} // Scale-Invariant animation circle
                      fill={dotColor}
                      className="opacity-25 animate-ping pointer-events-none"
                    />
                  )}
                  {/* Real point - Small dot pointing to structural flaw */}
                  <circle
                    cx={`${g.x}%`}
                    cy={`${g.y}%`}
                    r={5.5 / zoom} // Scale-Invariant radius
                    fill={dotColor}
                    stroke="#ffffff"
                    strokeWidth={1.5 / zoom}
                    className="cursor-pointer hover:scale-125 transition-transform"
                    id={`dot-${g.id}`}
                  />
                </g>
              );
            })}

            {/* 3. Render HTML labels inside foreignObject with light gray background and red/blue text colors */}
            {allLayoutLabels.map((lbl) => {
              const isRed = getMemberColorClass(lbl.primaryMember) === 'red';
              
              // 텍스트상자 배경: 옅은 회색 적용
              const badgeBg = 'bg-[#f3f4f6]'; // Real light gray background (Tailwind bg-gray-100)
              const badgeBorder = isRed ? 'border-red-400 border-[1.5px] shadow-red-200/50' : 'border-blue-400 border-[1.5px] shadow-blue-200/50';
              const pointColorIndicator = isRed ? 'bg-red-500' : 'bg-blue-500';

              // 텍스트 색상: 벽체/기둥은 적색 (text-red-700), 보/슬래브는 청색 (text-blue-700)
              const textColorClass = isRed ? 'text-red-700' : 'text-blue-700';
              const subTextColorClass = isRed ? 'text-red-800/80 font-medium' : 'text-blue-800/80 font-medium';
              const damageRowBgClass = isRed ? 'hover:bg-red-500/10' : 'hover:bg-blue-500/10';
              const damageRowSelectedBgClass = isRed 
                ? 'bg-red-500/15 border border-red-400/30' 
                : 'bg-blue-500/15 border border-blue-400/30';

              // Determine width and alignment based on custom coordinates or default calculation
              const xPosPct = lbl.boxX;
              const yPosPct = lbl.boxY;
              const dynamicWidthPct = lbl.dynamicWidthPct;

              return (
                <foreignObject
                  key={`label-box-${lbl.id}`}
                  x={`${xPosPct}%`}
                  y={`${yPosPct}%`}
                  width={`${dynamicWidthPct}%`}
                  height={`${120 * sizeScale}`} // scaled dynamic foreignObject height
                  className="overflow-visible pointer-events-auto"
                  onClick={(e) => e.stopPropagation()} // Prevent canvas click trigger
                >
                  <div
                    onMouseDown={(e) => handleMouseDown(e, lbl.id, xPosPct, yPosPct)}
                    className={`flex flex-col gap-0.5 p-1 rounded-md shadow-lg ${badgeBg} ${badgeBorder} select-none transition-all duration-150 text-left cursor-grab active:cursor-grabbing hover:shadow-xl`}
                    style={{
                      fontSize: `${Math.max(7, (10 / zoom) * sizeScale)}px`, // scaled compact font-size
                      transform: `scale(${1 / Math.sqrt(zoom)})`, // Elastic smooth sizing
                      transformOrigin: lbl.side === 'left' ? 'left center' : 'right center',
                      maxHeight: `${100 * sizeScale}px`,
                      opacity: opacity, // Applied adjustable opacity (default 80%)
                    }}
                  >
                    {/* Header showing count & Primary Member */}
                    <div className={`flex items-center justify-between border-b border-black/10 pb-0.5 mb-1 font-mono text-[9px] uppercase tracking-wider ${textColorClass} font-bold`}>
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <span className={`h-1.5 w-1.5 rounded-full ${pointColorIndicator} shrink-0`} />
                        <span className="truncate">{lbl.primaryMember}</span>
                      </div>
                      <span className="text-[10px] font-extrabold shrink-0">
                        ({lbl.damages.length})
                      </span>
                    </div>

                    {/* Stack of Damages inside this coordinate group */}
                    <div className="stop-drag flex flex-col gap-1 overflow-y-auto max-h-[75px] pr-0.5 scrollbar-thin scrollbar-thumb-slate-400">
                      {lbl.damages.map((d) => {
                        const isSelectedDamage = d.id === activeDamageId;
                        return (
                          <div
                            key={d.id}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              onSelectDamage(d.id);
                            }}
                            className={`cursor-pointer px-1 py-0.5 rounded text-[10px] flex flex-col gap-0.5 transition-colors leading-tight ${textColorClass} ${
                              isSelectedDamage
                                ? `${damageRowSelectedBgClass} font-bold`
                                : `${damageRowBgClass}`
                            }`}
                          >
                            <div className="font-bold flex items-center justify-between">
                              <span>No.{d.no} {d.type}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </foreignObject>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Footer tips */}
      <div className="p-2.5 bg-slate-950/60 border-t border-slate-800 text-center">
        <p className="text-[11px] font-sans text-slate-400">
          💡 도면의 결함 지점을 클릭하면 지시선과 라벨이 생성됩니다. 1.5% 반경 이내를 클릭하면 동일 지점에 손상이 병합축척 겹침 없이 리스트업됩니다.
        </p>
      </div>
    </div>
  );
};
