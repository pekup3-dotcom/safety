/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Project, BaseInspectionSettings, getComputedFloors } from './types';
import { Dashboard } from './components/Dashboard';
import { SiteInspector } from './components/SiteInspector';
import { ReportViewer } from './components/ReportViewer';
import { Shield, HelpCircle } from 'lucide-react';
import { generateId } from './utils/uuid';

const LOCAL_STORAGE_KEY = 'safety_inspection_projects_v1';

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, _setActiveProjectId] = useState<string | null>(null);
  const activeProjectIdRef = useRef<string | null>(null);

  const setActiveProjectId = (id: string | null) => {
    _setActiveProjectId(id);
    activeProjectIdRef.current = id;
  };

  const [showReport, setShowReport] = useState<boolean>(false);

  // Persistent Global Configuration Setup (Defaults populated initially)
  const [baseSettings, setBaseSettings] = useState<BaseInspectionSettings>({
    facilitiesText: '테크노타워A, 주차빌딩, 복지동',
    basementFloors: 2,
    abovegroundFloors: 5,
    phFloors: 1,
    inspectionCompany: '(주)중앙 건설안전 진단원'
  });

  // Load base settings from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('safety_inspection_base_settings_v3');
      if (saved) {
        setBaseSettings(JSON.parse(saved));
      }
    } catch (_) {}
  }, []);

  const handleSaveBaseSettings = (settings: BaseInspectionSettings) => {
    setBaseSettings(settings);
    try {
      localStorage.setItem('safety_inspection_base_settings_v3', JSON.stringify(settings));
    } catch (_) {}
  };

  // High fidelity default demo project to guide the user instantly
  const demoProject: Project = {
    id: 'demo-project-id',
    name: '테크노타워A [지상 3층]',
    inspectionCompany: '(주)중앙 건설안전 진단원',
    facilitiesRaw: '테크노타워A',
    facilitiesList: ['테크노타워A'],
    basementFloors: 2,
    abovegroundFloors: 5,
    phFloors: 1,
    status: '조사 중',
    floorOptions: [
      'PH 1층', '지상 5층', '지상 4층', '지상 3층', '지상 2층', '지상 1층',
      '지하 1층', '지하 2층'
    ],
    drawingUrl: null, // Grid blueprint outline will auto render
    drawingName: null,
    damages: [
      {
        id: 'dmg-sample-1',
        no: 1,
        type: '균열',
        cause: '콘크리트 건조수축 (Drying Shrinkage)',
        floor: '지상 3층',
        member: '벽체',
        widthVal: 0.3,
        lengthVal: 1.5,
        photoUrls: [],
        marker: { x: 35.5, y: 30.2 }
      },
      {
        id: 'dmg-sample-2',
        no: 2,
        type: '누수',
        cause: '방수층 파손 및 열화 (Waterproof Layer Damage)',
        floor: '지하 1층',
        member: '슬래브',
        widthVal: 1.2,
        lengthVal: 0.8,
        areaVal: 1.0,
        photoUrls: [],
        marker: { x: 36.3, y: 31.1 } // Extremely close marker to trigger automatic snap / grouping!
      },
      {
        id: 'dmg-sample-3',
        no: 3,
        type: '백화',
        cause: '배면 누수 및 만성 습기 유지 (Chronic Backing Moisture)',
        floor: '지하 2층',
        member: '기둥',
        widthVal: 0.5,
        lengthVal: 1.2,
        areaVal: 0.6,
        photoUrls: [],
        marker: { x: 70.0, y: 55.4 }
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Step 1: Initialize local storage cache immediately for fast screen render
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProjects(parsed);
        } else {
          setProjects([demoProject]);
        }
      } else {
        setProjects([demoProject]);
      }
    } catch (err) {
      console.warn("Cached local projects parse error:", err);
      setProjects([demoProject]);
    }
  }, []);

  // Newly simplified project creation handler, creating a single project immediately
  const handleCreateProject = () => {
    const parsedFacilities = baseSettings.facilitiesText
      .split(',')
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    const firstFacility = parsedFacilities[0] || '신규 현장';
    const projName = parsedFacilities.length > 1
      ? `${firstFacility} 외 ${parsedFacilities.length - 1}개소`
      : firstFacility;

    const computedOptions = getComputedFloors(
      baseSettings.basementFloors,
      baseSettings.abovegroundFloors,
      baseSettings.phFloors
    );

    const newProj: Project = {
      id: generateId(),
      name: projName,
      inspectionCompany: baseSettings.inspectionCompany,
      facilitiesRaw: baseSettings.facilitiesText,
      facilitiesList: parsedFacilities,
      basementFloors: baseSettings.basementFloors,
      abovegroundFloors: baseSettings.abovegroundFloors,
      phFloors: baseSettings.phFloors,
      status: '조사 중',
      floorOptions: computedOptions,
      drawingUrl: null,
      drawingName: null,
      damages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Optimistic local state updater to prevent stale closure bugs
    setProjects((prev) => {
      const updated = [newProj, ...prev];
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });

    setActiveProjectId(newProj.id);
  };

  const handleToggleProjectStatus = (id: string) => {
    setProjects((prev) => {
      const updated = prev.map((p) => {
        if (p.id === id) {
          const nextStatus = p.status === '조사 완료' ? '조사 중' : '조사 완료';
          return {
            ...p,
            status: nextStatus,
            updatedAt: new Date().toISOString(),
          };
        }
        return p;
      });
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  };

  const handleUpdateProject = (updatedProject: Project) => {
    // Make sure timestamps change properly
    const updatedWithTick: Project = {
      ...updatedProject,
      updatedAt: new Date().toISOString()
    };

    // Optimistic local state updater to prevent stale closure bugs
    setProjects((prev) => {
      const nextList = prev.map((p) => (p.id === updatedWithTick.id ? updatedWithTick : p));
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextList));
      } catch (_) {}
      return nextList;
    });
  };

  const handleDeleteProject = (id: string) => {
    if (confirm("정말로 이 현장 조사의 모든 데이터, 도면 도락, 사진대지 기록을 영구 삭제하시겠습니까?")) {
      // Optimistic local state updater to prevent stale closure bugs
      setProjects((prev) => {
        const nextList = prev.filter((p) => p.id !== id);
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextList));
        } catch (_) {}
        return nextList;
      });

      if (activeProjectIdRef.current === id) {
        setActiveProjectId(null);
      }
    }
  };

  const activeProject = projects.find((p) => p.id === activeProjectId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between select-none">
      
      {/* Brand Header Section */}
      <header className="bg-slate-900/85 border-b border-slate-800/80 sticky top-0 z-40 backdrop-blur-md no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
              <Shield className="h-5.5 w-5.5" />
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight text-white block">
                AEG Corp. Class1
              </span>
              <span className="text-[10px] font-mono text-emerald-400 block tracking-wider uppercase -mt-0.5">
                SMART SAFETY DIAGNOSIS SYSTEM
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 font-mono">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-emerald-400 text-[10px] hidden sm:inline">로컬 저장 모드 활성</span>
            </div>
            
            <a
              href="#help"
              onClick={(ev) => {
                ev.preventDefault();
                alert("본 시스템은 브라우저 내 안전 로컬 전용 저장소(localStorage)를 통해 데이터를 즉각 오프라인 저장용 메모리에 동기화 및 관리합니다. 이미지 등 대용량 미디어는 캔버스 조절 압축기(Quality: 0.6)를 사용하여 디스크 효율을 최적화하고 있습니다.");
              }}
              className="text-slate-400 hover:text-white flex items-center gap-1 font-semibold"
            >
              <HelpCircle className="h-4 w-4" />
              도움말
            </a>
          </div>
        </div>
      </header>

      {/* Main Container routes switch */}
      <main className="flex-grow no-print">
        {activeProject ? (
          <SiteInspector
            project={activeProject}
            onUpdateProject={handleUpdateProject}
            onBackToDashboard={() => {
              setActiveProjectId(null);
              setShowReport(false);
            }}
            onOpenReport={() => setShowReport(true)}
          />
        ) : (
          <Dashboard
            projects={projects}
            baseSettings={baseSettings}
            onSaveBaseSettings={handleSaveBaseSettings}
            onCreateProject={handleCreateProject}
            onSelectProject={(id) => setActiveProjectId(id)}
            onDeleteProject={handleDeleteProject}
            onToggleProjectStatus={handleToggleProjectStatus}
          />
        )}
      </main>

      {/* Printable custom engine Overlay portal */}
      {showReport && activeProject && (
        <ReportViewer
          project={activeProject}
          onClose={() => setShowReport(false)}
        />
      )}

      {/* Humble aesthetic Engineering Footer with zero telemetry ads */}
      <footer className="bg-slate-950 border-t border-slate-900 py-6 mt-12 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center sm:flex sm:justify-between sm:items-center text-xs text-slate-500">
          <p className="font-sans leading-relaxed">
            © 22대 교육·산업 시설 안전점검 표준서식 기준제정안 준수 - 공인 안전보고서 자동 생성형
          </p>
          <p className="font-mono mt-2 sm:mt-0 tracking-wide uppercase">
            Smart Construction Safe-Infill Systems | Offline Local Engine Active
          </p>
        </div>
      </footer>
    </div>
  );
}
