/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Damage, MemberType, getMemberColorClass } from '../types';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface DrawingCanvasProps {
  damages: Damage[];
  onAddMarker: (x: number, y: number) => void;
  drawingUrl: string | null;
  activeDamageId: string | null;
  onSelectDamage: (id: string) => void;
}

interface GroupedPoints {
  id: string; // Coordinate string e.g., "50.5-42.3"
  x: number;  // original percentage
  y: number;  // original percentage
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

  // 1. Group damages by location (Snap within 1.5% radius)
  const groupDamages = (): GroupedPoints[] => {
    const groups: GroupedPoints[] = [];
    const threshold = 1.6; // 1.5% - 1.6% radius

    // Filter damages with active markers
    const markedDamages = damages.filter((d) => d.marker !== null);

    markedDamages.forEach((damage) => {
      if (!damage.marker) return;
      
      // Look for any existing close group
      let joined = false;
      for (const g of groups) {
        const dx = g.x - damage.marker.x;
        const dy = g.y - damage.marker.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist <= threshold) {
          g.damages.push(damage);
          // Auto group coordinates should align
          joined = true;
          break;
        }
      }

      if (!joined) {
        groups.push({
          id: `${damage.marker.x.toFixed(2)}-${damage.marker.y.toFixed(2)}`,
          x: damage.marker.x,
          y: damage.marker.y,
          damages: [damage],
          primaryMember: damage.member,
        });
      }
    });

    return groups;
  };

  const defectGroups = groupDamages();

  // 2. Perform Y-collision avoidance algorithm to layout labels on left/right side columns neatly
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

    const minGap = 7; // Minimal separation between adjacent box centers in percent (0-100)

    // Push down pass (Forward)
    const resolveOverlapForward = (col: typeof groups) => {
      for (let i = 1; i < col.length; i++) {
        const prev = col[i - 1];
        const curr = col[i];
        if (curr.y < prev.y + minGap) {
          curr.y = prev.y + minGap;
        }
      }
    };

    // Push up pass (Backward) to prevent running below 100%
    const resolveOverlapBackward = (col: typeof groups) => {
      for (let i = col.length - 2; i >= 0; i--) {
        const next = col[i + 1];
        const curr = col[i];
        if (curr.y > next.y - minGap) {
          curr.y = next.y - minGap;
        }
      }
    };

    resolveOverlapForward(leftColumn);
    resolveOverlapBackward(leftColumn);

    resolveOverlapForward(rightColumn);
    resolveOverlapBackward(rightColumn);

    return {
      leftLayout: leftColumn,
      rightLayout: rightColumn,
    };
  };

  const { leftLayout, rightLayout } = layoutLabels(defectGroups);

  // Helper to map layout elements
  const allLayoutLabels = [
    ...leftLayout.map((g) => ({ ...g, side: 'left' as const, targetX: 6 })),
    ...rightLayout.map((g) => ({ ...g, side: 'right' as const, targetX: 94 })),
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
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-100 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 rounded-lg transition-colors border border-slate-600"
            title="확대 Zoom In"
          >
            <ZoomIn className="h-3.5 w-3.5" />
            확대
          </button>
          <button
            onClick={handleZoomOut}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-100 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 rounded-lg transition-colors border border-slate-600"
            title="축소 Zoom Out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
            축소
          </button>
          <button
            onClick={handleZoomReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
            title="초기화 Reset"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {Math.round(zoom * 100)}%
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
            {/* 1. Render pointer lines & 3-step elbows connecting labels to markers */}
            {allLayoutLabels.map((lbl) => {
              const markerX_pixel = (lbl.x / 100) * containerSize.width;
              const markerY_pixel = (lbl.y / 100) * containerSize.height;

              // Find where the marker is mapped (percentage to pixels)
              const mX = lbl.x;
              const mY = lbl.y;

              // Target layout coordinates
              const tX = lbl.targetX;
              const tY = lbl.y; // adjusted vertical spot

              // Decide horizontal elbow hinge offset based on side
              const elbowX = lbl.side === 'left' ? tX + 11 : tX - 11;

              const isRed = getMemberColorClass(lbl.primaryMember) === 'red';
              const strokeColor = isRed ? '#f87171' : '#60a5fa'; // Light-Red vs Light-Blue

              return (
                <g key={`line-${lbl.id}`} className="pointer-events-none">
                  {/* Thin elegant joint pointer line */}
                  <polyline
                    points={`${mX}%,${mY}% ${elbowX}%,${tY}% ${tX}%,${tY}%`}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={1.0 / zoom} // Scale-Invariant stroke width!
                    strokeDasharray="1.5,1.5"
                    className="opacity-75"
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

            {/* 3. Render HTML labels inside foreignObject to accommodate styled text stack */}
            {allLayoutLabels.map((lbl) => {
              const isRed = getMemberColorClass(lbl.primaryMember) === 'red';
              const badgeBg = isRed ? 'bg-red-500/10' : 'bg-blue-500/10';
              const badgeBorder = isRed ? 'border-red-500/40 text-red-100' : 'border-blue-500/40 text-blue-100';
              const pointColorIndicator = isRed ? 'bg-red-500' : 'bg-blue-500';

              // Determine width and alignment based on Left or Right column
              const widthPct = 22; // Width of foreignObject box in percent
              const boxHeightPct = 10;
              const xPosPct = lbl.side === 'left' ? 1.5 : 100 - widthPct - 1.5;
              const yPosPct = lbl.y - 4.5; // Offset half label height to center vertically

              return (
                <foreignObject
                  key={`label-box-${lbl.id}`}
                  x={`${xPosPct}%`}
                  y={`${yPosPct}%`}
                  width={`${widthPct}%`}
                  height="120" // fixed height container allowing text scroll/wrap without cutoff
                  className="overflow-visible pointer-events-auto"
                >
                  <div
                    className={`flex flex-col gap-1 p-2 border rounded-md shadow-lg ${badgeBg} ${badgeBorder} backdrop-blur-sm select-none transition-all duration-150 text-left`}
                    style={{
                      fontSize: `${Math.max(9, 11 / zoom)}px`, // Compensate font slightly
                      transform: `scale(${1 / Math.sqrt(zoom)})`, // Elastic smooth sizing
                      transformOrigin: lbl.side === 'left' ? 'left center' : 'right center',
                      maxHeight: '110px',
                    }}
                  >
                    {/* Header showing count & Primary Member */}
                    <div className="flex items-center justify-between border-b border-white/10 pb-1 mb-1 font-mono text-[9px] uppercase tracking-wider text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${pointColorIndicator}`} />
                        <span>{lbl.primaryMember}</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-300">
                        ({lbl.damages.length})
                      </span>
                    </div>

                    {/* Stack of Damages inside this coordinate group */}
                    <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[85px] pr-0.5 scrollbar-thin scrollbar-thumb-slate-700">
                      {lbl.damages.map((d) => {
                        const isSelectedDamage = d.id === activeDamageId;
                        return (
                          <div
                            key={d.id}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              onSelectDamage(d.id);
                            }}
                            className={`cursor-pointer px-1 py-0.5 rounded text-[10px] flex flex-col gap-0.5 hover:bg-white/10 transition-colors leading-tight ${
                              isSelectedDamage
                                ? 'bg-white/20 font-bold ring-1 ring-white/30'
                                : ''
                            }`}
                          >
                            <div className="font-semibold flex items-center justify-between">
                              <span>No.{d.no} {d.type}</span>
                              <span className="text-[9px] opacity-75">{d.floor}</span>
                            </div>
                            <div className="text-[9px] text-slate-300 font-mono truncate">
                              {d.type.includes('균열') 
                                ? `${d.widthVal.toFixed(1)}mm x ${d.lengthVal.toFixed(1)}m`
                                : `${d.widthVal.toFixed(1)}x${d.lengthVal.toFixed(1)}m` + (d.areaVal ? ` (${d.areaVal.toFixed(1)}㎡)` : '')
                              }
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
