/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Project, Damage, DAMAGE_CAUSES, DamageType, MemberType, getMemberColorClass } from '../types';
import { DrawingCanvas } from './DrawingCanvas';
import { compressImage } from '../utils/imageCompressor';
import { generateId } from '../utils/uuid';
import { ArrowLeft, Camera, Image as ImageIcon, Sparkles, Plus, Trash2, Printer, CheckCircle2, ShieldAlert } from 'lucide-react';

interface SiteInspectorProps {
  project: Project;
  onUpdateProject: (updated: Project) => void;
  onBackToDashboard: () => void;
  onOpenReport: () => void;
}

export const SiteInspector: React.FC<SiteInspectorProps> = ({
  project,
  onUpdateProject,
  onBackToDashboard,
  onOpenReport,
}) => {
  // Current active damage selected for editing or mapping on drawing
  const [activeDamageId, setActiveDamageId] = useState<string | null>(null);

  // Form Fields
  const [damageType, setDamageType] = useState<DamageType>('균열');
  const [memberType, setMemberType] = useState<MemberType>('벽체');
  const [floor, setFloor] = useState<string>(project.floorOptions[0] || '지상1층');
  const [cause, setCause] = useState<string>('');
  const [customCause, setCustomCause] = useState<string>('');
  
  // Numerical metrics
  const [widthVal, setWidthVal] = useState<number>(0.2); // Default for 균열 / 습식균열
  const [lengthVal, setLengthVal] = useState<number>(1.0);
  const [areaVal, setAreaVal] = useState<number>(0);

  // Image assets
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [isLoadingCamera, setIsLoadingCamera] = useState<boolean>(false);
  const [isAiScanning, setIsAiScanning] = useState<boolean>(false);
  const [aiLog, setAiLog] = useState<string | null>(null);

  // Coordinates temporary placeholder from clicking drawing if not saved yet
  const [clickedCoords, setClickedCoords] = useState<{ x: number; y: number } | null>(null);
  const [boundingBoxes, setBoundingBoxes] = useState<any[]>([]);
  const [aiSuggestedSize, setAiSuggestedSize] = useState<string | null>(null);

  // Synchronous Preset Cause Update based on Damage Type selection
  useEffect(() => {
    const causes = DAMAGE_CAUSES[damageType];
    if (causes && causes.length > 0) {
      setCause(causes[0]);
    }
    
    // Auto scale crack thickness to 0.2mm as requested
    if (damageType === '균열' || damageType === '습식균열') {
      setWidthVal(0.2);
    } else {
      setWidthVal(1.0); // Reset default to 1.0 for others (Garo)
    }
  }, [damageType]);

  // Handle live area computation
  useEffect(() => {
    const isCrack = ['균열', '습식균열', '조적균열', '이질마감재 균열'].includes(damageType);
    if (!isCrack) {
      const computed = parseFloat((widthVal * lengthVal).toFixed(1));
      setAreaVal(computed);
    }
  }, [widthVal, lengthVal, damageType]);

  const handleCreateDamageObj = () => {
    const sizeStr = `No.${project.damages.length + 1}`;
    
    // Auto assign coordinate if clicked, or support floating mapping
    let markerCoord = clickedCoords;
    
    // Look for snaps if we are mapping
    if (clickedCoords) {
      const threshold = 1.6; // 1.5% radius snaps
      const closeMarker = project.damages.find((d) => {
        if (!d.marker) return false;
        const dx = d.marker.x - clickedCoords.x;
        const dy = d.marker.y - clickedCoords.y;
        return Math.sqrt(dx * dx + dy * dy) <= threshold;
      });

      if (closeMarker && closeMarker.marker) {
        markerCoord = closeMarker.marker; // Snap to existing coordinate
      }
    }

    const newDamage: Damage = {
      id: generateId(),
      no: project.damages.length + 1,
      type: damageType,
      cause: cause,
      customCause: cause === '기타 직접입력' ? customCause : undefined,
      floor: floor,
      member: memberType,
      widthVal: parseFloat(widthVal.toFixed(1)),
      lengthVal: parseFloat(lengthVal.toFixed(1)),
      areaVal: ['균열', '습식균열', '조적균열', '이질마감재 균열'].includes(damageType) ? undefined : areaVal,
      photoUrls: photoUrls,
      marker: markerCoord,
      boundingBoxes: boundingBoxes.length > 0 ? boundingBoxes : undefined,
      aiSuggestedSize: aiSuggestedSize,
    };

    const updatedDamages = [...project.damages, newDamage];
    const updatedProj = {
      ...project,
      damages: updatedDamages,
      updatedAt: new Date().toISOString(),
    };

    onUpdateProject(updatedProj);

    // Form defaults reset
    setPhotoUrls([]);
    setClickedCoords(null);
    setBoundingBoxes([]);
    setAiSuggestedSize(null);
    setCustomCause('');
    setAiLog(null);
    
    // Keep user's default floor but let crack reset to 0.2
    if (damageType === '균열' || damageType === '습식균열') {
      setWidthVal(0.2);
    } else {
      setWidthVal(1.0);
    }
    setLengthVal(1.0);
  };

  // Run official server-side Gemini scanner
  const runAiAssistantScan = async (base64DataUrl: string) => {
    setIsAiScanning(true);
    setAiLog("AI 안전진단 보조 엔진에 접속 중...");
    try {
      // Extract raw base64 context by slicing off prefix data mime
      const base64Data = base64DataUrl.split(',')[1];
      const mimeType = base64DataUrl.split(';')[0]?.slice(5) || 'image/jpeg';

      const response = await fetch('/api/gemini/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Data, mimeType }),
      });

      if (!response.ok) {
        throw new Error("Gemini API scanner returned bad response status");
      }

      const resData = await response.json();
      if (resData.boundingBoxes) {
        setBoundingBoxes(resData.boundingBoxes);
      }
      if (resData.suggestedSize) {
        setAiSuggestedSize(resData.suggestedSize);
        setAiLog(`스캔 완료: AI가 감지한 대략적 크기 [${resData.suggestedSize}]가 매핑되었습니다.`);
      }

    } catch (err) {
      console.error("AI scanning fail:", err);
      setAiLog("⚠️ AI 연결에 실패하였습니다. 수동 정보 기입을 통해 점검을 완료하십시오.");
    } finally {
      setIsAiScanning(false);
    }
  };

  // 1. Direct Camera Capture trigger
  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoadingCamera(true);
    try {
      const dataUrl = await compressImage(file);
      setPhotoUrls((prev) => [...prev, dataUrl]);
      
      // Instantly scan coordinates & bounding box info
      await runAiAssistantScan(dataUrl);
    } catch (err) {
      alert("카메라 촬영본을 가져오는데 실패했습니다: " + err);
    } finally {
      setIsLoadingCamera(false);
    }
  };

  // 2. Photo Album multi upload trigger
  const handleAlbumSelection = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsLoadingCamera(true);
    try {
      // Loop over files sequentially & compress
      const compressedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const compressed = await compressImage(files[i]);
        compressedUrls.push(compressed);
      }
      setPhotoUrls((prev) => [...prev, ...compressedUrls]);

      // If at least one photo is uploaded, query AI Scanner on the first image for box markers
      if (compressedUrls.length > 0) {
        await runAiAssistantScan(compressedUrls[0]);
      }
    } catch (err) {
      alert("앨범 사진 압축 중 요류가 발생했습니다: " + err);
    } finally {
      setIsLoadingCamera(false);
    }
  };

  const handleRemovePhoto = (idxToRemove: number) => {
    setPhotoUrls((prev) => prev.filter((_, i) => i !== idxToRemove));
  };

  const handleDeleteDamage = (damageId: string) => {
    const updatedDamages = project.damages.filter((d) => d.id !== damageId);
    
    // Re-pack serial number "No" sequentially after deletion as required
    const repackedDamages = updatedDamages.map((d, index) => ({
      ...d,
      no: index + 1,
    }));

    onUpdateProject({
      ...project,
      damages: repackedDamages,
      updatedAt: new Date().toISOString(),
    });

    if (activeDamageId === damageId) {
      setActiveDamageId(null);
    }
  };

  const handleCanvasAddMarker = (x: number, y: number) => {
    setClickedCoords({ x, y });
    
    // If we have an active damage selected, let's update its coordinate instantly
    if (activeDamageId) {
      const updatedDamages = project.damages.map((d) => {
        if (d.id === activeDamageId) {
          // Snap check with existing
          const threshold = 1.6;
          let finalX = x;
          let finalY = y;

          const snapPoint = project.damages.find((other) => {
            if (other.id === activeDamageId || !other.marker) return false;
            const dx = other.marker.x - x;
            const dy = other.marker.y - y;
            return Math.sqrt(dx * dx + dy * dy) <= threshold;
          });

          if (snapPoint && snapPoint.marker) {
            finalX = snapPoint.marker.x;
            finalY = snapPoint.marker.y;
          }

          return { ...d, marker: { x: finalX, y: finalY } };
        }
        return d;
      });

      onUpdateProject({
        ...project,
        damages: updatedDamages,
        updatedAt: new Date().toISOString(),
      });
      setClickedCoords(null);
    }
  };

  // Sorted damages descending: latest hand-over No at top
  const sortedDamages = [...project.damages].sort((a, b) => b.no - a.no);

  const activeDamage = project.damages.find((d) => d.id === activeDamageId);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      {/* Detail Inspector Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-700/60 pb-5 mb-6 gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              {project.name}
              <span className="text-xs bg-emerald-950/40 text-emerald-400 px-2 py-1 rounded-md border border-emerald-900/60">
                ACTIVE
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              조사 범위: {project.facilitiesList.join(', ')} | 점검업체: {project.inspectionCompany}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onOpenReport}
            className="inline-flex items-center gap-1.5 px-4.5 py-2.5 text-xs font-bold rounded-xl text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors shadow-md transform active:scale-95 cursor-pointer"
            id="btn-report-prev"
          >
            <Printer className="h-4 w-4" />
            A4 종합 보고서 출력 미리보기
          </button>
        </div>
      </div>

      {/* Main Dual workbench Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Zoomable scale-invariant CAD drawing (span 7) */}
        <div className="lg:col-span-7 space-y-4">
          <DrawingCanvas
            damages={project.damages}
            onAddMarker={handleCanvasAddMarker}
            drawingUrl={project.drawingUrl}
            activeDamageId={activeDamageId}
            onSelectDamage={(id) => setActiveDamageId(id)}
          />

          {clickedCoords && (
            <div className="p-3 bg-emerald-950/20 border border-emerald-900/40 text-emerald-300 rounded-lg text-xs flex justify-between items-center animate-pulse">
              <span>
                📍 도면에서 좌표 <strong>({clickedCoords.x.toFixed(1)}%, {clickedCoords.y.toFixed(1)}%)</strong>가 감지되었습니다. 아래 폼을 작성해 No.{project.damages.length + 1} 손상으로 등록할 수 있습니다.
              </span>
              <button
                onClick={() => setClickedCoords(null)}
                className="text-emerald-400 hover:text-white font-mono"
              >
                취소
              </button>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Interactive Input structure form (span 5) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Active damage contextual card */}
          {activeDamageId && activeDamage && (
            <div className="bg-slate-900 border border-indigo-500/30 p-4 rounded-xl shadow-lg relative">
              <span className="absolute -top-2.5 left-4 bg-indigo-600 text-white text-[10px] font-bold py-0.5 px-2 rounded-full uppercase tracking-wider font-mono">
                현재 선택된 손상 정보
              </span>
              <div className="flex justify-between items-start pt-1.5">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    No.{activeDamage.no} - {activeDamage.type} ({activeDamage.floor})
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    부재: {activeDamage.member} | 원인: {activeDamage.cause === '기타 직접입력' ? activeDamage.customCause : activeDamage.cause}
                  </p>
                  <p className="text-xs font-mono text-cyan-400 mt-1">
                    규격: {activeDamage.type.includes('균열') 
                      ? `${activeDamage.widthVal.toFixed(1)}mm x ${activeDamage.lengthVal.toFixed(1)}m`
                      : `${activeDamage.widthVal.toFixed(1)}m x ${activeDamage.lengthVal.toFixed(1)}m = 면적 ${activeDamage.areaVal?.toFixed(1)}㎡`
                    }
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => setActiveDamageId(null)}
                    className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 p-1 px-2.5 rounded transition-colors font-medium border border-slate-700"
                  >
                    선택 해제
                  </button>
                  <button
                    onClick={() => handleDeleteDamage(activeDamage.id)}
                    className="text-[10px] bg-red-950/45 hover:bg-red-900/40 text-red-200 p-1 px-2 rounded transition-colors border border-red-900/40"
                  >
                    삭제 No.
                  </button>
                </div>
              </div>
              
              {/* If marked on drawing */}
              {activeDamage.marker ? (
                <div className="text-[11px] text-slate-400 mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <span>📍 도면 마킹됨: ({activeDamage.marker.x.toFixed(1)}%, {activeDamage.marker.y.toFixed(1)}%)</span>
                  <button
                    onClick={() => {
                      const updated = project.damages.map(d => d.id === activeDamage.id ? { ...d, marker: null } : d);
                      onUpdateProject({ ...project, damages: updated });
                    }}
                    className="text-[10px] text-red-400 hover:text-red-300 hover:underline"
                  >
                    마킹 제거
                  </button>
                </div>
              ) : (
                <div className="text-[11px] text-amber-300 mt-2.5 pt-2 border-t border-slate-800/80">
                  ⚠️ 아직 도면에 마킹되지 않았습니다. <strong>왼쪽 도면 영역을 터치</strong>하여 마킹 위치를 부여하세요!
                </div>
              )}
            </div>
          )}

          {/* Form to Regist new injury */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-200 border-b border-slate-800/70 pb-2 flex items-center gap-1.5">
              <Plus className="h-4.5 w-4.5 text-emerald-400" />
              신규 손상 점검내역 추가
            </h3>

            {/* Type selector */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">9대 손상 종류</label>
                <select
                  value={damageType}
                  onChange={(e) => setDamageType(e.target.value as DamageType)}
                  className="w-full text-xs p-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded text-slate-100 outline-none cursor-pointer"
                >
                  <option value="균열">균열</option>
                  <option value="습식균열">습식균열</option>
                  <option value="누수">누수</option>
                  <option value="백화">백화</option>
                  <option value="콘크리트 박리박락">콘크리트 박리박락</option>
                  <option value="철근노출 및 부식">철근노출 및 부식</option>
                  <option value="마감재박리">마감재박리</option>
                  <option value="이질마감재 균열">이질마감재 균열</option>
                  <option value="조적균열">조적균열</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">부재 분류</label>
                <select
                  value={memberType}
                  onChange={(e) => setMemberType(e.target.value as MemberType)}
                  className="w-full text-xs p-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded text-slate-100 outline-none cursor-pointer"
                >
                  <option value="벽체">벽체 (Red)</option>
                  <option value="기둥">기둥 (Red)</option>
                  <option value="보">보 (Blue)</option>
                  <option value="슬래브">슬래브 (Blue)</option>
                </select>
              </div>
            </div>

            {/* Flooring range drop list */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">조사 위치 (층선택)</label>
                <select
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  className="w-full text-xs p-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded text-slate-100 outline-none cursor-pointer"
                >
                  {project.floorOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* Dynamic width and lengths */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  {['균열', '습식균열', '조적균열', '이질마감재 균열'].includes(damageType) ? '균열 폭 (단위: mm)' : '가로 크기 (단위: m)'}
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.05"
                  className="w-full text-xs p-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 font-mono"
                  value={widthVal}
                  onChange={(e) => setWidthVal(parseFloat(e.target.value) || 0.1)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  {['균열', '습식균열', '조적균열', '이질마감재 균열'].includes(damageType) ? '균열 길이 (단위: m)' : '세로 크기 (단위: m)'}
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  className="w-full text-xs p-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 font-mono"
                  value={lengthVal}
                  onChange={(e) => setLengthVal(parseFloat(e.target.value) || 0.1)}
                />
              </div>

              {/* Dynamic area representation if not crack */}
              {!['균열', '습식균열', '조적균열', '이질마감재 균열'].includes(damageType) && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">자동 환산 면적(㎡)</label>
                  <div className="w-full text-xs p-1.5 bg-slate-950/85 border border-slate-850 px-3.5 rounded text-cyan-400 font-mono font-bold leading-normal">
                    {areaVal.toFixed(1)} ㎡
                  </div>
                </div>
              )}
            </div>

            {/* Dynamic Cause mappings */}
            <div className="space-y-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">특이 공학 원인 연동 리스트</label>
                <select
                  value={cause}
                  onChange={(e) => setCause(e.target.value)}
                  className="w-full text-xs p-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded text-slate-100 outline-none cursor-pointer"
                >
                  {DAMAGE_CAUSES[damageType]?.map((cOpt) => (
                    <option key={cOpt} value={cOpt}>{cOpt}</option>
                  ))}
                </select>
              </div>

              {/* Type directly if customcause selected */}
              {cause === '기타 직접입력' && (
                <div>
                  <input
                    type="text"
                    className="w-full text-xs p-2 bg-slate-950 border border-indigo-500/30 rounded text-slate-100 outline-none"
                    placeholder="발생 공학 원인 수기 기입"
                    value={customCause}
                    onChange={(e) => setCustomCause(e.target.value)}
                    required
                  />
                </div>
              )}
            </div>

            {/* AI Assistant metric summary box */}
            {aiSuggestedSize && (
              <div className="p-2.5 bg-slate-950/40 border border-slate-800 rounded text-[11px] text-indigo-300 font-sans flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                <span>AI 권장 기준 수치 스캔 보조: {aiSuggestedSize} (사용자 수동 변경 가능)</span>
              </div>
            )}

            {/* MULTI IMAGE LOADER - 이원화된 입력 파트 */}
            <div className="space-y-2 border-t border-slate-800/80 pt-3">
              <label className="block text-[11px] font-bold text-slate-300 uppercase">현장 사진 미디어 등록</label>
              
              <div className="grid grid-cols-2 gap-2">
                {/* Button 1: Directly environment camera */}
                <label className="cursor-pointer inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 rounded bg-slate-950 text-xs font-semibold text-slate-200 transition-all select-none text-center">
                  <Camera className="h-4 w-4 text-emerald-400" />
                  [현장 직접 촬영]
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleCameraCapture}
                    className="hidden"
                  />
                </label>

                {/* Button 2: Multi selection gallery */}
                <label className="cursor-pointer inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 rounded bg-slate-950 text-xs font-semibold text-slate-200 transition-all select-none text-center">
                  <ImageIcon className="h-4 w-4 text-sky-400" />
                  [사진 앨범 다중 첨부]
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleAlbumSelection}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Loader inside uploads */}
              {isLoadingCamera && (
                <div className="text-[10px] text-slate-400 font-mono animate-pulse">
                  🔄 대용량 사진 캔버스 렌더러 압축 최적화 중 (너비 1024px, Quality 0.6)...
                </div>
              )}
              
              {isAiScanning && (
                <div className="text-[10px] text-indigo-400 font-sans animate-pulse flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>AI 규격 스캔 보조 동작 중: Bounding Box 및 테두리 감지 완료 대기...</span>
                </div>
              )}

              {aiLog && (
                <div className="text-[10px] text-emerald-400 font-mono truncate">
                  ✓ {aiLog}
                </div>
              )}

              {/* Live Upload pre-view list */}
              {photoUrls.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {photoUrls.map((url, index) => (
                    <div className="relative h-14 w-14 rounded border border-slate-800 overflow-hidden" key={`p-idx-${index}`}>
                      <img src={url} alt="attached pre-view" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      {/* Close button */}
                      <button
                        onClick={() => handleRemovePhoto(index)}
                        className="absolute top-0 right-0 bg-red-600 text-white rounded-full p-0.5 text-[8px] h-3.5 w-3.5 flex items-center justify-center font-bold cursor-pointer"
                        title="제거"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Regist triggers buttons */}
            <button
              onClick={handleCreateDamageObj}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 active:bg-emerald-500 rounded-lg transition-colors cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4" />
              손상 조사 목록에 추가 (No.{project.damages.length + 1})
            </button>
          </div>

          {/* ACTIVE DISASTER LIST - 내림차순(No가 큰 순서) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3.5">
            <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-widest border-b border-slate-850 pb-2 flex items-center justify-between">
              <span>현장조사 실시간 기입 이력 (총 {project.damages.length}건)</span>
              <span className="text-[10px] text-slate-500 font-mono italic">최신 번호 상단</span>
            </h3>

            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {sortedDamages.length === 0 ? (
                <p className="text-xs text-slate-500 font-sans text-center py-8">
                  추가된 지수 내역이 없습니다. 위의 평면도를 터치하고 안전 정보를 기입하십시오.
                </p>
              ) : (
                sortedDamages.map((d) => {
                  const isChecked = activeDamageId === d.id;
                  const isRed = getMemberColorClass(d.member) === 'red';
                  const indicatorColor = isRed ? 'bg-red-500' : 'bg-blue-500';
                  const sizeText = d.type.includes('균열')
                    ? `${d.widthVal.toFixed(1)}mm x ${d.lengthVal.toFixed(1)}m`
                    : `${d.widthVal.toFixed(1)}x${d.lengthVal.toFixed(1)}m` + (d.areaVal ? ` (${d.areaVal.toFixed(1)}㎡)` : '');

                  return (
                    <div
                      key={d.id}
                      onClick={() => setActiveDamageId(d.id)}
                      className={`p-3 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between ${
                        isChecked
                          ? 'bg-slate-800 border-emerald-500 shadow'
                          : 'bg-slate-950 border-slate-850 hover:bg-slate-850'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className={`h-2.5 w-2.5 rounded-full mt-1.5 ${indicatorColor}`} />
                        <div>
                          <h4 className="text-xs font-bold text-white">
                            No.{d.no} - {d.type}
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            위치: {d.floor} / {d.member} | {sizeText}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate max-w-[200px] mt-0.5">
                            원인: {d.cause === '기타 직접입력' ? d.customCause : d.cause}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(ev) => {
                          ev.stopPropagation();
                          handleDeleteDamage(d.id);
                        }}
                        className="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-slate-900 transition-colors"
                        title="기입 이력 삭제"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
