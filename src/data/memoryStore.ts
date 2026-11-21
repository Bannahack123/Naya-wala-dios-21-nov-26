import type { PartyParseSummary } from '../parsers/common';

export interface FwDayEntry {
  date: number;
  day: string;
  areaWorked: string;
  tpSubmitted: string;
  drsMet: string | number;
  chemistsMet: string | number;
  withManager?: boolean;
  workType?: string;
}

export interface PartyBreakdownItem {
  id: string;
  partyName: string;
  amount: number;
  note?: string;
}

export interface MonthBreakdownMap {
  [key: string]: PartyBreakdownItem[];
}

export interface DhruviProductEntry {
  sn: number;
  salesFormula: string;
  salesQty: number;
  closingFormula: string;
  closingQty: number;
}

export type DhruviValuationMode = 'PTS' | 'PTR' | 'MANUAL_PTR' | 'MANUAL_PTS';

export interface ManualPartyDraft {
  entries: Record<number, DhruviProductEntry>;
  manualPtsTotal: string;
  manualPtrTotal: string;
  valuationMode: DhruviValuationMode;
}

export interface AggregatorMonthState {
  partyDataMap: Record<string, PartyParseSummary>;
  primaryData: PartyParseSummary | null;
}

export interface DcrDoctorCall {
  date: string;
  day: string;
  station: string;
  route: string;
  workWith: string;
  srNo: string;
  docName: string;
  docCode: string;
  speciality: string;
  area: string;
  visitTime: string;
  prodSample: string;
  gift: string;
  rxQty: string;
  pobAmt: string;
  callType: string;
  remarks: string;
}

export interface DcrChemistCall {
  date: string;
  day: string;
  station: string;
  srNo: string;
  chemistName: string;
  address: string;
  visitTime: string;
  products: string;
  pobAmt: string;
  remarks: string;
}

export interface MslDoctor {
  srNo: number;
  doctorName: string;
  activityType: string;
  speciality: string;
  dob: string;
  doa: string;
  apr: string;
  may: string;
  jun: string;
  jul: string;
  aug: string;
  sept: string;
  oct: string;
  nov: string;
  dec: string;
  jan: string;
  feb: string;
  mar: string;
  isNewDoctor?: boolean;
}

export const DEFAULT_STOCKISTS = [
  'NAGDA DISTRIBUTORS',
  'MODI DISTRIBUTORS',
  'SHREE VARDHMAN PHARMA',
  'SUN DISTRIBUTORS',
  'R.P. AGENCIES',
  'DWARIKA MEDICALS'
];

export const AGGREGATOR_DRAFT_STORAGE_KEY = 'dios_aggregator_workspace_draft_v1';

export const PARTY_NAME_TO_ID: Record<string, string> = {
  'sun distributors': 'sun',
  'r.p. agencies': 'rp',
  'shree vardhman': 'vardhman',
  'shree vardhman pharma': 'vardhman',
  'modi distributors': 'modi',
  'dwarika medicals': 'dwarika',
  'nagda distributors': 'nagda',
  'dhruvi': 'dhruvi',
};

export const memoryStore = {
  dcrDataByMonth: {} as Record<string, FwDayEntry[]>,
  currentDcrMonth: 'Aug-2026',
  effortLevelData: null as Record<string, Record<string, string>> | null,
  salesPerformanceData: null as Record<string, Record<string, string>> | null,
  salesBreakdown: {} as MonthBreakdownMap,
  dhruviEntries: {} as Record<number, DhruviProductEntry>,
  dhruviManualPtrTotal: '' as string,
  dhruviManualPtsTotal: '' as string,
  dhruviValuationMode: 'PTS' as DhruviValuationMode,
  aggregatorSelectedMonth: 'AUGUST' as string,
  aggregatorByMonth: {} as Record<string, AggregatorMonthState>,
  manualDrafts: {} as Record<string, ManualPartyDraft>,
  expiryData: null as Record<number, any> | null,
  mslData: null as MslDoctor[] | null,
  mslSyncEnabled: true as boolean, // ⚡ Sync Toggle State
  commitmentTopData: null as any,
  commitmentMonthlyCA: null as any,
  commitmentDoctors: null as any,
  dcrCallsByMonth: {} as Record<string, { doctors: DcrDoctorCall[]; chemists: DcrChemistCall[] }>,
  beName: 'BANWARI LAL MEENA',
  hqName: 'UDAIPUR',
  lastSyncedMonthCode: 'AUG'
};

export function getManualDraftKey(month: string, partyId: string): string {
  return `${month.toUpperCase()}_${partyId}`;
}

export function saveAggregatorDraftToStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const payload = {
      selectedMonth: memoryStore.aggregatorSelectedMonth,
      byMonth: memoryStore.aggregatorByMonth,
      manualDrafts: memoryStore.manualDrafts,
    };
    window.localStorage.setItem(AGGREGATOR_DRAFT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

export function hydrateAggregatorDraftFromStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(AGGREGATOR_DRAFT_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      if (typeof parsed.selectedMonth === 'string' && parsed.selectedMonth) {
        memoryStore.aggregatorSelectedMonth = parsed.selectedMonth;
      }
      if (parsed.byMonth && typeof parsed.byMonth === 'object') {
        memoryStore.aggregatorByMonth = parsed.byMonth;
      }
      if (parsed.manualDrafts && typeof parsed.manualDrafts === 'object') {
        memoryStore.manualDrafts = parsed.manualDrafts;
        const activeDhruviKey = getManualDraftKey(memoryStore.aggregatorSelectedMonth, 'dhruvi');
        const dhruviDraft = memoryStore.manualDrafts[activeDhruviKey];
        if (dhruviDraft && Object.keys(memoryStore.dhruviEntries || {}).length === 0) {
          memoryStore.dhruviEntries = dhruviDraft.entries || {};
          memoryStore.dhruviManualPtsTotal = dhruviDraft.manualPtsTotal || '';
          memoryStore.dhruviManualPtrTotal = dhruviDraft.manualPtrTotal || '';
          memoryStore.dhruviValuationMode = dhruviDraft.valuationMode || 'PTS';
        }
      }
    }
  } catch {
    // Ignore corrupted draft JSON
  }
}

hydrateAggregatorDraftFromStorage();

export function getManualDraft(month: string, partyId: string): ManualPartyDraft | null {
  const key = getManualDraftKey(month, partyId);
  const existing = memoryStore.manualDrafts[key];
  if (existing) return existing;

  if (partyId === 'dhruvi' && Object.keys(memoryStore.dhruviEntries || {}).length > 0) {
    return {
      entries: memoryStore.dhruviEntries,
      manualPtsTotal: memoryStore.dhruviManualPtsTotal || '',
      manualPtrTotal: memoryStore.dhruviManualPtrTotal || '',
      valuationMode: memoryStore.dhruviValuationMode || 'PTS',
    };
  }
  return null;
}

export function setManualDraft(month: string, partyId: string, draft: ManualPartyDraft | null): void {
  const key = getManualDraftKey(month, partyId);
  if (draft) {
    memoryStore.manualDrafts[key] = draft;
    if (partyId === 'dhruvi') {
      memoryStore.dhruviEntries = draft.entries;
      memoryStore.dhruviManualPtsTotal = draft.manualPtsTotal;
      memoryStore.dhruviManualPtrTotal = draft.manualPtrTotal;
      memoryStore.dhruviValuationMode = draft.valuationMode;
    }
  } else {
    delete memoryStore.manualDrafts[key];
    if (partyId === 'dhruvi') {
      memoryStore.dhruviEntries = {};
      memoryStore.dhruviManualPtsTotal = '';
      memoryStore.dhruviManualPtrTotal = '';
      memoryStore.dhruviValuationMode = 'PTS';
    }
  }
  saveAggregatorDraftToStorage();
}

export function clearManualDraftsForMonth(month: string): void {
  const prefix = `${month.toUpperCase()}_`;
  Object.keys(memoryStore.manualDrafts).forEach((k) => {
    if (k.startsWith(prefix)) {
      delete memoryStore.manualDrafts[k];
    }
  });
  memoryStore.dhruviEntries = {};
  memoryStore.dhruviManualPtsTotal = '';
  memoryStore.dhruviManualPtrTotal = '';
  memoryStore.dhruviValuationMode = 'PTS';
  saveAggregatorDraftToStorage();
}

export function getPartyValuationConfig(
  month: string,
  partyName: string
): { valuationMode: DhruviValuationMode; manualPtsTotal: string; manualPtrTotal: string } | null {
  const normalized = (partyName || '').trim().toLowerCase();
  const matchedEntry = Object.entries(PARTY_NAME_TO_ID).find(([label]) => normalized.includes(label));
  const partyId = matchedEntry?.[1];

  if (partyId) {
    const draft = getManualDraft(month, partyId);
    if (draft) {
      return {
        valuationMode: draft.valuationMode || 'PTS',
        manualPtsTotal: draft.manualPtsTotal || '',
        manualPtrTotal: draft.manualPtrTotal || '',
      };
    }
  }

  if (normalized.includes('dhruvi')) {
    return {
      valuationMode: memoryStore.dhruviValuationMode || 'PTS',
      manualPtsTotal: memoryStore.dhruviManualPtsTotal || '',
      manualPtrTotal: memoryStore.dhruviManualPtrTotal || '',
    };
  }
  return null;
}

