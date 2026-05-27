/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Project } from '../types';
import { FolderPlus, Clock, Building2, Layers, Trash2, ArrowRight } from 'lucide-react';

interface DashboardProps {
  projects: Project[];
  onCreateProject: (project: Omit<Project, 'id' | 'damages' | 'createdAt' | 'updatedAt'>) => void;
  onSelectProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  projects,
  onCreateProject,
  onSelectProject,
  onDeleteProject,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [facilityRaw, setFacilityRaw] = useState('');
  const [inspectionCompany, setInspectionCompany] = useState('');
  const [basementFloors, setBasementFloors] = useState<number>(1);
  const [abovegroundFloors, setAbovegroundFloors] = useState<number>(3);
  const [drawingData, setDrawingData] = useState<string | null>(null);
  const [drawingName, setDrawingName] = useState<string | null>(null);
  const [uiError, setUiError] = useState<string | null>(null);

  const handleDrawingUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1.8 * 1024 * 1024) {
      alert("도면 용량이 너무 큽니다. 데이터 안전 보관을 위해 1.8MB 이하의 이미지를 사용해 주십시오.");
      return;
    }

    setDrawingName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setDrawingData(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!facilityRaw.trim()) {
      setUiError('최소 하나의 시설물명을 입력해주세요.');
      return;
    }
    if (!inspectionCompany.trim()) {
      setUiError('점검업체명을 입력해주세요.');
      return;
    }

    const facilitiesList = facilityRaw
      .split(',')
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    // Compute floor list
    const computedFloors: string[] = [];
    for (let i = abovegroundFloors; i >= 1; i--) {
      computedFloors.push(`지상${i}층`);
    }
    for (let i = 1; i <= basementFloors; i++) {
      computedFloors.push(`지하${i}층`);
    }

    onCreateProject({
      name: facilitiesList[0] || '미지정 시설물',
      inspectionCompany: inspectionCompany,
      facilitiesRaw: facilityRaw,
      facilitiesList: facilitiesList,
      basementFloors: basementFloors,
      abovegroundFloors: abovegroundFloors,
      floorOptions: computedFloors,
      drawingUrl: drawingData,
      drawingName: drawingName,
    });

    // Reset fields
    setFacilityRaw('');
    setInspectionCompany('');
    setBasementFloors(1);
    setAbovegroundFloors(3);
    setDrawingData(null);
    setDrawingName(null);
    setUiError(null);
    setShowCreateModal(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Upper Brand Section */}
      <div className="md:flex md:items-center md:justify-between border-b border-slate-700/65 pb-6 mb-8">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-extrabold font-sans text-white tracking-tight sm:text-4xl">
            시설물 안전 진단 시스템
          </h1>
          <p className="mt-2 text-sm text-slate-400 font-sans leading-relaxed">
            안드로이드 태블릿 및 스마트폰 모바일에 최적화된 손상조사 및 사진대지 A4 즉시 출력 솔루션
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex">
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-5 py-3 border border-transparent text-sm font-semibold rounded-xl text-slate-950 bg-emerald-400 hover:bg-emerald-300 active:bg-emerald-500 shadow-md transition-all duration-150 transform hover:-translate-y-0.5"
            id="btn-create-site"
          >
            <FolderPlus className="h-5 w-5" />
            새 현장조사 등록
          </button>
        </div>
      </div>

      {/* Main projects grid layout */}
      {projects.length === 0 ? (
        <div className="text-center py-20 bg-slate-800/20 border border-slate-800/80 rounded-2xl p-8 shadow-inner">
          <Building2 className="mx-auto h-14 w-14 text-slate-600 mb-4 animate-pulse" />
          <h3 className="text-lg font-bold text-slate-200">진행 중인 현장 조사가 없습니다</h3>
          <p className="mt-2 text-sm text-slate-400 max-w-sm mx-auto">
            우측 상단의 '새 현장조사 등록' 버튼을 터치하여 현장 시설물의 도면을 등록하고 세밀한 안전 점검을 시작해 보십시오.
          </p>
          <div className="mt-6">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 px-4.5 py-2.5 text-xs font-semibold text-emerald-400 bg-emerald-950/20 hover:bg-emerald-950/30 border border-emerald-900/50 rounded-lg transition-colors"
            >
              현장 만들기 첫걸음
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((proj) => (
            <div
              key={proj.id}
              className="relative group bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-200 flex flex-col justify-between"
              id={`project-card-${proj.id}`}
            >
              <div className="p-5 flex-1 cursor-pointer" onClick={() => onSelectProject(proj.id)}>
                {/* Upper row */}
                <div className="flex justify-between items-start gap-3 mb-3">
                  <div className="p-2 sm:p-2.5 rounded-lg bg-slate-800 text-emerald-400">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                    점검항목 {proj.damages.length}건
                  </span>
                </div>

                {/* Facilities meta */}
                <h3 className="text-lg font-extrabold text-white tracking-tight group-hover:text-emerald-400 transition-colors">
                  {proj.name}
                </h3>
                
                <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                  시설 목록: {proj.facilitiesList.join(', ')}
                </p>

                {/* Floors info */}
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400 border-t border-slate-800/80 pt-4">
                  <span className="flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5 text-slate-500" />
                    지하 {proj.basementFloors}층 ~ 지상 {proj.abovegroundFloors}층
                  </span>
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5 text-slate-500" />
                    {proj.inspectionCompany}
                  </span>
                </div>
              </div>

              {/* Card Footer controls */}
              <div className="px-5 py-3.5 bg-slate-950/40 border-t border-slate-800/80 flex justify-between items-center text-xs">
                <span className="text-slate-500 flex items-center gap-1 font-mono">
                  <Clock className="h-3.5 w-3.5 text-slate-600" />
                  {new Date(proj.updatedAt).toLocaleDateString()} 수정됨
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => onDeleteProject(proj.id)}
                    className="p-1 px-2.5 font-medium rounded text-red-400 hover:text-red-300 hover:bg-red-950/30 border border-transparent hover:border-red-900/40 transition-all flex items-center gap-1"
                    title="현장 삭제"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    삭제
                  </button>
                  <button
                    onClick={() => onSelectProject(proj.id)}
                    className="p-1.5 px-3 font-semibold rounded text-emerald-400 hover:text-emerald-300 bg-emerald-950/20 hover:bg-emerald-950/40 border border-emerald-900/60 transition-colors flex items-center gap-1"
                  >
                    이어서 작성
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/*  새 현장조사 등록 모달 */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setShowCreateModal(false)}></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            {/* Modal Body */}
            <div className="inline-block align-bottom bg-slate-900 border border-slate-800 rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleFormSubmit}>
                <div className="px-6 pt-6 pb-4 bg-slate-850 border-b border-slate-800/80">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <FolderPlus className="h-5 w-5 text-emerald-400" />
                    새로운 점검 현장조사 만들기
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    보고서 출력 및 도면 오버레이에 사용되는 기본 범위를 지정합니다.
                  </p>
                </div>

                <div className="p-6 space-y-4">
                  {uiError && (
                    <div className="p-3 text-xs font-semibold text-red-400 bg-red-950/20 border border-red-900/50 rounded-lg">
                      ⚠️ {uiError}
                    </div>
                  )}

                  {/* Facilities Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                      시설물명 목록 (쉼표 구분) <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-emerald-500 rounded-lg text-slate-100 outline-none transition-colors"
                      placeholder="예시: 본관동, 별관동, 지하주차장"
                      value={facilityRaw}
                      onChange={(e) => setFacilityRaw(e.target.value)}
                      required
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      여러 시설물은 쉼표(,)로 구분해 주세요. 첫째 시설물이 대표 현장명이 됩니다.
                    </p>
                  </div>

                  {/* Inspector name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                      점검 업체명 <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-emerald-500 rounded-lg text-slate-100 outline-none transition-colors"
                      placeholder="예시: (주)한국구조안전 기술원"
                      value={inspectionCompany}
                      onChange={(e) => setInspectionCompany(e.target.value)}
                      required
                    />
                  </div>

                  {/* Floor settings bounds row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                        지상 층수 권역 <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="80"
                        className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 outline-none"
                        value={abovegroundFloors}
                        onChange={(e) => setAbovegroundFloors(parseInt(e.target.value) || 1)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                        지하 층수 권역 <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="15"
                        className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 outline-none"
                        value={basementFloors}
                        onChange={(e) => setBasementFloors(parseInt(e.target.value) >= 0 ? parseInt(e.target.value) : 0)}
                        required
                      />
                    </div>
                  </div>

                  {/* Layout Attachment Drawing upload option */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                      건물 평면도 및 도면 첨부 (선택사항, 최대 1.8MB)
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 border border-slate-700 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors">
                        파일 찾기
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg"
                          onChange={handleDrawingUpload}
                          className="hidden"
                        />
                      </label>
                      <span className="text-xs text-slate-400 truncate max-w-xs">
                        {drawingName ? drawingName : '등록된 도면이 없습니다 (격자 자동생성)'}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">
                      도면 이미지가 있으면 캔버스 위치에 정확하게 손상이 사상 마킹됩니다.
                    </p>
                  </div>
                </div>

                {/* Submits buttons */}
                <div className="px-6 py-4 bg-slate-950/60 border-t border-slate-800/80 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2.5 text-xs font-semibold rounded-lg text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-xs font-bold rounded-lg text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-colors"
                  >
                    점검 생성 및 시작
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
