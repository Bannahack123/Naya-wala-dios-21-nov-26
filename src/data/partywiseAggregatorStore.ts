import { MASTER_PRODUCTS, MasterProduct } from '../data/masterProducts';
import { RetailerSaleRecord } from '../parsers/retailerParsers/dwarikaRetailerParser';

const STORAGE_KEY = 'dios_partywise_aggregator_vault_v1';
const ALLOCATIONS_KEY = 'dios_chemist_doctor_allocations_v3';

export interface ProductAllocation {
  productSn: number;
  productName: string;
  salesQty: number;
  freeQty: number;
  totalQty: number;
  rate: number;
  salesAmount: number;
  freeAmount: number;
  grossAmount: number;
}

export interface DoctorAllocation {
  doctorName: string;
  speciality: string;
  allocatedProducts: Record<number, ProductAllocation>;
}

export interface RetailerConsolidatedProfile {
  key: string;
  retailerName: string;
  address: string;
  stockists: string[];
  salesQty: number;
  freeQty: number;
  totalQty: number;
  salesAmount: number;
  freeAmount: number;
  grossAmount: number;
  items: Record<number, { 
    productName: string; 
    salesQty: number; 
    freeQty: number; 
    totalQty: number; 
    rate: number; 
    salesAmount: number; 
    freeAmount: number; 
    grossAmount: number; 
    stockists: string[] 
  }>;
}

export interface DoctorLinkedAnalyticsProfile {
  doctorName: string;
  speciality: string;
  linkedRetailers: Array<{ retailerName: string; address: string; contributionAmount: number; contributionGross: number }>;
  salesQty: number;
  freeQty: number;
  totalQty: number;
  salesAmount: number;
  freeAmount: number;
  grossAmount: number;
  products: Record<number, {
    productName: string;
    salesQty: number;
    freeQty: number;
    totalQty: number;
    salesAmount: number;
    grossAmount: number;
  }>;
}

export class PartywiseAggregatorStore {
  // data: { [monthCode]: { [stockistId]: RetailerSaleRecord[] } }
  public data: Record<string, Record<string, RetailerSaleRecord[]>>;

  constructor() {
    this.data = this.loadFromStorage();
  }

  // 🌟 100% BULLETPROOF NORMALIZATION (Handles old array format & new stockist map)
  public normalizeRawData(parsed: any): Record<string, Record<string, RetailerSaleRecord[]>> {
    if (!parsed || typeof parsed !== 'object') return {};
    const normalized: Record<string, Record<string, RetailerSaleRecord[]>> = {};

    Object.keys(parsed).forEach(mKey => {
      const monthVal = parsed[mKey];
      if (!normalized[mKey]) normalized[mKey] = {};

      if (Array.isArray(monthVal)) {
        // Old format was direct array -> classify as dwarika
        normalized[mKey]['dwarika'] = monthVal;
      } else if (monthVal && typeof monthVal === 'object') {
        Object.keys(monthVal).forEach(stKey => {
          const stVal = monthVal[stKey];
          if (Array.isArray(stVal)) {
            normalized[mKey][stKey] = stVal;
          }
        });
      }
    });

    return normalized;
  }

  private loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return this.normalizeRawData(JSON.parse(saved));
      }
    } catch (e) {}
    return {};
  }

  public setPartyRecords(monthCode: string, stockistId: string, records: RetailerSaleRecord[]) {
    if (!this.data[monthCode]) this.data[monthCode] = {};
    this.data[monthCode][stockistId] = records;
    this.persist();
  }

  // 🌟 STRICTLY SCOPED CLEAR METHOD (Clears only specific month & specific stockist)
  public clearMonth(monthCode: string, stockistId: string = 'all') {
    if (this.data[monthCode]) {
      if (stockistId === 'all') {
        delete this.data[monthCode];
        this.clearAllocationsForMonth(monthCode);
      } else {
        delete this.data[monthCode][stockistId];
      }
      this.persist();
    }
  }

  public getMonthRetailers(monthCode: string, targetStockist: string = 'all'): RetailerConsolidatedProfile[] {
    const monthData = this.data[monthCode] || {};
    let records: Array<{ r: RetailerSaleRecord; st: string }> = [];

    // Safe handling if monthData itself was an array
    if (Array.isArray(monthData)) {
      (monthData as any[]).forEach(r => records.push({ r, st: 'dwarika' }));
    } else {
      if (targetStockist === 'all') {
        Object.keys(monthData).forEach(st => {
          const list = monthData[st];
          if (Array.isArray(list)) {
            list.forEach(r => records.push({ r, st }));
          }
        });
      } else {
        const list = monthData[targetStockist];
        if (Array.isArray(list)) {
          list.forEach(r => records.push({ r, st: targetStockist }));
        }
      }
    }

    const map: Record<string, RetailerConsolidatedProfile> = {};

    records.forEach(({ r, st }) => {
      if (!r || !r.retailerName) return;
      const cleanKey = `${r.retailerName} (${r.address || 'UDAIPUR'})`.toUpperCase().trim();
      const stTag = st.charAt(0).toUpperCase() + st.slice(1);

      if (!map[cleanKey]) {
        map[cleanKey] = {
          key: cleanKey,
          retailerName: r.retailerName,
          address: r.address || 'UDAIPUR',
          stockists: [stTag],
          salesQty: 0,
          freeQty: 0,
          totalQty: 0,
          salesAmount: 0,
          freeAmount: 0,
          grossAmount: 0,
          items: {}
        };
      }

      const prof = map[cleanKey];
      if (!prof.stockists.includes(stTag)) prof.stockists.push(stTag);

      const sQty = r.salesQty || 0;
      const fQty = r.freeQty || 0;
      const totU = sQty + fQty;
      const rate = r.rate || 0;
      const sAmt = r.amount || Number((sQty * rate).toFixed(2));
      const fAmt = Number((fQty * rate).toFixed(2));
      const gAmt = Number((sAmt + fAmt).toFixed(2));

      prof.salesQty = Number((prof.salesQty + sQty).toFixed(2));
      prof.freeQty = Number((prof.freeQty + fQty).toFixed(2));
      prof.totalQty = Number((prof.totalQty + totU).toFixed(2));
      prof.salesAmount = Number((prof.salesAmount + sAmt).toFixed(2));
      prof.freeAmount = Number((prof.freeAmount + fAmt).toFixed(2));
      prof.grossAmount = Number((prof.grossAmount + gAmt).toFixed(2));

      if (!prof.items[r.productSn]) {
        prof.items[r.productSn] = {
          productName: r.productName,
          salesQty: 0,
          freeQty: 0,
          totalQty: 0,
          rate: rate,
          salesAmount: 0,
          freeAmount: 0,
          grossAmount: 0,
          stockists: [stTag]
        };
      }

      const item = prof.items[r.productSn];
      if (!item.stockists.includes(stTag)) item.stockists.push(stTag);

      item.salesQty = Number((item.salesQty + sQty).toFixed(2));
      item.freeQty = Number((item.freeQty + fQty).toFixed(2));
      item.totalQty = Number((item.totalQty + totU).toFixed(2));
      item.rate = rate || item.rate;
      item.salesAmount = Number((item.salesAmount + sAmt).toFixed(2));
      item.freeAmount = Number((item.freeAmount + fAmt).toFixed(2));
      item.grossAmount = Number((item.grossAmount + gAmt).toFixed(2));
    });

    return Object.values(map).sort((a, b) => b.salesAmount - a.salesAmount);
  }

  public getAllocationsForMonth(monthCode: string): Record<string, DoctorAllocation[]> {
    try {
      const all = JSON.parse(localStorage.getItem(ALLOCATIONS_KEY) || '{}');
      return all[monthCode] || {};
    } catch (e) {
      return {};
    }
  }

  public getAllocationsForRetailer(monthCode: string, retailerKey: string): DoctorAllocation[] {
    const monthAllocations = this.getAllocationsForMonth(monthCode);
    return monthAllocations[retailerKey] || [];
  }

  public saveRetailerAllocations(monthCode: string, retailerKey: string, allocations: DoctorAllocation[]) {
    try {
      const all = JSON.parse(localStorage.getItem(ALLOCATIONS_KEY) || '{}');
      if (!all[monthCode]) all[monthCode] = {};
      
      const valid = allocations.filter(a => a.doctorName && a.doctorName !== '-' && Object.keys(a.allocatedProducts).length > 0);
      if (valid.length > 0) {
        all[monthCode][retailerKey] = valid;
      } else {
        delete all[monthCode][retailerKey];
      }

      localStorage.setItem(ALLOCATIONS_KEY, JSON.stringify(all));
    } catch (e) {}
  }

  public clearAllocationsForMonth(monthCode: string) {
    try {
      const all = JSON.parse(localStorage.getItem(ALLOCATIONS_KEY) || '{}');
      delete all[monthCode];
      localStorage.setItem(ALLOCATIONS_KEY, JSON.stringify(all));
    } catch (e) {}
  }

  public getDoctorLinkedAnalytics(monthCode: string, allMslDocs: any[], targetStockist: string = 'all'): DoctorLinkedAnalyticsProfile[] {
    const retailers = this.getMonthRetailers(monthCode, targetStockist);
    const monthAllocations = this.getAllocationsForMonth(monthCode);
    const docMap: Record<string, DoctorLinkedAnalyticsProfile> = {};

    retailers.forEach(r => {
      const allocations = monthAllocations[r.key];

      if (allocations && allocations.length > 0) {
        allocations.forEach(alloc => {
          const docName = alloc.doctorName;
          if (!docName || docName === '-') return;

          const cleanDocKey = docName.toUpperCase().trim();
          const mslMeta = allMslDocs.find((d: any) => d.doctorName.toUpperCase().trim() === cleanDocKey);

          if (!docMap[cleanDocKey]) {
            docMap[cleanDocKey] = {
              doctorName: docName,
              speciality: mslMeta?.speciality || alloc.speciality || 'CONSULTANT',
              linkedRetailers: [],
              salesQty: 0,
              freeQty: 0,
              totalQty: 0,
              salesAmount: 0,
              freeAmount: 0,
              grossAmount: 0,
              products: {}
            };
          }

          const dProf = docMap[cleanDocKey];
          let doctorChemistSalesContribution = 0;
          let doctorChemistGrossContribution = 0;

          Object.values(alloc.allocatedProducts).forEach(ap => {
            const sQ = ap.salesQty || 0;
            const fQ = ap.freeQty || 0;
            const totQ = sQ + fQ;

            if (totQ > 0) {
              dProf.salesQty += sQ;
              dProf.freeQty += fQ;
              dProf.totalQty += totQ;
              dProf.salesAmount = Number((dProf.salesAmount + (ap.salesAmount || 0)).toFixed(2));
              dProf.freeAmount = Number((dProf.freeAmount + (ap.freeAmount || 0)).toFixed(2));
              dProf.grossAmount = Number((dProf.grossAmount + (ap.grossAmount || 0)).toFixed(2));
              doctorChemistSalesContribution = Number((doctorChemistSalesContribution + (ap.salesAmount || 0)).toFixed(2));
              doctorChemistGrossContribution = Number((doctorChemistGrossContribution + (ap.grossAmount || 0)).toFixed(2));

              if (!dProf.products[ap.productSn]) {
                dProf.products[ap.productSn] = {
                  productName: ap.productName,
                  salesQty: 0,
                  freeQty: 0,
                  totalQty: 0,
                  salesAmount: 0,
                  grossAmount: 0
                };
              }
              const p = dProf.products[ap.productSn];
              p.salesQty += sQ;
              p.freeQty += fQ;
              p.totalQty += totQ;
              p.salesAmount = Number((p.salesAmount + (ap.salesAmount || 0)).toFixed(2));
              p.grossAmount = Number((p.grossAmount + (ap.grossAmount || 0)).toFixed(2));
            }
          });

          if ((doctorChemistSalesContribution > 0 || doctorChemistGrossContribution > 0) && !dProf.linkedRetailers.some(lr => lr.retailerName === r.retailerName)) {
            dProf.linkedRetailers.push({
              retailerName: r.retailerName,
              address: r.address,
              contributionAmount: doctorChemistSalesContribution,
              contributionGross: doctorChemistGrossContribution
            });
          }
        });
      }
    });

    return Object.values(docMap).sort((a, b) => b.grossAmount - a.grossAmount || b.salesAmount - a.salesAmount);
  }

  public persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {}
  }
}

export const partywiseAggregatorStore = new PartywiseAggregatorStore();
