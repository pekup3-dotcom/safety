/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type DamageType =
  | '균열'
  | '습식균열'
  | '누수'
  | '백화'
  | '콘크리트 박리박락'
  | '철근노출 및 부식'
  | '마감재박리'
  | '이질마감재 균열'
  | '조적균열';

export type MemberType = '기둥' | '벽체' | '보' | '슬래브';

export interface BoundingBox {
  x: number;     // 0-100 (percentage relative to photo width)
  y: number;     // 0-100 (percentage relative to photo height)
  width: number; // 0-100
  height: number; // 0-100
}

export interface Damage {
  id: string;
  no: number;
  type: DamageType;
  cause: string;       // Chosen preset or '기타 직접입력' -> user typing
  customCause?: string; // Custom typed cause if '기타 직접입력' is selected
  floor: string;       // Chosen floor (e.g., '지하1층', '지상3층')
  facility?: string;    // 시설물명 (e.g., '가동', '나동')
  member: MemberType;  // Chosen member
  
  // Numerical dimensions
  // For 균열, 습식균열, 조적균열, 이질마감재 균열: width (폭, mm), length (길이, m)
  // For others: width (가로, m), length (세로, m), area (면적, m²) automatically calculated
  widthVal: number; // Width or crack width
  lengthVal: number; // Length
  areaVal?: number; // Calculated area (for area-based damages)

  // Photos
  photoUrls: string[]; // List of base64 compressed images associated with this defect

  // Drawing marker coordinate (relative position as percent 0-100 inside original drawing space)
  marker: {
    x: number;
    y: number;
  } | null;

  // AI Assistant metrics
  boundingBoxes?: BoundingBox[];
  aiSuggestedSize?: string | null;
}

export interface Project {
  id: string;
  name: string;                // 현장에서 가장 대표가 되는 시설물명
  inspectionCompany: string;   // 점검업체명
  facilitiesRaw: string;       // 시설물명 목록 (쉼표 구분 원본)
  facilitiesList: string[];    // 시설물명 목록 배열
  basementFloors: number;      // 지하 층수
  abovegroundFloors: number;   // 지상 층수
  phFloors?: number;           // PH 층수 (옥탑층)
  status?: '조사 중' | '조사 완료'; // 조사 진행 상태
  floorOptions: string[];      // 자동 생성된 층 옵션 목록
  drawingUrl: string | null;   // 도면 데이터 URL (Base64) or default grid image
  drawingName: string | null;  // 도면 파일명
  damages: Damage[];           // 손상 리스트
  selectedFacility?: string;   // 최근/선택된 시설물명
  selectedFloor?: string;      // 최근/선택된 층명
  createdAt: string;
  updatedAt: string;
}

// Preset mapping of causes for each Damage Type
export const DAMAGE_CAUSES: Record<DamageType, string[]> = {
  '균열': [
    '콘크리트 건조수축 (Drying Shrinkage)',
    '수화열 온도응력 (Hydration Heat)',
    '하중 과다 및 초과 (Overloading)',
    '기초 부동침하 (Differential Settlement)',
    '소성 수축 균열 (Plastic Shrinkage)',
    '진동 및 충격 (Vibration/Impact)',
    '기타 직접입력',
  ],
  '습식균열': [
    '누수 동반 건조수축 (Wet Shrinkage with Leakage)',
    '지하수위 수압 영향 (Water Table Pressure)',
    '조인트 방수 및 마감 불량 (Poor Waterproof Joint)',
    '배면 배수시설 불량 (Poor Drainage Backing)',
    '철근 부식 팽창 압력 (Rebar Rust Expansion)',
    '기타 직접입력',
  ],
  '누수': [
    '방수층 파손 및 열화 (Waterproof Layer Damage)',
    '외벽/슬래브 균열 관통 (Through-crack Leakage)',
    '창호 주위 코킹 불량 (Fail Caulking around Openings)',
    '조인트 충전 상태 미비 (Defective Joint filling)',
    '배수구 및 배관 막힘 (Clogged Drain/pipe)',
    '기타 직접입력',
  ],
  '백화': [
    '콘크리트 내부 물 유입 및 석회 성분 함유 (Lime Leaching)',
    '배면 누수 및 만성 습기 유지 (Chronic Backing Moisture)',
    '모르타르/시멘트 양생 중 우수 침투 (Rain during curing)',
    '줄눈재 부실 및 방수 불량 (Poor Mortar Grouting)',
    '기타 직접입력',
  ],
  '콘크리트 박리박락': [
    '철근 부식에 의한 팽창압 (Rebar Rust Expansion)',
    '콘크리트 피복두께 부족 (Insufficient Rebar Cover)',
    '탄산화/대기 중 이산화탄소 반응 노화 (Carbonation Decay)',
    '동결 융해 반복 손상 (Freeze-Thaw Deterioration)',
    '외력 충격 및 구조적 박리 (Structural Delamination)',
    '기타 직접입력',
  ],
  '철근노출 및 부식': [
    '피복두께 절대 부족 (Lack of concrete cover)',
    '균열부를 통한 수분 및 산소 침투 (Crack Moisture Entry)',
    '염화물 이온 침탈 (Chloride Damage / Salt ingress)',
    '콘크리트 중성화 진행 (Progressive Carbonation)',
    '시공 불량에 의한 재료분리 (Honeycomb/Improper pouring)',
    '기타 직접입력',
  ],
  '마감재박리': [
    '초기 미장 접착강도 부실 (Low adhesive strength)',
    '모체 콘크리트 습윤 상태 작업 (Seepage on wet body)',
    '내부 균열 고화 거동 (Substrate joint movement)',
    '동결 융해 및 온도 신축 응력 (Temperature Expansion Stress)',
    '기타 직접입력',
  ],
  '이질마감재 균열': [
    '서로 다른 재료 간 열팽창계수 차이 (Thermal Expansion Gap)',
    '신축줄눈(Exp. Joint) 미설치 또는 설치 불량',
    '접합부(조인트) 마감 처리 미비 (Unfinished joints)',
    '구조체 움직임 배수 하중 하강 (Defection & settlement structural joints)',
    '기타 직접입력',
  ],
  '조적균열': [
    '상부 하중 집중에 의한 벽체 처짐 (Deflection under Load)',
    '조적벽체 기초 불균형 침하 (Masonry differential settlement)',
    '모르타르 부착강도 저하 및 시공 불량 (Poor bond mortar)',
    '골조 변형에 의한 전단 피로 (Shear displacement frame)',
    '기타 직접입력',
  ],
};

export function getMemberColorClass(member: MemberType): string {
  switch (member) {
    case '기둥':
    case '벽체':
      return 'red'; // Red series
    case '보':
    case '슬래브':
      return 'blue'; // Blue series
  }
}

export interface BaseInspectionSettings {
  facilitiesText: string;     // 예: "가동, 나동, 다동"
  basementFloors: number;     // 지하 층수
  abovegroundFloors: number;  // 지상 층수
  phFloors: number;           // 옥탑(PH) 층수
  inspectionCompany: string;  // 점검업체명
}

export function getComputedFloors(basement: number, above: number, ph: number): string[] {
  const list: string[] = [];
  // PH (옥탑) 층수
  for (let i = ph; i >= 1; i--) {
    list.push(`PH ${i}층`);
  }
  // 지상 층수
  for (let i = above; i >= 1; i--) {
    list.push(`지상 ${i}층`);
  }
  // 지하 층수
  for (let i = 1; i <= basement; i++) {
    list.push(`지하 ${i}층`);
  }
  return list;
}
