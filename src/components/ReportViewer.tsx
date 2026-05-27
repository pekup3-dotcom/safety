/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Project, Damage, getMemberColorClass } from '../types';
import { Printer, Eye, X, Download, FileSpreadsheet } from 'lucide-react';

interface ReportViewerProps {
  project: Project;
  onClose: () => void;
}

export const ReportViewer: React.FC<ReportViewerProps> = ({ project, onClose }) => {
  const { damages } = project;

  // Dynamic Quantity Aggregation Calculation
  const getDamageAggregations = (items: Damage[]) => {
    const map: Record<string, { count: number; total: number; unit: string }> = {};
    items.forEach((d) => {
      const isCrack = ['균열', '습식균열', '조적균열', '이질마감재 균열'].includes(d.type);
      const unit = isCrack ? 'm' : '㎡';
      const val = isCrack ? d.lengthVal : (d.areaVal ?? (d.widthVal * d.lengthVal));

      const groupKey = (d.type === '균열' || d.type === '습식균열')
        ? `${d.type} (폭 ${d.widthVal}mm)`
        : d.type;

      if (!map[groupKey]) {
        map[groupKey] = { count: 0, total: 0, unit };
      }
      map[groupKey].count += 1;
      map[groupKey].total += val;
    });

    return Object.entries(map).map(([type, data]) => ({
      type,
      count: data.count,
      total: data.total,
      unit: data.unit,
    })).sort((a, b) => a.type.localeCompare(b.type));
  };

  const damageAggregations = getDamageAggregations(damages);

  // Exact same grouping and layout calculation as in DrawingCanvas for perfect fidelity
  const { allLayoutLabels, defectGroups } = React.useMemo(() => {
    const threshold = 1.6;
    const markedDamages = damages.filter((d) => d.marker !== null);
    const groups: any[] = [];

    markedDamages.forEach((damage) => {
      if (!damage.marker) return;
      let joined = false;
      for (const g of groups) {
        const dx = g.x - damage.marker.x;
        const dy = g.y - damage.marker.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
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

    const leftColumn: any[] = [];
    const rightColumn: any[] = [];
    groups.forEach((g) => {
      if (g.x < 50) {
        leftColumn.push({ ...g });
      } else {
        rightColumn.push({ ...g });
      }
    });

    leftColumn.sort((a, b) => a.y - b.y);
    rightColumn.sort((a, b) => a.y - b.y);

    const sizeScale = 0.55;
    const minGap = Math.max(3.5, 11 * sizeScale);

    // Push forward
    for (let i = 1; i < leftColumn.length; i++) {
      if (leftColumn[i].layoutY < leftColumn[i - 1].layoutY + minGap) {
        leftColumn[i].layoutY = leftColumn[i - 1].layoutY + minGap;
      }
    }
    // Push backward
    for (let i = leftColumn.length - 2; i >= 0; i--) {
      if (leftColumn[i].layoutY > leftColumn[i + 1].layoutY - minGap) {
        leftColumn[i].layoutY = leftColumn[i + 1].layoutY - minGap;
      }
    }

    // Push forward
    for (let i = 1; i < rightColumn.length; i++) {
      if (rightColumn[i].layoutY < rightColumn[i - 1].layoutY + minGap) {
        rightColumn[i].layoutY = rightColumn[i - 1].layoutY + minGap;
      }
    }
    // Push backward
    for (let i = rightColumn.length - 2; i >= 0; i--) {
      if (rightColumn[i].layoutY > rightColumn[i + 1].layoutY - minGap) {
        rightColumn[i].layoutY = rightColumn[i + 1].layoutY - minGap;
      }
    }

    leftColumn.forEach((g) => {
      if (g.layoutY < 5) g.layoutY = 5;
      if (g.layoutY > 95) g.layoutY = 95;
    });
    rightColumn.forEach((g) => {
      if (g.layoutY < 5) g.layoutY = 5;
      if (g.layoutY > 95) g.layoutY = 95;
    });

    const widthPct = 16.5 * 0.95;

    const leftCalculated = leftColumn.map((g) => {
      const dynamicWidthPct = widthPct * sizeScale;
      const boxX = 1.0;
      const boxY = g.layoutY - (5.0 * sizeScale);
      const side = g.x > boxX + dynamicWidthPct / 2 ? 'left' as const : 'right' as const;
      const attachX = side === 'left' ? boxX + dynamicWidthPct : boxX;
      const attachY = boxY + (5.0 * sizeScale);
      return { ...g, boxX, boxY, side, attachX, attachY, dynamicWidthPct };
    });

    const rightCalculated = rightColumn.map((g) => {
      const dynamicWidthPct = widthPct * sizeScale;
      const boxX = 100 - dynamicWidthPct - 1.0;
      const boxY = g.layoutY - (5.0 * sizeScale);
      const side = g.x > boxX + dynamicWidthPct / 2 ? 'left' as const : 'right' as const;
      const attachX = side === 'left' ? boxX + dynamicWidthPct : boxX;
      const attachY = boxY + (5.0 * sizeScale);
      return { ...g, boxX, boxY, side, attachX, attachY, dynamicWidthPct };
    });

    const leftSideConns = [...leftCalculated];
    const rightSideConns = [...rightCalculated];
    leftSideConns.sort((a, b) => a.x - b.x);
    rightSideConns.sort((a, b) => b.x - a.x);

    const allLayoutLabels = [
      ...leftSideConns.map((c, i) => ({ ...c, laneIndex: i })),
      ...rightSideConns.map((c, i) => ({ ...c, laneIndex: i })),
    ];

    return { allLayoutLabels, defectGroups: groups };
  }, [damages]);

  // Split damages into chunks of 6 for the 6-split photo sheets
  const chunkDamagesForPhotos = (items: Damage[], size: number): Damage[][] => {
    const result: Damage[][] = [];
    for (let i = 0; i < items.length; i += size) {
      result.push(items.slice(i, i + size));
    }
    return result;
  };

  // Filter only damages that have photos occupied for the photos sheet pages
  const damagesWithPhotos = damages.filter(d => d.photoUrls && d.photoUrls.length > 0);
  const photoPages = chunkDamagesForPhotos(damagesWithPhotos, 6);

  const handlePrintTrigger = () => {
    window.print();
  };

  const handleDownloadCSV = () => {
    try {
      const BOM = "\uFEFF";
      const headers = ["연번", "시설물명", "위치(층/부재)", "결함종류", "규격 폭(mm) / 가로(m)", "길이(m)", "집계물량수치", "손상 대분류 원인"];
      const rows = damages.map((d) => {
        const isCrack = ['균열', '습식균열', '조적균열', '이질마감재 균열'].includes(d.type);
        const dimensionVal = isCrack ? `${d.widthVal} mm` : `${d.widthVal} m`;
        const metricVal = isCrack ? `${d.lengthVal} m` : `${(d.areaVal ?? (d.widthVal * d.lengthVal)).toFixed(2)} ㎡`;
        const causeStr = d.cause === '기타 직접입력' ? (d.customCause || '직접 기입') : d.cause;
        return [
          `No.${d.no}`,
          d.facility || project.name,
          `${d.floor} / ${d.member}`,
          d.type,
          dimensionVal,
          d.lengthVal,
          metricVal,
          causeStr
        ];
      });

      const csvContent = BOM + [headers.join(","), ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${project.name}_손상현황종합대장.csv`);
      link.setAttribute("target", "_blank");
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 150);
    } catch (e) {
      alert("CSV 다운로드 처리 중 실패가 발생했습니다.");
    }
  };

  const handleDownloadHtml = () => {
    try {
      const title = `${project.name} 안전점검 종합보고서`;
      
      const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @media print {
      .no-print { display: none !important; }
      body { background: white; color: black; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .print-page { page-break-after: always; padding: 15mm 10mm; margin: 0; border: none; box-shadow: none; border-radius: 0; min-height: auto; }
      
      /* Rotated drawing print page styling */
      .rotated-drawing-page {
        width: 210mm;
        height: 297mm;
        page-break-after: always;
        position: relative;
        box-sizing: border-box;
        padding: 10mm !important;
        margin: 0;
        border: none;
        box-shadow: none;
        border-radius: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background-color: #ffffff;
      }
      .rotated-canvas-wrapper {
        transform: rotate(-90deg) !important;
        transform-origin: center center !important;
        width: 277mm !important;
        height: 190mm !important;
        position: absolute !important;
        left: 50% !important;
        top: 50% !important;
        margin-left: -138.5mm !important;
        margin-top: -95mm !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: space-between !important;
        box-sizing: border-box !important;
        border: 2px solid #000000 !important;
        padding: 5mm !important;
        background-color: #ffffff !important;
        border-radius: 0 !important;
      }
    }
    body { font-family: system-ui, -apple-system, sans-serif; background-color: #f1f5f9; color: #0f172a; margin: 0; padding: 0; }
    .print-page { background: white; max-width: 210mm; min-height: 297mm; margin: 30px auto; padding: 20mm 15mm; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; border-radius: 12px; box-sizing: border-box; }
    
    /* Screen styling of rotated drawing page in HTML download */
    .rotated-drawing-page {
      background: white; 
      max-width: 210mm; 
      min-height: 297mm; 
      margin: 30px auto; 
      padding: 20mm 15mm; 
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); 
      border: 1px solid #e2e8f0; 
      border-radius: 12px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .rotated-canvas-wrapper {
      width: 100%;
      height: 145mm;
      position: relative;
      box-sizing: border-box;
      border: 1px dashed #cbd5e1;
      padding: 4px;
      background-color: #fafbfc;
      border-radius: 6px;
    }

    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; text-align: center; }
    th { background-color: #f8fafc; font-weight: bold; border: 1px solid #cbd5e1; padding: 10px 8px; font-size: 11px; }
    td { border: 1px solid #cbd5e1; padding: 8px; font-size: 11px; color: #334155; }
    h1, h2, h3 { color: #0f172a; }
  </style>
</head>
<body>
  <div class="no-print bg-slate-900 border-b border-slate-800 text-white p-4 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-lg sticky top-0 z-50">
    <div>
      <h1 class="text-sm font-bold text-emerald-400 m-0 leading-tight">${title}</h1>
      <p class="text-[10px] text-slate-400 m-0 mt-0.5">※ 무선 환경 다운로드 및 모바일 / 태블릿 / PC 겸용 독립형 보고서</p>
    </div>
    <div class="flex gap-2">
      <button onclick="window.print()" class="bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-extrabold px-3 py-1.5 rounded text-xs transition-colors cursor-pointer">
        PDF 파일로 저장 / 인쇄하기
      </button>
    </div>
  </div>

  <!-- A4 PAGE 1: DRAWINGS -->
  <div class="rotated-drawing-page">
    <div class="no-print" style="text-align: center; width: 100%;">
      <h1 class="text-2xl font-extrabold text-slate-900 border-b-2 border-slate-900 pb-2 mb-1 tracking-tight">
        결함위치도 (Drawing Plan Map)
      </h1>
      <p class="text-[10px] text-slate-500 mb-4 font-mono">
        [아래 도표 영역은 가로 도곽 레이아웃으로서 실제 인쇄 시 -90도 회전되어 A4용지에 꽉차게 출력됩니다]
      </p>
    </div>

    <div class="rotated-canvas-wrapper">
      <div style="position: relative; width: 100%; height: 100%; overflow: hidden; border-radius: 4px; border: 1px solid #e2e8f0; background-color: #0f172a;">
        ${project.drawingUrl ? `
          <img src="${project.drawingUrl}" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; pointer-events: none;" />
        ` : `
          <div style="position: absolute; inset: 0; width: 100%; height: 100%; background-color: #111622; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; color: #94a3b8;">
            등록된 도면이 없음 (격자 자동생성)
          </div>
        `}
        
        <svg style="position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none;" xmlns="http://www.w3.org/2000/svg">
          ${allLayoutLabels.map((lbl) => {
            const mX = lbl.x;
            const mY = lbl.y;
            const tX = lbl.attachX;
            const tY = lbl.attachY;
            const laneIndex = lbl.laneIndex ?? 0;
            const markerColor = getMemberColorClass(lbl.primaryMember) === 'red' ? '#ef4444' : '#3b82f6';
            const sizeScale = 0.55;
            let elbowX = lbl.side === 'left' 
              ? tX + (2.0 + laneIndex * 1.2) * sizeScale 
              : tX - (2.0 + laneIndex * 1.2) * sizeScale;

            if (lbl.side === 'left') {
              if (elbowX > mX - 1.5) elbowX = Math.max(tX + 0.5, (tX + mX) / 2);
            } else {
              if (elbowX < mX + 1.5) elbowX = Math.min(tX - 0.5, (tX + mX) / 2);
            }

            return `
              <g opacity="0.9">
                <line x1="${mX}%" y1="${mY}%" x2="${elbowX}%" y2="${mY}%" stroke="${markerColor}" stroke-width="1.3" stroke-dasharray="2,2" />
                <line x1="${elbowX}%" y1="${mY}%" x2="${elbowX}%" y2="${tY}%" stroke="${markerColor}" stroke-width="1.3" stroke-dasharray="2,2" />
                <line x1="${elbowX}%" y1="${tY}%" x2="${tX}%" y2="${tY}%" stroke="${markerColor}" stroke-width="1.6" />
              </g>
            `;
          }).join('\n')}

          ${defectGroups.map((g) => {
            const dotColor = getMemberColorClass(g.primaryMember) === 'red' ? '#ef4444' : '#3b82f6';
            return `
              <circle cx="${g.x}%" cy="${g.y}%" r="5" fill="${dotColor}" stroke="#ffffff" stroke-width="1.3" />
            `;
          }).join('\n')}
        </svg>

        ${allLayoutLabels.map((lbl) => {
          const isRed = getMemberColorClass(lbl.primaryMember) === 'red';
          const badgeBg = '#f3f4f6';
          const badgeBorderColor = isRed ? '#f87171' : '#60a5fa';
          const textColor = isRed ? '#b91c1c' : '#1d4ed8';

          return `
            <div style="
              position: absolute;
              left: ${lbl.boxX}%;
              top: ${lbl.boxY}%;
              width: ${lbl.dynamicWidthPct}%;
              background-color: ${badgeBg};
              border: 1.5px solid ${badgeBorderColor};
              border-radius: 4px;
              padding: 3px;
              box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
              color: ${textColor};
              font-family: sans-serif;
              font-size: 7.5px;
              line-height: 1.25;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              gap: 2px;
              max-height: ${100 * 0.55}px;
              overflow: hidden;
              text-align: left;
            ">
              <div style="
                font-weight: bold;
                display: flex;
                justify-content: space-between;
                border-bottom: 1px solid rgba(0,0,0,0.08);
                padding-bottom: 2px;
                margin-bottom: 2px;
                font-size: 7.5px;
               border-color: rgba(0,0,0,0.1);
              ">
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${lbl.primaryMember}</span>
                <span style="font-weight: 800;">(${lbl.damages.length})</span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 1px;">
                ${lbl.damages.map((d) => `
                  <div style="font-weight: bold; font-size: 7px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    No.${d.no} ${d.type}
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }).join('\n')}
      </div>
    </div>

    <div style="margin-top: 15px; width: 100%;">
      <h3 class="text-xs font-bold text-slate-700 mb-2 text-left">■ 구조물 정보 및 표제란 (Cover Summary)</h3>
      <table>
        <tbody>
          <tr>
            <th style="width: 20%;">점검대상 시설명</th>
            <td style="width: 30%; font-weight: bold;">${project.name}</td>
            <th style="width: 20%;">도면명</th>
            <td style="width: 30%; font-weight: bold;">${project.drawingName || '표준 기본 도면'}</td>
          </tr>
          <tr>
            <th>공학적 점검업체</th>
            <td>${project.inspectionCompany}</td>
            <th>점검완료일자</th>
            <td>${new Date().toLocaleDateString()}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- A4 PAGE 2: TOTAL AGGREGATION & TABLE -->
  <div class="print-page">
    <div class="text-center border-b-2 border-slate-900 pb-2.5 mb-6">
      <h1 class="text-2xl font-extrabold text-slate-900" style="margin: 0; font-size: 24px;">
        시설물 손상현황 종합 테이블 집계표
      </h1>
      <p style="font-size: 13px; color: #334155; margin: 4px 0 0 0; font-weight: bold;">
        대상 시설물명 : ${project.name}
      </p>
    </div>

    <div class="mb-8 text-left">
      <h3 class="text-xs font-bold text-slate-900 mb-2 border-l-4 border-slate-900 pl-2">
        [총괄집계] 손상 유형별 누적 물량표
      </h3>
      <table>
        <thead>
          <tr>
            <th style="width: 40%;">손상 대분류</th>
            <th style="width: 30%;">결함 개소 수</th>
            <th style="width: 30%;">집계 누적 물량</th>
          </tr>
        </thead>
        <tbody>
          ${damageAggregations.map(agg => `
            <tr>
              <td style="font-weight: 600;">${agg.type}</td>
              <td style="font-family: monospace;">${agg.count} 개소</td>
              <td style="font-family: monospace; font-weight: bold; color: #10b981;">
                ${agg.total.toFixed(2)} ${agg.unit}
              </td>
            </tr>
          `).join('')}
          ${damageAggregations.length === 0 ? '<tr><td colspan="3" style="color: #94a3b8;">측정된 손상 데이터가 존재하지 않습니다.</td></tr>' : ''}
        </tbody>
      </table>
    </div>

    <div class="text-left">
      <h3 class="text-xs font-bold text-slate-900 mb-2 border-l-4 border-slate-900 pl-2">
        [상세내역] 손상현황 상세 조사 대장
      </h3>
      <table>
        <thead>
          <tr>
            <th style="width: 10%;">번호</th>
            <th style="width: 20%;">시설명</th>
            <th style="width: 20%;">기록층 / 부재</th>
            <th style="width: 30%;">결함 수치치수</th>
            <th style="width: 20%;">추정원인</th>
          </tr>
        </thead>
        <tbody>
          ${damages.map(d => `
            <tr>
              <td style="font-weight: bold; font-family: monospace;">No.${d.no}</td>
              <td>${d.facility || project.name}</td>
              <td style="font-weight: 500;">${d.floor} / ${d.member}</td>
              <td style="text-align: left; padding-left: 10px;">
                <span style="font-weight: bold; color: #4f46e5;">${d.type}</span>
                <span style="font-size: 10px; color: #64748b; font-family: monospace; margin-left: 4px;">
                  (${['균열', '습식균열', '조적균열', '이질마감재 균열'].includes(d.type)
                    ? `W:${d.widthVal}mm / L:${d.lengthVal}m`
                    : `A:${d.areaVal ?? (d.widthVal * d.lengthVal).toFixed(2)}㎡ (가로:${d.widthVal}m / L:${d.lengthVal}m)`
                  })
                </span>
              </td>
              <td style="font-size: 10px;">${d.cause === '기타 직접입력' ? (d.customCause || '기타 입력') : d.cause}</td>
            </tr>
          `).join('')}
          ${damages.length === 0 ? '<tr><td colspan="5" style="color: #94a3b8;">등록된 결함 목록이 없습니다.</td></tr>' : ''}
        </tbody>
      </table>
    </div>
  </div>

  <!-- A4 PAGE 3+: PHOTO DOCUMENTS -->
  ${chunkDamagesForPhotos(damages.filter(d => d.photoUrls && d.photoUrls.length > 0), 6).map((group, pageIndex) => `
    <div class="print-page">
      <div class="text-center mb-6 border-b-2 border-slate-300 pb-2">
        <h1 class="text-xl font-extrabold text-slate-900">
          손상조사 현장 사진대지 (Photo Documents - Page ${pageIndex + 1})
        </h1>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px;">
        ${group.map(d => `
          <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; background-color: #f8fafc; display: flex; flex-direction: column;">
            <div style="height: 45mm; background-color: #e2e8f0; border-radius: 6px; overflow: hidden; display: flex; justify-content: center; items-center;">
              ${d.photoUrls && d.photoUrls[0] ? `<img src="${d.photoUrls[0]}" style="max-height: 100%; max-width: 100%; object-fit: contain;" />` : '<span style="color: #94a3b8; font-size: 11px;">등록된 이미지 없음</span>'}
            </div>
            <div style="margin-top: 8px; font-size: 10px; line-height: 1.4;">
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 4px;">
                <span style="font-weight: bold; color: #1e1b4b;">No.${d.no} [${d.type}]</span>
                <span style="color: #4f46e5; font-weight: 500;">${d.floor} / ${d.member}</span>
              </div>
              <div><strong>추정원인:</strong> ${d.cause === '기타 직접입력' ? (d.customCause || '') : d.cause}</div>
              <div><strong>정량화 규모:</strong> ${['균열', '습식균열', '조적균열', '이질마감재 균열'].includes(d.type) ? `폭 ${d.widthVal} mm / 길이 ${d.lengthVal} m` : `가로 ${d.widthVal} m / 세로 ${d.lengthVal} m (면적: ${d.areaVal ?? (d.widthVal * d.lengthVal).toFixed(2)} ㎡)`}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('')}
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${project.name}_안전점검_종합보고서.html`);
      link.setAttribute("target", "_blank");
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 150);
    } catch (e) {
      alert("HTML 파일 저장 기능 중 문제가 발생했습니다.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/90 py-6 px-4 flex flex-col items-center">
      {/* Dynamic Report Controls header on screen */}
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 flex items-center justify-between shadow-2xl no-print">
        <div className="hidden md:block">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Eye className="h-4.5 w-4.5 text-emerald-400" />
            정밀 A4 보고서 및 사진대지 미리보기
          </h2>
          <p className="text-[10px] text-slate-400 mt-0.5">
            아래 레이아웃이 실제 A4 규격 형태로 출력 및 장치 저장됩니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
          <button
            onClick={handleDownloadHtml}
            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 transition-colors cursor-pointer"
            title="인터넷 차단 시에도 바로 보고 인쇄가 가능한 단독형 보고서 파일을 모바일, 태블릿, PC로 저장합니다"
          >
            <Download className="h-3.5 w-3.5" />
            HTML 보고서 저장
          </button>
          <button
            onClick={handleDownloadCSV}
            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-lg text-white bg-sky-600 hover:bg-sky-500 transition-colors cursor-pointer"
            title="Excel에서 바로 가공이 가능한 CSV 명세를 다운로드합니다"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            엑셀·CSV 대장 저장
          </button>
          <button
            onClick={handlePrintTrigger}
            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-lg text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-colors cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            A4 인쇄 (PDF 저장)
          </button>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* RENDER FOR SEAMLESS PRINT LAYOUTS */}
      <div className="w-full flex flex-col items-center gap-8 no-print overflow-y-auto max-h-[80vh] px-2">
        <p className="text-xs text-slate-500 font-mono italic">
          ※ 실제 규격 인쇄 레이아웃 미리뷰 (인쇄 시 배경색 등은 프린터 기본 설정에 맞춰 인쇄할 수 있습니다)
        </p>
        
        {/* Scrollable Previews on Screen */}
        <div className="print-preview-container bg-white text-slate-900 shadow-2xl w-[210mm] min-h-[297mm] p-[15mm] flex flex-col justify-between border border-slate-200">
          <div className="flex-1 flex flex-col justify-center items-center">
            <div className="text-center">
              <h1 className="text-2xl font-extrabold tracking-tight border-b-2 border-slate-900 pb-2 mb-4">
                결함위치도
              </h1>
              <span className="text-xs text-slate-500 font-mono">
                [아래 표기 영역은 가로 도곽 레이아웃으로서 실제 인쇄 시 -90도 회전되어 풀사이즈로 매핑됩니다]
              </span>
            </div>

            {/* Rotated drawing box mock container */}
            <div className="mt-8 border border-slate-300 rounded bg-[#0f172a] w-full max-w-2xl aspect-[16/11] relative overflow-hidden shadow-inner flex items-center justify-center">
              {project.drawingUrl ? (
                <img
                  src={project.drawingUrl}
                  alt="drawing preview"
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="absolute inset-0 w-full h-full bg-[#111622] flex items-center justify-center text-xs text-slate-500 font-bold">
                  등록된 도면이 없습니다. (격자 자동생성)
                </div>
              )}
              
              {/* SVG Overlay containing connectors and indicator dots */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {allLayoutLabels.map((lbl) => {
                  const mX = lbl.x;
                  const mY = lbl.y;
                  const tX = lbl.attachX;
                  const tY = lbl.attachY;
                  const laneIndex = lbl.laneIndex ?? 0;
                  const isRed = getMemberColorClass(lbl.primaryMember) === 'red';
                  const strokeColor = isRed ? '#ef4444' : '#3b82f6';
                  const sizeScale = 0.55;

                  let elbowX = lbl.side === 'left' 
                    ? tX + (2.0 + laneIndex * 1.2) * sizeScale 
                    : tX - (2.0 + laneIndex * 1.2) * sizeScale;

                  if (lbl.side === 'left') {
                    if (elbowX > mX - 1.5) elbowX = Math.max(tX + 0.5, (tX + mX) / 2);
                  } else {
                    if (elbowX < mX + 1.5) elbowX = Math.min(tX - 0.5, (tX + mX) / 2);
                  }

                  return (
                    <g key={`screen-conn-${lbl.id}`} className="opacity-90">
                      <line x1={`${mX}%`} y1={`${mY}%`} x2={`${elbowX}%`} y2={`${mY}%`} stroke={strokeColor} strokeWidth="1.2" strokeDasharray="1.5,1.5" />
                      <line x1={`${elbowX}%`} y1={`${mY}%`} x2={`${elbowX}%`} y2={`${tY}%`} stroke={strokeColor} strokeWidth="1.2" strokeDasharray="1.5,1.5" />
                      <line x1={`${elbowX}%`} y1={`${tY}%`} x2={`${tX}%`} y2={`${tY}%`} stroke={strokeColor} strokeWidth="1.6" />
                    </g>
                  );
                })}

                {defectGroups.map((g) => {
                  const isRed = getMemberColorClass(g.primaryMember) === 'red';
                  const dotColor = isRed ? '#ef4444' : '#3b82f6';
                  return (
                    <circle
                      key={`screen-dot-${g.id}`}
                      cx={`${g.x}%`}
                      cy={`${g.y}%`}
                      r="4.5"
                      fill={dotColor}
                      stroke="#ffffff"
                      strokeWidth="1.2"
                    />
                  );
                })}
              </svg>

              {/* Absolute Div overlays (Immune to rotation/size-warp bugs!) */}
              {allLayoutLabels.map((lbl) => {
                const isRed = getMemberColorClass(lbl.primaryMember) === 'red';
                const badgeBg = 'bg-[#f3f4f6]';
                const badgeBorder = isRed ? 'border-red-400 border-[1px]' : 'border-blue-400 border-[1px]';
                const textColorClass = isRed ? 'text-red-700' : 'text-blue-700';

                return (
                  <div
                    key={`screen-label-div-${lbl.id}`}
                    className={`absolute flex flex-col gap-0.5 p-1 rounded border shadow-sm ${badgeBg} ${badgeBorder} text-[7.5px] leading-tight text-left pointer-events-none`}
                    style={{
                      left: `${lbl.boxX}%`,
                      top: `${lbl.boxY}%`,
                      width: `${lbl.dynamicWidthPct}%`,
                      maxHeight: `${100 * 0.55}px`,
                      boxSizing: 'border-box',
                    }}
                  >
                    <div className={`flex items-center justify-between border-b border-black/10 pb-0.5 mb-1 text-[7px] font-bold ${textColorClass}`}>
                      <span className="truncate">{lbl.primaryMember}</span>
                      <span className="text-[7.5px] font-extrabold">({lbl.damages.length})</span>
                    </div>
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      {lbl.damages.map((d) => (
                        <div key={d.id} className={`text-[6.5px] font-bold truncate ${textColorClass}`}>
                          No.{d.no} {d.type}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mock horizontal title block */}
            <table className="w-full mt-10 border-collapse border-2 border-slate-900 text-xs text-center font-sans">
              <tbody>
                <tr>
                  <td className="border border-slate-900 bg-slate-100 font-bold p-1.5 w-[20%]">시설물명</td>
                  <td className="border border-slate-900 p-1.5 w-[30%]">{project.name}</td>
                  <td className="border border-slate-900 bg-slate-100 font-bold p-1.5 w-[20%]">도면명</td>
                  <td className="border border-slate-900 p-1.5 w-[30%]">{project.drawingName || '표준 기본 도면'}</td>
                </tr>
                <tr>
                  <td className="border border-slate-900 bg-slate-100 font-bold p-1.5">점검업체명</td>
                  <td className="border border-slate-900 p-1.5">{project.inspectionCompany}</td>
                  <td className="border border-slate-900 bg-slate-100 font-bold p-1.5">점검일시</td>
                  <td className="border border-slate-900 p-1.5">{new Date().toLocaleDateString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Index table Preview on Screen */}
        <div className="bg-white text-slate-900 shadow-2xl w-[210mm] min-h-[297mm] p-[15mm] flex flex-col border border-slate-200">
          <div className="text-center border-b border-slate-800 pb-4 mb-6">
            <h2 className="text-xl font-extrabold text-slate-900">
              손상현황 종합 총괄표
            </h2>
            <p className="text-sm text-slate-600 mt-1 font-medium">
              대상 시설물명 : {project.name}
            </p>
          </div>

          {/* 물량 집계 요약 대장 */}
          <div className="mb-6 text-left">
            <h3 className="text-xs font-bold text-slate-900 mb-2 border-l-4 border-slate-900 pl-2">
              [집계] 손상 유형별 집계 물량표
            </h3>
            <table className="w-full border-collapse border border-slate-800 text-[10px] text-center">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-800 p-1.5 font-bold w-[40%]">손상 대분류</th>
                  <th className="border border-slate-800 p-1.5 font-bold w-[30%]">결함 개소 수</th>
                  <th className="border border-slate-800 p-1.5 font-bold w-[30%]">집계 누적 물량</th>
                </tr>
              </thead>
              <tbody>
                {damageAggregations.map((agg) => (
                  <tr key={agg.type} className="hover:bg-slate-50">
                    <td className="border border-slate-800 p-1.5 font-medium">{agg.type}</td>
                    <td className="border border-slate-800 p-1.5 font-mono">{agg.count} 개소</td>
                    <td className="border border-slate-800 p-1.5 font-mono font-bold">
                      {agg.total.toFixed(2)} {agg.unit}
                    </td>
                  </tr>
                ))}
                {damageAggregations.length === 0 && (
                  <tr>
                    <td colSpan={3} className="border border-slate-800 p-3 text-center text-slate-400">
                      등록된 손상 측정 데이터가 존재하지 않습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <h3 className="text-xs font-bold text-slate-900 mb-2 border-l-4 border-slate-900 pl-2 text-left">
            [내역] 손상현황 세부 조사 대장
          </h3>
          <table className="w-full border-collapse border border-slate-800 text-xs text-center">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-800 p-2 font-bold w-[8%]">No.</th>
                <th className="border border-slate-800 p-2 font-bold w-[20%]">시설물명</th>
                <th className="border border-slate-800 p-2 font-bold w-[12%]">위치(층/부재)</th>
                <th className="border border-slate-800 p-2 font-bold w-[25%]">결함종류 및 규격</th>
                <th className="border border-slate-800 p-2 font-bold w-[35%]">추정 원인</th>
              </tr>
            </thead>
            <tbody>
              {damages.map((d) => (
                <tr key={d.id}>
                  <td className="border border-slate-800 p-2 font-mono">No.{d.no}</td>
                  <td className="border border-slate-800 p-2 font-medium">{d.facility || project.name}</td>
                  <td className="border border-slate-800 p-2">{d.floor} / {d.member}</td>
                  <td className="border border-slate-800 p-2 font-mono">
                    {d.type} (
                    {d.type.includes('균열')
                      ? `${d.widthVal.toFixed(1)}mm x ${d.lengthVal.toFixed(1)}m`
                      : `${d.widthVal.toFixed(1)}x${d.lengthVal.toFixed(1)}m` + (d.areaVal ? ` (${d.areaVal.toFixed(1)}㎡)` : '')
                    })
                  </td>
                  <td className="border border-slate-800 p-2 text-left">
                    {d.cause === '기타 직접입력' ? d.customCause : d.cause}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Photo Pages Previews on Screen */}
        {photoPages.map((pageChunk, idx) => (
          <div className="bg-white text-slate-900 shadow-2xl w-[210mm] min-h-[297mm] p-[15mm] flex flex-col border border-slate-200" key={`screen-photo-page-${idx}`}>
            <h2 className="text-xl font-extrabold text-center border-b border-slate-800 pb-3 mb-6">
              결함현황 사진대지
            </h2>

            <div className="grid grid-cols-2 gap-4 flex-1">
              {pageChunk.map((d) => {
                const causeText = d.cause === '기타 직접입력' ? d.customCause : d.cause;
                return (
                  <div className="border border-slate-300 flex flex-col overflow-hidden bg-white h-[260px]" key={`screen-cell-${d.id}`}>
                    <div className="flex-1 bg-slate-50 flex items-center justify-center overflow-hidden relative">
                      {d.photoUrls && d.photoUrls.length > 0 ? (
                        <div className="w-full h-full relative flex items-center justify-center overflow-hidden">
                          <img
                            src={d.photoUrls[0]}
                            alt="structural fault"
                            className="object-cover w-full h-full"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <div className="text-slate-400 text-[10px]">촬영된 사진이 없습니다</div>
                      )}
                      <span className="absolute top-1 right-1 bg-slate-900 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                        No.{d.no}
                      </span>
                    </div>

                    <table className="w-full border-t border-slate-300 text-[10px] text-left border-collapse table-fixed">
                      <tbody>
                        <tr className="border-b border-slate-200">
                          <td className="w-[30%] bg-slate-50 font-bold p-1 text-center border-r border-slate-200">시설물 명</td>
                          <td className="p-1 pl-1.5 truncate font-semibold text-slate-800">{project.name}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="w-[30%] bg-slate-50 font-bold p-1 text-center border-r border-slate-200">위 치</td>
                          <td className="p-1 pl-1.5 truncate">{d.floor} / {d.member}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="bg-slate-50 font-bold p-1 text-center border-r border-slate-200">결함명(크기)</td>
                          <td className="p-1 pl-1.5 font-mono text-[9.5px]">
                            {d.type} (
                            {d.type.includes('균열')
                              ? `${d.widthVal.toFixed(1)}mm x ${d.lengthVal.toFixed(1)}m`
                              : `${d.widthVal.toFixed(1)}x${d.lengthVal.toFixed(1)}m`
                            })
                          </td>
                        </tr>
                        <tr>
                          <td className="bg-slate-50 font-bold p-1 text-center border-r border-slate-200">발생원인</td>
                          <td className="p-1 pl-1.5 text-[9px] truncate font-sans text-slate-800">
                            {causeText}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })}
              {Array.from({ length: 6 - pageChunk.length }).map((_, i) => (
                <div className="border border-dashed border-slate-200 bg-slate-50/50 flex items-center justify-center h-[260px]" key={`screen-blank-${i}`}>
                   <span className="text-[10px] text-slate-300">빈 대지 영역 (미등록)</span>
                </div>
              ))}
            </div>
            
            <div className="mt-4 pt-2 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-500 font-mono">
              <span>{project.inspectionCompany} | 안전점검 사진첩 미리보기</span>
              <span>Page {idx + 3} / {photoPages.length + 2}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ACTUAL SEAMLESS PRINT STYLING TARGET (HIDDEN IN WORKSPACE, DISPLAYED ONLY FOR CTRL+P PRINT ENGINE) */}
      <div className="absolute top-0 left-0 w-0 h-0 overflow-hidden printable-area print:relative print:w-auto print:h-auto print:overflow-visible bg-white text-slate-950 font-sans">
        
        {/* CSS rule overrides for layout margin pagination */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body {
              background-color: #ffffff !important;
              color: #000000 !important;
            }
            .printable-area {
              display: block !important;
              width: 210mm;
              margin: 0 auto;
            }
            .print-page {
              width: 210mm;
              min-height: 297mm;
              page-break-after: always;
              position: relative;
              background-color: #ffffff;
              box-sizing: border-box;
              padding: 15mm 15mm 15mm 15mm;
              display: flex;
              flex-direction: column;
            }
            
            /* Rotated landscape block forced on portrait A4 sheet */
            .rotated-drawing-page {
              width: 210mm;
              height: 297mm;
              page-break-after: always;
              position: relative;
              box-sizing: border-box;
              padding: 12mm;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              background-color: #ffffff;
            }

            .rotated-canvas-wrapper {
              transform: rotate(-90deg);
              transform-origin: center center;
              width: 277mm;
              height: 190mm;
              position: absolute;
              left: 50%;
              top: 50%;
              margin-left: -138.5mm;
              margin-top: -95mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              box-sizing: border-box;
              border: 1px solid #111;
              padding: 4mm;
              background-color: #ffffff;
            }

            /* Counter-rotate text boxes inside rotated drawing by 90deg so they align perfectly to eye */
            .counter-rotated-label {
              transform: rotate(90deg) !important;
              transform-origin: center center !important;
            }

            .photo-grid-6 {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              grid-template-rows: repeat(3, 1fr);
              gap: 4mm;
              width: 100%;
              height: 85%;
            }

            .photo-cell {
              border: 1px solid #000000;
              display: flex;
              flex-direction: column;
              box-sizing: border-box;
              overflow: hidden;
              background-color: #ffffff;
            }
          }
        ` }} />

        {/* 1. SEAMLESS FIRST PAGE: LANDSCAPE DRAWING ROTATED -90 DEG */}
        <div className="rotated-drawing-page">
          <div className="rotated-canvas-wrapper">
            <div className="flex-1 w-full bg-slate-900 relative overflow-hidden flex items-center justify-center rounded">
              {project.drawingUrl ? (
                <img
                  src={project.drawingUrl}
                  alt="landscape drawing template"
                  className="w-full h-full object-contain pointer-events-none"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full bg-[#111622] flex items-center justify-center text-slate-500 font-mono text-xs">
                  도면 미첨부 가상 좌표영역
                </div>
              )}

              {/* Draw Connector Paths & Lines */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {allLayoutLabels.map((lbl) => {
                  const mX = lbl.x;
                  const mY = lbl.y;
                  const tX = lbl.attachX;
                  const tY = lbl.attachY;
                  const laneIndex = lbl.laneIndex ?? 0;
                  const isRed = getMemberColorClass(lbl.primaryMember) === 'red';
                  const strokeColor = isRed ? '#ef4444' : '#3b82f6';
                  const sizeScale = 0.55;

                  let elbowX = lbl.side === 'left' 
                    ? tX + (2.0 + laneIndex * 1.2) * sizeScale 
                    : tX - (2.0 + laneIndex * 1.2) * sizeScale;

                  if (lbl.side === 'left') {
                    if (elbowX > mX - 1.5) elbowX = Math.max(tX + 0.5, (tX + mX) / 2);
                  } else {
                    if (elbowX < mX + 1.5) elbowX = Math.min(tX - 0.5, (tX + mX) / 2);
                  }

                  return (
                    <g key={`print-conn-${lbl.id}`} className="opacity-90">
                      <line x1={`${mX}%`} y1={`${mY}%`} x2={`${elbowX}%`} y2={`${mY}%`} stroke={strokeColor} strokeWidth="1.2" strokeDasharray="1.5,1.5" />
                      <line x1={`${elbowX}%`} y1={`${mY}%`} x2={`${elbowX}%`} y2={`${tY}%`} stroke={strokeColor} strokeWidth="1.2" strokeDasharray="1.5,1.5" />
                      <line x1={`${elbowX}%`} y1={`${tY}%`} x2={`${tX}%`} y2={`${tY}%`} stroke={strokeColor} strokeWidth="1.6" />
                    </g>
                  );
                })}

                {defectGroups.map((g) => {
                  const isRed = getMemberColorClass(g.primaryMember) === 'red';
                  const dotColor = isRed ? '#ef4444' : '#3b82f6';
                  return (
                    <circle
                      key={`print-marker-${g.id}`}
                      cx={`${g.x}%`}
                      cy={`${g.y}%`}
                      r="4.5"
                      fill={dotColor}
                      stroke="#ffffff"
                      strokeWidth="1.2"
                    />
                  );
                })}
              </svg>

              {/* Box Overlays */}
              {allLayoutLabels.map((lbl) => {
                const isRed = getMemberColorClass(lbl.primaryMember) === 'red';
                const badgeBg = 'bg-[#f3f4f6]';
                const badgeBorder = isRed ? 'border-red-400 border-[1.5px]' : 'border-blue-400 border-[1.5px]';
                const textColorClass = isRed ? 'text-red-700' : 'text-blue-700';

                return (
                  <div
                    key={`print-label-div-${lbl.id}`}
                    className={`absolute flex flex-col gap-0.5 p-1 rounded shadow-sm ${badgeBg} ${badgeBorder} text-[7.5px] leading-tight text-left pointer-events-none`}
                    style={{
                      left: `${lbl.boxX}%`,
                      top: `${lbl.boxY}%`,
                      width: `${lbl.dynamicWidthPct}%`,
                      maxHeight: `${100 * 0.55}px`,
                      boxSizing: 'border-box',
                    }}
                  >
                    <div className={`flex items-center justify-between border-b border-black/10 pb-0.5 mb-1 text-[7px] font-bold ${textColorClass}`}>
                      <span className="truncate">{lbl.primaryMember}</span>
                      <span className="text-[7.5px] font-extrabold">({lbl.damages.length})</span>
                    </div>
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      {lbl.damages.map((d) => (
                        <div key={d.id} className={`text-[6.5px] font-bold truncate ${textColorClass}`}>
                          No.{d.no} {d.type}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ENGINEERING TITLE BLOCK (도곽) */}
            <div className="mt-2.5">
              <table className="w-full border-collapse border-2 border-slate-950 text-[11px] text-center font-bold">
                <tbody>
                  <tr>
                    <td className="border-2 border-slate-950 bg-slate-100 p-1.5 w-[15%]">공 사 명</td>
                    <td className="border-2 border-slate-950 p-1.5 w-[35%] text-left font-medium">{project.name} 및 부속 시설물 일체 건</td>
                    <td className="border-2 border-slate-950 bg-slate-100 p-1.5 w-[15%]">측정 도곽상 위치</td>
                    <td className="border-2 border-slate-950 p-1.5 w-[35%] text-left font-medium">
                      {project.facilitiesList.slice(0, 3).join(', ')} (지하 {project.basementFloors}층 ~ 지상 {project.abovegroundFloors}층)
                    </td>
                  </tr>
                  <tr>
                    <td className="border-2 border-slate-950 bg-slate-100 p-1.5">안전 진단업체</td>
                    <td className="border-2 border-slate-950 p-1.5 text-left font-medium">{project.inspectionCompany}</td>
                    <td className="border-2 border-slate-950 bg-slate-100 p-1.5">보고서 일자</td>
                    <td className="border-2 border-slate-950 p-1.5 text-left font-medium">{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 2. SECOND PAGE: PORTRAIT HAND-OVER SUMMARY INDEX TABLE */}
        <div className="print-page">
          <div className="text-center border-b-2 border-slate-950 pb-2 mb-4">
            <h1 className="text-xl font-extrabold tracking-tight text-slate-950">
              시설물 손상현황 종합 테이블 집계표
            </h1>
            <p className="text-[11px] text-slate-700 mt-1 font-bold">
              대상 시설물명 : {project.name}
            </p>
          </div>

          {/* 물량 집계 요약 대장 (A4 출력본 포함) */}
          <div className="mb-6 text-left">
            <h3 className="text-[11px] font-bold text-slate-900 mb-2 border-l-4 border-slate-900 pl-2">
              [총괄집계] 손상 유형별 누적 물량표
            </h3>
            <table className="w-full border-collapse border border-slate-900 text-[10px] text-center">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-900 p-1.5 font-bold w-[40%]">손상 대분류</th>
                  <th className="border border-slate-900 p-1.5 font-bold w-[30%]">결함 개소 수</th>
                  <th className="border border-slate-900 p-1.5 font-bold w-[30%]">집계 누적 물량</th>
                </tr>
              </thead>
              <tbody>
                {damageAggregations.map((agg) => (
                  <tr key={agg.type}>
                    <td className="border border-slate-900 p-1.5 font-medium">{agg.type}</td>
                    <td className="border border-slate-900 p-1.5 font-mono">{agg.count} 개소</td>
                    <td className="border border-slate-900 p-1.5 font-mono font-bold">
                      {agg.total.toFixed(2)} {agg.unit}
                    </td>
                  </tr>
                ))}
                {damageAggregations.length === 0 && (
                  <tr>
                    <td colSpan={3} className="border border-slate-900 p-3 text-center text-slate-400">
                      등록된 손상 측정 데이터가 존재하지 않습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <h3 className="text-[11px] font-bold text-slate-900 mb-2 border-l-4 border-slate-900 pl-2 text-left">
            [상세내역] 손상현황 상세 조사 대장
          </h3>
          <table className="w-full border-collapse border border-slate-900 text-[11px] text-center mb-4">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-900 p-1.5 font-bold w-[7%]">No.</th>
                <th className="border border-slate-900 p-1.5 font-bold w-[20%]">시설물명</th>
                <th className="border border-slate-900 p-1.5 font-bold w-[12%]">위치(층/부재)</th>
                <th className="border border-slate-900 p-1.5 font-bold w-[26%]">결함 종류 및 정밀 규격</th>
                <th className="border border-slate-900 p-1.5 font-bold w-[35%]">발생 추정공학적 원인</th>
              </tr>
            </thead>
            <tbody>
              {damages.map((d) => (
                <tr key={d.id}>
                  <td className="border border-slate-900 p-1.5 font-bold font-mono">No.{d.no}</td>
                  <td className="border border-slate-900 p-1.5 font-medium">{d.facility || project.name}</td>
                  <td className="border border-slate-900 p-1.5">{d.floor} / {d.member}</td>
                  <td className="border border-slate-900 p-1.5 font-mono text-left pl-2">
                    {d.type} (
                    {d.type.includes('균열')
                      ? `폭 ${d.widthVal.toFixed(1)}mm × 길이 ${d.lengthVal.toFixed(1)}m`
                      : `가로 ${d.widthVal.toFixed(1)}m × 세로 ${d.lengthVal.toFixed(1)}m` + (d.areaVal ? ` = 면적 ${d.areaVal.toFixed(1)}㎡` : '')
                    })
                  </td>
                  <td className="border border-slate-900 p-1.5 text-left text-[10px]">
                    {d.cause === '기타 직접입력' ? d.customCause : d.cause}
                  </td>
                </tr>
              ))}
              {damages.length === 0 && (
                <tr>
                  <td colSpan={5} className="border border-slate-900 p-8 text-center text-slate-500">
                    입력된 손상현황 기록이 존재하지 않습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="mt-auto pt-4 border-t border-slate-300 flex justify-between items-center text-[10px] text-slate-500 font-mono">
            <span>{project.inspectionCompany} | 안드로이드 스마트 현장조사 관리서식</span>
            <span>Page 2 / {photoPages.length + 2}</span>
          </div>
        </div>

        {/* 3. THIRD PAGE onwards: PORTRAIT 6-SPLIT PHOTO SHEETS */}
        {photoPages.map((pageChunk, idx) => (
          <div className="print-page" key={`print-photo-page-${idx}`}>
            <div className="text-center mb-4">
              <h2 className="text-lg font-bold tracking-tight border-b border-slate-950 pb-1.5 inline-block">
                결함현황 사진대지
              </h2>
            </div>

            {/* 6-grid layout container */}
            <div className="photo-grid-6">
              {pageChunk.map((d) => {
                const causeText = d.cause === '기타 직접입력' ? d.customCause : d.cause;
                return (
                  <div className="photo-cell" key={`cell-${d.id}`}>
                    {/* Visual photo Box */}
                    <div className="flex-1 bg-slate-100 flex items-center justify-center overflow-hidden relative">
                      {d.photoUrls && d.photoUrls.length > 0 ? (
                        <div className="w-full h-full relative flex items-center justify-center overflow-hidden">
                          <img
                            src={d.photoUrls[0]}
                            alt="structural fault"
                            className="object-cover w-full h-full"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <div className="text-slate-400 text-[10px] font-sans">촬영된 사진이 없습니다</div>
                      )}
                      
                      {/* Floating No indicator banner */}
                      <span className="absolute top-1 right-1 bg-slate-950 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                        No.{d.no}
                      </span>
                    </div>

                    {/* Meta specification table description under the picture */}
                    <table className="w-full border-t border-slate-950 text-[10px] text-left border-collapse table-fixed">
                      <tbody>
                        <tr className="border-b border-slate-300">
                          <td className="w-[30%] bg-slate-100 font-bold p-1 text-center border-r border-slate-300">시설물 명</td>
                          <td className="p-1 pl-1.5 break-all truncate font-semibold">{project.name}</td>
                        </tr>
                        <tr className="border-b border-slate-300">
                          <td className="w-[30%] bg-slate-100 font-bold p-1 text-center border-r border-slate-300">위 치</td>
                          <td className="p-1 pl-1.5 break-all truncate">{d.floor} / {d.member}</td>
                        </tr>
                        <tr className="border-b border-slate-300">
                          <td className="bg-slate-100 font-bold p-1 text-center border-r border-slate-300">결함명(크기)</td>
                          <td className="p-1 pl-1.5 font-mono break-all text-[9.5px]">
                            {d.type} (
                            {d.type.includes('균열')
                              ? `${d.widthVal.toFixed(1)}mm × ${d.lengthVal.toFixed(1)}m`
                              : `${d.widthVal.toFixed(1)}x${d.lengthVal.toFixed(1)}m` + (d.areaVal ? ` (${d.areaVal.toFixed(1)}㎡)` : '')
                            })
                          </td>
                        </tr>
                        <tr>
                          <td className="bg-slate-100 font-bold p-1 text-center border-r border-slate-300">발생원인</td>
                          <td className="p-1 pl-1.5 text-[9px] truncate break-all leading-tight">
                            {causeText}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })}

              {/* Pad blank cells if there are less than 6 damages inside this page block */}
              {Array.from({ length: 6 - pageChunk.length }).map((_, i) => (
                <div className="photo-cell bg-slate-50 flex items-center justify-center border border-dashed border-slate-300" key={`blank-${i}`}>
                  <span className="text-[10px] text-slate-300 font-sans">빈 대지 영역 (미등록)</span>
                </div>
              ))}
            </div>

            {/* Footer pagination */}
            <div className="mt-auto pt-2 border-t border-slate-300 flex justify-between items-center text-[9px] text-slate-500 font-mono">
              <span>{project.inspectionCompany} | 현장 정밀점검 손상현황 사진첩</span>
              <span>Page {idx + 3} / {photoPages.length + 2}</span>
            </div>
          </div>
        ))}

      </div>

    </div>
  );
};
