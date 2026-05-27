/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Project } from './types';
import { Dashboard } from './components/Dashboard';
import { SiteInspector } from './components/SiteInspector';
import { ReportViewer } from './components/ReportViewer';
import { Shield, HelpCircle, Wifi, WifiOff } from 'lucide-react';
import { generateId } from './utils/uuid';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  deleteDoc, 
  getDocs,
  query,
  orderBy
} from 'firebase/firestore';
import { 
  initializeAuthSync, 
  db, 
  handleFirestoreError, 
  OperationType 
} from './utils/firebase';

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
  const [isSyncing, setIsSyncing] = useState<boolean>(true);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [isLocalMode, setIsLocalMode] = useState<boolean>(false);

  // High fidelity default demo project to guide the user instantly
  const demoProject: Project = {
    id: 'demo-project-id',
    name: '서울가산디지털 테크노타워',
    inspectionCompany: '(주)중앙 건설안전 진단원',
    facilitiesRaw: '테크노타워A, 주차빌딩',
    facilitiesList: ['테크노타워A', '주차빌딩'],
    basementFloors: 2,
    abovegroundFloors: 5,
    floorOptions: [
      '지상5층', '지상4층', '지상3층', '지상2층', '지상1층',
      '지하1층', '지하2층'
    ],
    drawingUrl: null, // Grid blueprint outline will auto render
    drawingName: null,
    damages: [
      {
        id: 'dmg-sample-1',
        no: 1,
        type: '균열',
        cause: '콘크리트 건조수축 (Drying Shrinkage)',
        floor: '지상3층',
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
        floor: '지하1층',
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
        floor: '지하2층',
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

  // Step 2: Bind authenticated Real-time Firebase Firestore synchronizer loop
  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;
    setIsSyncing(true);

    const unsubscribeAuth = initializeAuthSync((user) => {
      setAuthReady(true);
      setIsLocalMode(false);
      console.log("Firebase secure channel successfully mounted for user:", user.uid);

      const projectsRef = collection(db, 'projects');
      
      // Listen to collaborative real-time sync snapshot updates
      unsubscribeFirestore = onSnapshot(projectsRef, (snapshot) => {
        const liveList: Project[] = [];
        snapshot.forEach((docSnapshot) => {
          liveList.push(docSnapshot.data() as Project);
        });

        // Ensure latest updated is always at the top of lists with safe NaN dates fallback
        const sorted = liveList.sort((a, b) => {
          const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return timeB - timeA;
        });

        // Safety preservation of local active project during onSnapshot sync propagation
        setProjects((prev) => {
          const activeId = activeProjectIdRef.current;
          let merged = [...sorted];
          
          if (activeId && !merged.some((p) => p.id === activeId)) {
            const localActive = prev.find((p) => p.id === activeId);
            if (localActive) {
              merged = [localActive, ...merged];
            }
          }

          if (merged.length === 0) {
            // Seed if completely empty
            const demoRef = doc(db, 'projects', demoProject.id);
            setDoc(demoRef, demoProject).catch((err) => {
              console.error("Auto seeding demo database document failed:", err);
            });
            return [demoProject];
          }

          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
          } catch (_) {}

          return merged;
        });
        
        setIsSyncing(false);
      }, (error) => {
        console.warn("Firestore snapshot subscription failed or restricted. Falling back to local offline mode:", error);
        setIsLocalMode(true);
        setIsSyncing(false);
      });
    }, (error) => {
      console.warn("Firebase authentication auto anonymous login failed. Operating in local-only offline mode:", error);
      setIsLocalMode(true);
      setIsSyncing(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
    };
  }, []);

  // Sync state cleanly to disk / server
  const handleCreateProject = async (cfg: Omit<Project, 'id' | 'damages' | 'createdAt' | 'updatedAt'>) => {
    const newProj: Project = {
      ...cfg,
      id: generateId(),
      damages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Optimistic local state update
    const updated = [newProj, ...projects];
    setProjects(updated);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (_) {}

    setActiveProjectId(newProj.id);

    // Sync to Firestore real-time collection if active
    if (!isLocalMode) {
      try {
        const docRef = doc(db, 'projects', newProj.id);
        await setDoc(docRef, newProj);
      } catch (err) {
        console.warn("Firestore save failed. Switching to Local Offline Fallback Mode:", err);
        setIsLocalMode(true);
      }
    }
  };

  const handleUpdateProject = async (updatedProject: Project) => {
    // Make sure timestamps change properly
    const updatedWithTick: Project = {
      ...updatedProject,
      updatedAt: new Date().toISOString()
    };

    // Optimistic local state update
    const nextList = projects.map((p) => (p.id === updatedWithTick.id ? updatedWithTick : p));
    setProjects(nextList);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextList));
    } catch (_) {}

    // Sync to Firestore real-time collection if active
    if (!isLocalMode) {
      try {
        const docRef = doc(db, 'projects', updatedWithTick.id);
        await setDoc(docRef, updatedWithTick);
      } catch (err) {
        console.warn("Firestore save failed. Switching to Local Offline Fallback Mode:", err);
        setIsLocalMode(true);
      }
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (confirm("정말로 이 현장 조사의 모든 데이터, 도면 도락, 사진대지 기록을 영구 삭제하시겠습니까?")) {
      // Optimistic local state update
      const nextList = projects.filter((p) => p.id !== id);
      setProjects(nextList);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextList));
      } catch (_) {}

      if (activeProjectId === id) {
        setActiveProjectId(null);
      }

      // Sync to Firestore real-time collection if active
      if (!isLocalMode) {
        try {
          const docRef = doc(db, 'projects', id);
          await deleteDoc(docRef);
        } catch (err) {
          console.warn("Firestore delete failed. Switching to Local Offline Fallback Mode:", err);
          setIsLocalMode(true);
        }
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
            {/* Real-time sync connection indicator */}
            <div className="flex items-center gap-1.5 font-mono">
              {isSyncing ? (
                <>
                  <WifiOff className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                  <span className="text-amber-400 text-[10px] hidden sm:inline">실시간 연결 중...</span>
                </>
              ) : isLocalMode ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
                  <WifiOff className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-amber-400 text-[10px] hidden sm:inline">로컬 저장 모드 (안전함)</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-emerald-400 text-[10px] hidden sm:inline">실시간 수정 활성화됨</span>
                </>
              )}
            </div>
            
            <a
              href="#help"
              onClick={(ev) => {
                ev.preventDefault();
                alert("본 시스템은 별도의 수동 업로드 없이 Firebase Firestore 실시간 동기화 데이터베이스를 통해 모든 연결된 장치와 즉각적으로 연동됩니다. 이미지 등 대용량 미디어는 캔버스 조절 압축기(Quality: 0.6)를 사용하여 데이터 전송 및 디스크 소모 효율을 최적화하도록 기본 튜닝되어 있습니다.");
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
            Smart Construction Safe-Infill Systems | Collaborative Sync Active
          </p>
        </div>
      </footer>
    </div>
  );
}
