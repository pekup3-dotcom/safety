/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Project, Damage, getMemberColorClass } from '../types';
import { Printer, Eye, X } from 'lucide-react';

interface ReportViewerProps {
  project: Project;
  onClose: () => void;
}

export const ReportViewer: React.FC<ReportViewerProps> = ({ project, onClose }) => {
  const { damages } = project;

  // Split damages into chunks of 6 for the 6-split photo sheets
  const chunkDamagesForPhotos = (items: Damage[], size: number): Damage[][] => {
    const result: Damage[][] = [];
    for (let i = 0; i < items.length; i += size) {
      result.push(items.slice(i, i + size));
    }
    return result;
  };

  const photoPages = chunkDamagesForPhotos(damages, 6);

  const handlePrintTrigger = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/90 py-6 px-4 flex flex-col items-center">
      {/* Dynamic Report Controls header on screen */}
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 flex items-center justify-between shadow-2xl no-print">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Eye className="h-5 w-5 text-emerald-400" />
            정밀 A4 보고서 및 사진대지 인쇄 미리보기
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            아래에 표기된 레이아웃이 실제 A4 규격용 프린트 세팅에 맞추어 출력됩니다.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrintTrigger}
            className="inline-flex items-center gap-1.5 px-4.5 py-2.5 text-xs font-bold rounded-lg text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-colors cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            A4 보고서 인쇄 (PDF 저장)
          </button>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-4.5 w-4.5" />
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
                구조물 손상위치 마킹 도면
              </h1>
              <span className="text-xs text-slate-500 font-mono">
                [아래 표기 영역은 가로 도곽 레이아웃으로서 실제 인쇄 시 -90도 회전되어 풀사이즈로 매핑됩니다]
              </span>
            </div>

            {/* Rotated drawing box mock container */}
            <div className="mt-8 border border-dashed border-slate-400 p-4 rounded bg-slate-50 w-full max-w-lg aspect-[11/8] relative flex items-center justify-center overflow-hidden">
              {project.drawingUrl ? (
                <img
                  src={project.drawingUrl}
                  alt="drawing preview"
                  className="max-h-full object-contain pointer-events-none"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-xs text-slate-400">등록된 도면이 없습니다 (격자 자동생성)</span>
              )}
            </div>

            {/* Mock horizontal title block */}
            <table className="w-full mt-10 border-collapse border-2 border-slate-900 text-xs text-center font-sans">
              <tbody>
                <tr>
                  <td className="border border-slate-900 bg-slate-100 font-bold p-1.5 w-[20%]">시설물명</td>
                  <td className="border border-slate-900 p-1.5 w-[30%]">{project.name}</td>
                  <td className="border border-slate-900 bg-slate-100 font-bold p-1.5 w-[20%]">도면위치</td>
                  <td className="border border-slate-900 p-1.5 w-[30%]">전체 구조 도면</td>
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
          <h2 className="text-xl font-extrabold text-center border-b border-slate-800 pb-3 mb-6">
            손상현황 종합 총괄표
          </h2>
          <table className="w-full border-collapse border border-slate-800 text-xs text-center">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-800 p-2 font-bold w-[10%]">No.</th>
                <th className="border border-slate-800 p-2 font-bold w-[25%]">시설물명</th>
                <th className="border border-slate-800 p-2 font-bold w-[20%]">위치(층/부재)</th>
                <th className="border border-slate-800 p-2 font-bold w-[25%]">결함종류 및 규격</th>
                <th className="border border-slate-800 p-2 font-bold w-[20%]">추정 원인</th>
              </tr>
            </thead>
            <tbody>
              {damages.map((d) => (
                <tr key={d.id}>
                  <td className="border border-slate-800 p-2 font-mono">No.{d.no}</td>
                  <td className="border border-slate-800 p-2 font-medium">{project.name}</td>
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
              height: 297mm;
              page-break-after: always;
              page-break-inside: avoid;
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
              width: 260mm;
              height: 180mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              box-sizing: border-box;
              border: 1px solid #111;
              padding: 4mm;
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
            {/* Embedded map overlay logic */}
            <div className="flex-1 w-full bg-slate-50 relative border border-slate-300 rounded overflow-hidden flex items-center justify-center">
              {project.drawingUrl ? (
                <img
                  src={project.drawingUrl}
                  alt="landscape drawing template"
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : (
                /* Sleek vector structural draft grid */
                <div className="w-full h-full bg-[#fafbfc] border border-cyan-800/10 flex flex-col justify-between p-4 flex-wrap relative select-none">
                  <div className="absolute inset-0 grid grid-cols-12 grid-rows-8 pointer-events-none opacity-20">
                    {Array.from({ length: 96 }).map((_, i) => (
                      <div key={i} className="border-t border-l border-slate-900 h-full w-full"></div>
                    ))}
                  </div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                    <p className="text-slate-500 font-sans text-xs">도면 미첨부 가상 좌표영역</p>
                  </div>
                </div>
              )}

              {/* Draw Scale-Invariant Pointer Dots & Lines inside the rotated preview */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {damages.filter(d => d.marker !== null).map((d) => {
                  if (!d.marker) return null;
                  const isRed = getMemberColorClass(d.member) === 'red';
                  const markerColor = isRed ? '#ef4444' : '#3b82f6';
                  return (
                    <g key={`print-dot-${d.id}`}>
                      {/* Anchor Dot */}
                      <circle
                        cx={`${d.marker.x}%`}
                        cy={`${d.marker.y}%`}
                        r="4"
                        fill={markerColor}
                        stroke="#fff"
                        strokeWidth="1"
                      />
                      {/* Minimal line pointing down towards border info */}
                      <line
                        x1={`${d.marker.x}%`}
                        y1={`${d.marker.y}%`}
                        x2={`${d.marker.x}%`}
                        y2={`${d.marker.y + 10 > 95 ? 95 : d.marker.y + 10}%`}
                        stroke={markerColor}
                        strokeWidth="1.2"
                        strokeDasharray="2,2"
                      />
                      {/* Small text label tag counter-rotated 90deg to keep horizontal reading on page */}
                      <foreignObject
                        x={`${d.marker.x}%`}
                        y={`${d.marker.y + 10 > 95 ? 93 : d.marker.y + 8}%`}
                        width="60"
                        height="30"
                        className="overflow-visible"
                      >
                        <div className="counter-rotated-label bg-black text-white font-mono text-[9px] font-bold p-0.5 px-1 border border-white rounded shadow-sm text-center inline-block">
                          No.{d.no}
                        </div>
                      </foreignObject>
                    </g>
                  );
                })}
              </svg>
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
          <div className="text-center mb-6">
            <h1 className="text-xl font-extrabold tracking-tight border-b-2 border-slate-950 pb-2 inline-block">
              시설물 손상현황 종합 테이블 집계표
            </h1>
          </div>

          <table className="w-full border-collapse border border-slate-900 text-[11px] text-center mb-4">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-900 p-1.5 font-bold w-[7%]">No.</th>
                <th className="border border-slate-900 p-1.5 font-bold w-[25%]">시설물명</th>
                <th className="border border-slate-900 p-1.5 font-bold w-[18%]">위치(층/부재)</th>
                <th className="border border-slate-900 p-1.5 font-bold w-[30%]">결함 종류 및 정밀 규격</th>
                <th className="border border-slate-900 p-1.5 font-bold w-[20%]">발생 추정공학적 원인</th>
              </tr>
            </thead>
            <tbody>
              {damages.map((d) => (
                <tr key={d.id}>
                  <td className="border border-slate-900 p-1.5 font-bold font-mono">No.{d.no}</td>
                  <td className="border border-slate-900 p-1.5 font-medium">{project.name}</td>
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
                현장 안전점검 사진대지 (No.{pageChunk[0].no} ~ No.{pageChunk[pageChunk.length - 1].no})
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
                        <div className="w-full h-full relative flex items-center justify-center">
                          <img
                            src={d.photoUrls[0]}
                            alt="structural fault"
                            className="object-contain w-full h-full max-h-[140px]"
                            referrerPolicy="no-referrer"
                          />
                          {/* Sketch coordinates and AI scan bounding overlay highlight */}
                          {d.boundingBoxes && d.boundingBoxes.map((box, bIdx) => (
                            <div
                              key={bIdx}
                              className="absolute border-2 border-red-500 pointer-events-none"
                              style={{
                                left: `${box.x}%`,
                                top: `${box.y}%`,
                                width: `${box.width}%`,
                                height: `${box.height}%`,
                              }}
                            />
                          ))}
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
