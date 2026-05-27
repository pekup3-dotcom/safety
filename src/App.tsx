/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Project } from './types';
import { Dashboard } from './components/Dashboard';
import { SiteInspector } from './components/SiteInspector';
import { ReportViewer } from './components/ReportViewer';
import { Shield, Building2, HelpCircle } from 'lucide-react';
import { generateId } from './utils/uuid';

const LOCAL_STORAGE_KEY = 'safety_inspection_projects_v1';

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [showReport, setShowReport] = useState<boolean>(false);

  // Initialize and load inspections from live Express server with SSE subscription
  useEffect(() => {
    // 1. Initial state restore from local storage cache
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProjects(parsed);
        }
      }
    } catch (err) {
      console.error("Local storage recovery check throttled:", err);
    }

    // 2. Load latest state from server resting API
    const fetchLatestFromServer = async () => {
      try {
        const res = await fetch('/api/projects');
        if (res.ok) {
          const remoteData = await res.json();
          if (Array.isArray(remoteData)) {
            setProjects(remoteData);
            try {
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(remoteData));
            } catch (_) {}
          }
        }
      } catch (err) {
        console.warn("Express server projects load offline/unreachable:", err);
      }
    };

    fetchLatestFromServer();

    // 3. Establish robust real-time Server-Sent Events (SSE) subscription stream
    let eventSource: EventSource | null = null;
    let fallbackInterval: any = null;

    const startStreaming = () => {
      eventSource = new EventSource('/api/projects/stream');

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'SYNC' || payload.type === 'UPDATE') {
            setProjects(payload.data);
            try {
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload.data));
            } catch (_) {}
          }
        } catch (err) {
          console.error("Event payload parse fail:", err);
        }
      };

      eventSource.onerror = (err) => {
        console.warn("SSE connection closed or unavailable. Initiating passive polling fallbacks...", err);
        if (eventSource) {
          eventSource.close();
        }
        
        // Spin up passive poll fallback (once every 3 seconds) if SSE stream is suspended by iframe/proxy
        if (!fallbackInterval) {
          fallbackInterval = setInterval(fetchLatestFromServer, 3000);
        }
      };
    };

    startStreaming();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
    };
  }, []);

  // Sync to local storage on edits with try-catch guard rails
  const handleSaveToLocalStorage = async (updatedList: Project[]) => {
    setProjects(updatedList);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList));
    } catch (error) {
      console.error("Local storage save throttled. Likely disk space threshold.", error);
    }
  };

  const syncProjectToServer = async (proj: Project) => {
    try {
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proj)
      });
    } catch (err) {
      console.error("Express synchronization write failed:", err);
    }
  };

  const handleCreateProject = async (cfg: Omit<Project, 'id' | 'damages' | 'createdAt' | 'updatedAt'>) => {
    const newProj: Project = {
      ...cfg,
      id: generateId(), // Safe ID generator fallback
      damages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const nextList = [newProj, ...projects];
    handleSaveToLocalStorage(nextList);
    setActiveProjectId(newProj.id);

    // Sync state synchronously to Express database backplane
    await syncProjectToServer(newProj);
  };

  const handleUpdateProject = async (updated: Project) => {
    const nextList = projects.map((p) => (p.id === updated.id ? updated : p));
    handleSaveToLocalStorage(nextList);

    // Send delta save to server
    await syncProjectToServer(updated);
  };

  const handleDeleteProject = async (id: string) => {
    if (confirm("정말로 이 현장 조사의 모든 데이터, 도면 도락, 사진대지 기록을 영구 삭제하시겠습니까?")) {
      const nextList = projects.filter((p) => p.id !== id);
      handleSaveToLocalStorage(nextList);
      if (activeProjectId === id) {
        setActiveProjectId(null);
      }

      // Sync delete to Express database backplane
      try {
        await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      } catch (err) {
        console.error("Delete synchronization write failed:", err);
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
                SMART 안전진단 엔진
              </span>
              <span className="text-[10px] font-mono text-slate-400 block tracking-wider uppercase -mt-0.5">
                Damages and Photo Sheet Generator
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="hidden md:flex items-center gap-1 text-slate-400 font-mono">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>현장 오프라인 전용</span>
            </div>
            <a
              href="#help"
              onClick={(ev) => {
                ev.preventDefault();
                alert("본 시스템은 별도의 서버 데이터 전송 없이 기기 내부 로컬 저장소(localStorage)에 안전하게 임시 저장되는 독립형 프로그램입니다. 원본 이미지의 용량은 캔버스 압축 알고리즘을 통해 자동 조절되므로 메모리 크래시 없이 장시간 사용이 가능합니다.");
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
            onCreateProject={handleCreateProject}
            onSelectProject={(id) => setActiveProjectId(id)}
            onDeleteProject={handleDeleteProject}
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
            Smart Construction Safe-Infill Systems
          </p>
        </div>
      </footer>
    </div>
  );
}
