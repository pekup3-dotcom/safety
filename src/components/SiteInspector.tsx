/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Project, Damage, DAMAGE_CAUSES, DamageType, MemberType, getMemberColorClass } from '../types';
import { DrawingCanvas } from './DrawingCanvas';
import { compressImage } from '../utils/imageCompressor';
import { generateId } from '../utils/uuid';
import { convertPdfToImage } from '../utils/pdfRenderer';
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
  // Navigation tabs of SiteInspector workbench
  const [activeTab, setActiveTab] = useState<'inspect' | 'drawing' | 'table'>('inspect');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Current active damage selected for editing or mapping on drawing
  const [activeDamageId, setActiveDamageId] = useState<string | null>(null);

  // Auto-redirect to drawing tab on first load if no drawing exists
  useEffect(() => {
    if (!project.drawingUrl) {
      setActiveTab('drawing');
    }
  }, []);

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
      
      if (activeDamageId) {
        // Apply AI scanning coordinates bounding boxes & suggested size to the selected active damage
        const updatedDamages = project.damages.map(d => {
          if (d.id === activeDamageId) {
            return {
              ...d,
              boundingBoxes: resData.boundingBoxes ? resData.boundingBoxes : d.boundingBoxes,
              aiSuggestedSize: resData.suggestedSize ? resData.suggestedSize : d.aiSuggestedSize,
            };
          }
          return d;
        });
        onUpdateProject({
          ...project,
          damages: updatedDamages,
          updatedAt: new Date().toISOString(),
        });
        if (resData.suggestedSize) {
          setAiLog(`스캔 완료: AI가 감지한 대략적 크기 [${resData.suggestedSize}]가 선택된 손상 No.${project.damages.find(d => d.id === activeDamageId)?.no}에 반영되었습니다.`);
        }
      } else {
        if (resData.boundingBoxes) {
          setBoundingBoxes(resData.boundingBoxes);
        }
        if (resData.suggestedSize) {
          setAiSuggestedSize(resData.suggestedSize);
          setAiLog(`스캔 완료: AI가 감지한 대략적 크기 [${resData.suggestedSize}]가 매핑되었습니다.`);
        }
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
      
      if (activeDamageId) {
        // Append photo directly to the selected active damage
        const updatedDamages = project.damages.map(d => {
          if (d.id === activeDamageId) {
            return { ...d, photoUrls: [...(d.photoUrls || []), dataUrl] };
          }
          return d;
        });
        onUpdateProject({
          ...project,
          damages: updatedDamages,
          updatedAt: new Date().toISOString(),
        });
      } else {
        setPhotoUrls((prev) => [...prev, dataUrl]);
      }
      
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
      
      if (activeDamageId) {
        // Append multiple photos directly to the selected active damage
        const updatedDamages = project.damages.map(d => {
          if (d.id === activeDamageId) {
            return { ...d, photoUrls: [...(d.photoUrls || []), ...compressedUrls] };
          }
          return d;
        });
        onUpdateProject({
          ...project,
          damages: updatedDamages,
          updatedAt: new Date().toISOString(),
        });
      } else {
        setPhotoUrls((prev) => [...prev, ...compressedUrls]);
      }

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

  const handleDrawingUploadInInspector = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setIsUploading(true);

    try {
      let dataUrl = '';
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        dataUrl = await convertPdfToImage(file);
      } else {
        dataUrl = await compressImage(file);
      }

      onUpdateProject({
        ...project,
        drawingUrl: dataUrl,
        drawingName: file.name,
        updatedAt: new Date().toISOString(),
      });

      setActiveTab('inspect'); // Auto focus back to marking board
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || '도면 등록 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
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

      {/* Tabs list of SiteInspector workbench */}
      <div className="flex border-b border-slate-800 mb-6 gap-1 sm:gap-2 no-print overflow-x-auto select-none scrollbar-none">
        <button
          onClick={() => setActiveTab('inspect')}
          className={`px-4 py-3 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t-2 border-x border-transparent cursor-pointer ${
            activeTab === 'inspect'
              ? 'bg-slate-900 border-t-emerald-400 border-x-slate-800 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/40'
          }`}
        >
          <ShieldAlert className="h-4 w-4 text-emerald-400" />
          현장 점검 및 도면마킹
        </button>
        <button
          onClick={() => setActiveTab('drawing')}
          className={`px-4 py-3 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t-2 border-x border-transparent cursor-pointer ${
            activeTab === 'drawing'
              ? 'bg-slate-900 border-t-emerald-400 border-x-slate-800 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/40'
          }`}
        >
          <ImageIcon className="h-4 w-4 text-sky-400" />
          도면 등록 / 변경 (PDF·이미지)
        </button>
        <button
          onClick={() => setActiveTab('table')}
          className={`px-4 py-3 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t-2 border-x border-transparent cursor-pointer ${
            activeTab === 'table'
              ? 'bg-slate-900 border-t-emerald-400 border-x-slate-800 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/40'
          }`}
        >
          <Printer className="h-4 w-4 text-amber-400" />
          손상현황표 대장 (출력)
        </button>
      </div>

      {activeTab === 'inspect' && (
        /* Main Dual workbench Grid */
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
              <div className="bg-slate-900 border border-indigo-500/30 p-4 rounded-xl shadow-lg relative space-y-3.5">
                <span className="absolute -top-2.5 left-4 bg-indigo-600 text-white text-[10px] font-bold py-0.5 px-2 rounded-full uppercase tracking-wider font-mono">
                  현재 선택된 손상 정보
                </span>
                <div className="flex justify-between items-start pt-1.5">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      No.{activeDamage.no} - {activeDamage.type} ({activeDamage.floor})
                    </h3>
                    <p className="text-xs text-indigo-300 font-medium mt-0.5">
                      부재: {activeDamage.member}
                    </p>
                    <p className="text-xs font-mono text-cyan-400 mt-1">
                      규격: {activeDamage.type.includes('균열') 
                        ? `${activeDamage.widthVal.toFixed(1)}mm x ${activeDamage.lengthVal.toFixed(1)}m`
                        : `${activeDamage.widthVal.toFixed(1)}m x ${activeDamage.lengthVal.toFixed(1)}m` + (activeDamage.areaVal ? ` = 면적 ${activeDamage.areaVal.toFixed(1)}㎡` : '')
                      }
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={() => setActiveDamageId(null)}
                      className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 p-1 px-2.5 rounded transition-colors font-medium border border-slate-700 cursor-pointer"
                    >
                      선택 해제
                    </button>
                    <button
                      onClick={() => handleDeleteDamage(activeDamage.id)}
                      className="text-[10px] bg-red-950/45 hover:bg-red-900/40 text-red-200 p-1 px-2 rounded transition-colors border border-red-900/40 cursor-pointer"
                    >
                      삭제 No.
                    </button>
                  </div>
                </div>

                {/* Manual Cause Editing for Selected Damage */}
                <div className="pt-2.5 border-t border-slate-800 space-y-2">
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-300 mb-1">손상별 발생원인 수동 선택</label>
                    <select
                      value={activeDamage.cause}
                      onChange={(e) => {
                        const newCause = e.target.value;
                        const updated = project.damages.map(d => {
                          if (d.id === activeDamage.id) {
                            return { 
                              ...d, 
                              cause: newCause, 
                              customCause: newCause === '기타 직접입력' ? '' : undefined 
                            };
                          }
                          return d;
                        });
                        onUpdateProject({ ...project, damages: updated, updatedAt: new Date().toISOString() });
                      }}
                      className="w-full text-xs p-1.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded text-slate-100 outline-none cursor-pointer font-sans"
                    >
                      {DAMAGE_CAUSES[activeDamage.type]?.map((cOpt) => (
                        <option key={cOpt} value={cOpt}>{cOpt}</option>
                      ))}
                    </select>
                  </div>
                  
                  {activeDamage.cause === '기타 직접입력' && (
                    <input
                      type="text"
                      className="w-full text-xs p-1.5 bg-slate-950 border border-indigo-500/30 rounded text-slate-100 outline-none font-sans"
                      placeholder="수기 분석 원인 입력"
                      value={activeDamage.customCause || ''}
                      onChange={(e) => {
                        const newVal = e.target.value;
                        const updated = project.damages.map(d => {
                          if (d.id === activeDamage.id) {
                            return { ...d, customCause: newVal };
                          }
                          return d;
                        });
                        onUpdateProject({ ...project, damages: updated, updatedAt: new Date().toISOString() });
                      }}
                    />
                  )}
                </div>

                {/* Real-time Registered Photos list for Selected Damage */}
                <div className="pt-2.5 border-t border-slate-800 space-y-1.5">
                  <span className="block text-[10px] font-bold text-indigo-300">연동된 현장 점검 사진 ({activeDamage.photoUrls?.length || 0}장)</span>
                  {activeDamage.photoUrls && activeDamage.photoUrls.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {activeDamage.photoUrls.map((url, index) => (
                        <div className="relative h-14 w-14 rounded border border-slate-800 overflow-hidden group bg-slate-950" key={`act-photo-${index}`}>
                          <img src={url} alt="attached defect" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const updated = project.damages.map(d => {
                                if (d.id === activeDamage.id) {
                                  return { ...d, photoUrls: d.photoUrls.filter((_, i) => i !== index) };
                                }
                                return d;
                              });
                              onUpdateProject({ ...project, damages: updated, updatedAt: new Date().toISOString() });
                            }}
                            className="absolute top-0.5 right-0.5 bg-red-600 hover:bg-red-700 text-white rounded-full text-[8px] h-3.5 w-3.5 flex items-center justify-center font-bold shadow opacity-90 cursor-pointer"
                            title="사진 제거"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500 italic">피해 사진을 업로드해 연동해 주십시오. [현장 미디어 등록] 시 이곳에 실시간 연동 등록됩니다.</p>
                  )}
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
                      className="text-[10px] text-red-450 hover:text-red-400 hover:underline cursor-pointer"
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
                        {d.photoUrls && d.photoUrls.length > 0 ? (
                          <div className="h-12 w-12 shrink-0 rounded border border-slate-800 overflow-hidden bg-slate-950 mt-0.5">
                            <img src={d.photoUrls[0]} alt="attached defect" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        ) : (
                          <div className="h-12 w-12 shrink-0 rounded border border-dashed border-slate-800 flex items-center justify-center bg-slate-950/40 mt-0.5">
                            <ImageIcon className="h-5 w-5 text-slate-700" />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className={`h-1.5 w-1.5 rounded-full ${indicatorColor}`} />
                            <h4 className="text-xs font-bold text-white">
                              No.{d.no} - {d.type}
                            </h4>
                          </div>
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
      )}

      {activeTab === 'drawing' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 max-w-2xl mx-auto">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-sky-400" />
              현장 도면 등록 및 변경
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              현장에 마킹할 도면을 등록합니다. PDF 또는 고해상도 이미지 파일(JPG, PNG)을 모두 완벽하게 해상도 손실 없이 지원합니다.
            </p>
          </div>

          {uploadError && (
            <div className="p-3 bg-red-950/40 border border-red-900/50 text-red-400 rounded-lg text-xs font-semibold">
              ⚠️ {uploadError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                도면 파일 선택 (PDF 또는 이미지)
              </label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <label className="cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-3 border border-transparent text-sm font-bold rounded-xl text-slate-950 bg-sky-400 hover:bg-sky-300 transition-colors">
                  <ImageIcon className="h-4.5 w-4.5" />
                  파일 불러오기
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/jpg, application/pdf"
                    onChange={handleDrawingUploadInInspector}
                    className="hidden"
                    disabled={isUploading}
                  />
                </label>
                <span className="text-xs text-slate-400 truncate max-w-xs sm:max-w-md bg-slate-950 px-3 py-2 rounded-lg border border-slate-850">
                  {project.drawingName ? `등록된 도면: ${project.drawingName}` : '등록된 도면 파일이 없습니다. (A4 표준 격자 권역 기본 렌더링)'}
                </span>
              </div>
            </div>

            {isUploading && (
              <div className="p-4 bg-slate-950/60 border border-slate-850 rounded-lg text-xs text-slate-300 animate-pulse flex items-center gap-2">
                <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-sky-400 border-t-transparent"></span>
                <span>파일 처리 중... (Vite 압축 렌더러 및 PDF 백터 고정밀 변환 엔진 동작 중)</span>
              </div>
            )}

            <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl text-xs space-y-2 text-slate-400 leading-relaxed">
              <p className="font-bold text-slate-300 flex items-center gap-1">
                📌 도면 마킹 최적화 가이드
              </p>
              <ul className="list-disc list-inside space-y-1.5">
                <li><strong>PDF 도면 완벽 호환</strong>: PDF 포맷 설계 도면 업로드 시 첫째 장을 디스크 왜곡이나 스케일 깨짐 방지를 위해 원본 비율 그대로 백터 변환합니다.</li>
                <li><strong>자동 픽셀 스케일 보정</strong>: 마킹한 좌표(% 단위)는 도면 파일 크기나 화면 대역폭의 영향을 받지 않고 절대값으로 견고하게 유지됩니다.</li>
                <li><strong>데이터 절약</strong>: 도면은 캔버스 압축 최적화(Quality 0.8)를 통해 데이터 사용량을 절감합니다.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'table' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5 print:bg-white print:text-black print:border-none print:p-0">
          <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Printer className="h-5 w-5 text-amber-400" />
                현장 안전점검 손상현황표 대장
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                기입된 결함 점검 수치 기준 종합대장입니다. 아래 테이블이 A4 규격 레이아웃으로 프린트 출력됩니다.
              </p>
            </div>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-1.5 px-4.5 py-3 text-xs font-bold rounded-xl text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors shadow-md transform active:scale-95 cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              손상현황표 즉시 인쇄 (PDF 저장)
            </button>
          </div>

          {/* High Fidelity Table Layout optimized also for Paper printouts */}
          <div className="overflow-x-auto border border-slate-800 rounded-lg print:border-slate-900">
            <table className="w-full text-left border-collapse text-xs print:text-slate-950">
              <thead>
                <tr className="bg-slate-950 text-slate-300 uppercase tracking-wider font-bold border-b border-slate-800 print:bg-slate-100 print:text-black print:border-slate-900">
                  <th className="p-3.5 text-center w-[10%] border-r border-slate-800/80 print:border-slate-300">No.</th>
                  <th className="p-3.5 w-[20%] border-r border-slate-800/80 print:border-slate-300">시설물명</th>
                  <th className="p-3.5 w-[22%] border-r border-slate-800/80 print:border-slate-300">발생 위치 (층/부재)</th>
                  <th className="p-3.5 w-[28%] border-r border-slate-800/80 print:border-slate-300">손상명 및 점검 규격</th>
                  <th className="p-3.5 w-[20%]">추정 원인</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40 text-slate-200 print:bg-transparent print:text-black print:divide-slate-300">
                {project.damages.map((d) => {
                  const sizeText = d.type.includes('균열')
                    ? `폭 ${d.widthVal.toFixed(1)}mm × 길이 ${d.lengthVal.toFixed(1)}m`
                    : `가로 ${d.widthVal.toFixed(1)}m × 세로 ${d.lengthVal.toFixed(1)}m` + (d.areaVal ? ` (면적 ${d.areaVal.toFixed(1)}㎡)` : '');
                  
                  return (
                    <tr key={d.id} className="hover:bg-slate-850/50 transition-colors">
                      <td className="p-3.5 text-center font-mono font-bold text-emerald-400 print:text-black border-r border-slate-800/80 print:border-slate-300">No.{d.no}</td>
                      <td className="p-3.5 font-medium text-white print:text-black border-r border-slate-800/80 print:border-slate-300">{project.name}</td>
                      <td className="p-3.5 border-r border-slate-800/80 print:border-slate-300">{d.floor} / {d.member}</td>
                      <td className="p-3.5 font-mono border-r border-slate-800/80 print:border-slate-300">
                        <span className="inline-block px-2 py-0.5 text-[10px] bg-slate-800 text-slate-300 border border-slate-750 rounded mr-2 font-sans font-semibold print:bg-slate-100 print:text-slate-900 print:border-slate-300">
                          {d.type}
                        </span>
                        {sizeText}
                      </td>
                      <td className="p-3.5 text-slate-400 print:text-slate-900 break-words">
                        {d.cause === '기타 직접입력' ? d.customCause : d.cause}
                      </td>
                    </tr>
                  );
                })}
                {project.damages.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-slate-500 font-sans">
                      조사된 안전점검 손상 이력이 존재하지 않습니다. 첫 번째 탭에서 점검 데이터를 기입하여 주십시오.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
