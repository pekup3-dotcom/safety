/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Project, BaseInspectionSettings, getComputedFloors } from '../types';
import { Clock, Building2, Layers, Trash2, ArrowRight, Settings2, PlusCircle, CheckCircle2, PlayCircle } from 'lucide-react';

interface DashboardProps {
  projects: Project[];
  baseSettings: BaseInspectionSettings;
  onSaveBaseSettings: (settings: BaseInspectionSettings) => void;
  onCreateProject: () => void;
  onSelectProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onToggleProjectStatus: (id: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  projects,
  baseSettings,
  onSaveBaseSettings,
  onCreateProject,
  onSelectProject,
  onDeleteProject,
  onToggleProjectStatus,
}) => {
  // Base settings edit state
  const [facilitiesText, setFacilitiesText] = useState(baseSettings.facilitiesText);
  const [basementFloors, setBasementFloors] = useState<number>(baseSettings.basementFloors);
  const [abovegroundFloors, setAbovegroundFloors] = useState<number>(baseSettings.abovegroundFloors);
  const [phFloors, setPhFloors] = useState<number>(baseSettings.phFloors);
  const [inspectionCompany, setInspectionCompany] = useState(baseSettings.inspectionCompany);
  
  const [creationError, setCreationError] = useState<string | null>(null);

  // Sync settings whenever parent settings change
  useEffect(() => {
    setFacilitiesText(baseSettings.facilitiesText);
    setBasementFloors(baseSettings.basementFloors);
    setAbovegroundFloors(baseSettings.abovegroundFloors);
    setPhFloors(baseSettings.phFloors);
    setInspectionCompany(baseSettings.inspectionCompany);
  }, [baseSettings]);

  const handleSaveAndCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!facilitiesText.trim()) {
      alert('최소 하나의 시설물명을 기입해주십시오.');
      return;
    }
    
    // 1. Silent Save base settings
    const updatedSettings: BaseInspectionSettings = {
      facilitiesText,
      basementFloors,
      abovegroundFloors,
      phFloors,
      inspectionCompany: inspectionCompany || '미지정 점검업체',
    };
    onSaveBaseSettings(updatedSettings);

    const parsed = facilitiesText
      .split(',')
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    const firstFacility = parsed[0] || '신규 현장';
    const projName = parsed.length > 1
      ? `${firstFacility} 외 ${parsed.length - 1}개소`
      : firstFacility;

    // Check duplication
    const isDup = projects.some(p => p.name === projName);
    if (isDup) {
      setCreationError('이미 동일한 이름의 현장조사가 목록에 등록되어 있습니다.');
      return;
    }

    setCreationError(null);
    
    // Create Project in App.tsx
    onCreateProject();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Brand Title Section */}
      <div className="border-b border-slate-800/80 pb-6 mb-8">
        <h1 className="text-3xl font-extrabold font-sans text-white tracking-tight sm:text-4xl text-emerald-400">
          AEG Corp. Class1
        </h1>
        <p className="mt-2 text-sm text-slate-400 font-sans leading-relaxed">
          공학적 정량화 기반 스마트 건설안전 점검 및 도면 마커·정밀 서식 자동 연동 시스템
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Integrated Settings and Direct Action Inputs */}
        <div className="lg:col-span-5 space-y-6">
          
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-4 border-b border-slate-800 pb-2">
              <Settings2 className="h-4.5 w-4.5 text-emerald-400" />
              조사 정보 등록 및 신규 점검 시작
            </h2>
            <form onSubmit={handleSaveAndCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-400 mb-1 leading-tight">
                  점검대상 시설물 목록 (쉼표로 구분하여 여러 개 입력)
                </label>
                <input
                  type="text"
                  value={facilitiesText}
                  onChange={(e) => {
                    setFacilitiesText(e.target.value);
                    setCreationError(null);
                  }}
                  placeholder="예: 가동, 나동, 주차타워"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded px-3 py-2 text-white font-medium"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-400 mb-1">지하 규모 (층수)</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={basementFloors}
                    onChange={(e) => setBasementFloors(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded px-3 py-2 text-white font-mono text-center"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-400 mb-1">지상 규모 (층수)</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={abovegroundFloors}
                    onChange={(e) => setAbovegroundFloors(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded px-3 py-2 text-white font-mono text-center"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-400 mb-1">PH(옥탑) 규모 (층수)</label>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    value={phFloors}
                    onChange={(e) => setPhFloors(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded px-3 py-2 text-white font-mono text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-400 mb-1">안전 검사업체명</label>
                <input
                  type="text"
                  value={inspectionCompany}
                  onChange={(e) => setInspectionCompany(e.target.value)}
                  placeholder="예: (주)한국건설진단평가"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded px-3 py-2 text-white font-medium"
                />
              </div>

              {creationError && (
                <p className="text-red-400 text-[11px] bg-red-950/20 border border-red-900/40 p-2.5 rounded leading-relaxed">
                  ⚠️ {creationError}
                </p>
              )}

              <button
                type="submit"
                disabled={!facilitiesText.trim()}
                className="w-full mt-2 inline-flex justify-center items-center gap-1.5 px-4 py-3 bg-emerald-400 hover:bg-emerald-300 disabled:bg-slate-800 disabled:text-slate-600 active:bg-emerald-500 text-slate-950 font-extrabold rounded-lg shadow-md text-xs cursor-pointer transition-all transform hover:-translate-y-0.5 active:translate-y-0"
              >
                기본설정 저장 및 신규 점검 시작
                <ArrowRight className="h-4 w-4 text-slate-950" />
              </button>
            </form>
          </div>

        </div>

        {/* Right Column: List of Current Registered Investigations */}
        <div className="lg:col-span-7 space-y-4">
          
          <div className="bg-slate-900/80 border border-slate-850 rounded-xl p-5 shadow-lg min-h-[400px] flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Building2 className="h-4.5 w-4.5 text-indigo-400" />
                  조사 진행중인 시설물 목록 ({projects.length})
                </h2>
                <span className="text-[10px] font-mono text-slate-500">
                  각 행의 상태 뱃지를 터치해 손쉽게 완료 여부를 토글할 수 있습니다.
                </span>
              </div>

              {/* Grid / list */}
              {projects.length === 0 ? (
                <div className="text-center py-16 flex flex-col items-center justify-center">
                  <Building2 className="h-12 w-12 text-slate-700 mb-3 animate-pulse" />
                  <p className="text-sm text-slate-400 font-bold">등록된 조사 현장이 없습니다.</p>
                  <p className="text-xs text-slate-500 mt-1.5 max-w-xs leading-relaxed text-center">
                    왼쪽의 가이드 패널에서 조사할 시설물명과 조사층수를 지정하여 신규 점검조사 대장을 활성화 시키십시오.
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {projects.map((proj) => {
                    const isCompleted = proj.status === '조사 완료';
                    return (
                      <div
                        key={proj.id}
                        className="bg-slate-950 border border-slate-800 hover:border-slate-700/80 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all duration-150"
                      >
                        <div className="space-y-1">
                          {/* Title element */}
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-extrabold text-white tracking-tight hover:text-emerald-400 cursor-pointer transition-colors" onClick={() => onSelectProject(proj.id)}>
                              {proj.name}
                            </h3>
                            
                            {/* Toggleable Status badge */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleProjectStatus(proj.id);
                              }}
                              className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition-all duration-100 flex items-center gap-1 cursor-pointer border ${
                                isCompleted
                                  ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900/70'
                                  : 'bg-amber-950/30 text-amber-400 border-amber-900/70'
                              }`}
                              title="누르면 상태를 변경합니다"
                            >
                              {isCompleted ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3 inline-block" />
                                  조사 완료
                                </>
                              ) : (
                                <>
                                  <PlayCircle className="h-3 w-3 inline-block animate-spin" style={{ animationDuration: '3s' }} />
                                  조사 중
                                </>
                              )}
                            </button>
                          </div>

                          {/* Sub elements details */}
                          <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-slate-500 text-[11px] font-mono leading-tight">
                            <span className="flex items-center gap-1">
                              <Layers className="h-3 w-3 text-slate-600" />
                              점검결함: {proj.damages.length}건
                            </span>
                            <span>|</span>
                            <span>업체: {proj.inspectionCompany}</span>
                          </div>
                        </div>

                        {/* Control buttons */}
                        <div className="flex items-center gap-2.5 self-end sm:self-center">
                          <button
                            onClick={() => onDeleteProject(proj.id)}
                            className="p-1 px-2.2 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-950/20 border border-transparent rounded cursor-pointer transition-colors"
                            title="영구 삭제"
                          >
                            <Trash2 className="h-3.5 w-3.5 inline mr-0.5" />
                            삭제
                          </button>
                          <button
                            onClick={() => onSelectProject(proj.id)}
                            className="px-3.5 py-1.5 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-950/30 hover:bg-emerald-950/50 border border-emerald-900/60 rounded flex items-center gap-1 cursor-pointer transition-all"
                          >
                            이어서 조사
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* Minimal notice */}
            <div className="mt-8 border-t border-slate-850/60 pt-3 text-[10px] font-sans text-slate-500 leading-tight">
              💡 <strong>유의 사항:</strong> 현장 기본 설정값을 갱신하더라도 이미 진행중이던 조사 리스트는 이전 설정으로 안전 상태가 단절 없이 그대로 보존됩니다. 신규 조사 대상 지정 시에만 즉각 업데이트된 기본값이 반영됩니다.
            </div>
          </div>
          
        </div>

      </div>

    </div>
  );
};
