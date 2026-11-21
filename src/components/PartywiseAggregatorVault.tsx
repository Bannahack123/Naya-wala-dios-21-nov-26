import React, { useState, useMemo, useRef } from 'react';
import { 
  ArrowLeft, Download, RefreshCw, Search, 
  CheckCircle2, Layers, FileSpreadsheet, Sparkles, Building2, 
  Upload, Stethoscope, Eye, X, Calendar, Trash2, RotateCcw, 
  FileText, Link2, UserCheck, ShieldCheck, ChevronRight,
  Plus, Check, AlertCircle, Edit3, Award, Gift, DollarSign
} from 'lucide-react';
import { 
  partywiseAggregatorStore, 
  RetailerConsolidatedProfile, 
  DoctorLinkedAnalyticsProfile,
  DoctorAllocation,
  ProductAllocation
} from '../data/partywiseAggregatorStore';
import { parseDwarikaRetailerPdf, RetailerSaleRecord } from '../parsers/retailerParsers/dwarikaRetailerParser';
import { parseModiRetailerPdf } from '../parsers/retailerParsers/modiRetailerParser';
import { parseNagdaRetailerPdf } from '../parsers/retailerParsers/nagdaRetailerParser';
import { parseVardhmanRetailerPdf } from '../parsers/retailerParsers/vardhmanRetailerParser';
import { exportPartywiseConsolidatedExcel, exportPartywiseConsolidatedCSV } from '../exporters/partywiseExporter';
import { memoryStore, MslDoctor } from '../data/memoryStore';
import { MASTER_123_MSL_DOCTORS } from './review/MslSheet';
import { MASTER_PRODUCTS } from '../data/masterProducts';
import { CloudSyncBar } from './CloudSyncBar';

const MONTH_OPTIONS = [
  { label: 'Apr-2026', code: 'APR' },
  { label: 'May-2026', code: 'MAY' },
  { label: 'Jun-2026', code: 'JUN' },
  { label: 'Jul-2026', code: 'JUL' },
  { label: 'Aug-2026', code: 'AUG' },
  { label: 'Sep-2026', code: 'SEP' },
  { label: 'Oct-2026', code: 'OCT' },
  { label: 'Nov-2026', code: 'NOV' },
  { label: 'Dec-2026', code: 'DEC' },
  { label: 'Jan-2027', code: 'JAN' },
  { label: 'Feb-2027', code: 'FEB' },
  { label: 'Mar-2027', code: 'MAR' },
  { label: 'Jun-Aug (3M Cum)', code: 'JUN_AUG' },
];

const STOCKIST_TABS = [
  { id: 'all', name: 'All Stockists (Consolidated)' },
  { id: 'dwarika', name: 'Dwarika Medicals' },
  { id: 'modi', name: 'Modi Distributors' },
  { id: 'nagda', name: 'Nagda Distributors' },
  { id: 'vardhman', name: 'Shree Vardhman' }
];

interface Props {
  onBack: () => void;
}

export const PartywiseAggregatorVault: React.FC<Props> = ({ onBack }) => {
  const [selectedMonthCode, setSelectedMonthCode] = useState('AUG');
  const [selectedStockist, setSelectedStockist] = useState<'all' | 'dwarika' | 'modi' | 'nagda' | 'vardhman'>('vardhman');
  const [activeTabMode, setActiveTabMode] = useState<'CHEMISTS' | 'MSL_DOCTORS'>('CHEMISTS');
  const [search, setSearch] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Multi-Doctor Allocation Modal State
  const [allocatingRetailer, setAllocatingRetailer] = useState<RetailerConsolidatedProfile | null>(null);
  const [modalAllocations, setModalAllocations] = useState<DoctorAllocation[]>([]);
  const [activeDocIndex, setActiveDocIndex] = useState<number>(0);
  const [doctorSearchQuery, setDoctorSearchQuery] = useState('');

  // 360° Detail Modals
  const [selectedRetailer, setSelectedRetailer] = useState<RetailerConsolidatedProfile | null>(null);
  const [selectedDoctorAnalytics, setSelectedDoctorAnalytics] = useState<DoctorLinkedAnalyticsProfile | null>(null);

  const allMslDoctors: MslDoctor[] = useMemo(() => {
    if (memoryStore.mslData && memoryStore.mslData.length > 0) return memoryStore.mslData;
    return MASTER_123_MSL_DOCTORS;
  }, []);

  const filteredMslDocsForSelector = useMemo(() => {
    const q = doctorSearchQuery.toLowerCase().trim();
    if (!q) return allMslDoctors.slice(0, 15);
    return allMslDoctors.filter(d => 
      d.doctorName.toLowerCase().includes(q) || 
      (d.speciality || '').toLowerCase().includes(q) ||
      String(d.srNo).includes(q)
    ).slice(0, 10);
  }, [allMslDoctors, doctorSearchQuery]);

  const retailersList = useMemo(() => {
    return partywiseAggregatorStore.getMonthRetailers(selectedMonthCode, selectedStockist);
  }, [selectedMonthCode, selectedStockist, refreshTrigger]);

  const doctorAnalyticsList = useMemo(() => {
    return partywiseAggregatorStore.getDoctorLinkedAnalytics(selectedMonthCode, allMslDoctors, selectedStockist);
  }, [selectedMonthCode, allMslDoctors, selectedStockist, refreshTrigger]);

  const filteredRetailers = useMemo(() => {
    const q = search.toLowerCase();
    return retailersList.filter(r => 
      r.retailerName.toLowerCase().includes(q) || 
      r.address.toLowerCase().includes(q) ||
      r.stockists.some(st => st.toLowerCase().includes(q))
    );
  }, [retailersList, search]);

  const filteredDoctorAnalytics = useMemo(() => {
    const q = search.toLowerCase();
    return doctorAnalyticsList.filter(d => 
      d.doctorName.toLowerCase().includes(q) || 
      d.speciality.toLowerCase().includes(q) ||
      d.linkedRetailers.some(lr => lr.retailerName.toLowerCase().includes(q) || lr.address.toLowerCase().includes(q))
    );
  }, [doctorAnalyticsList, search]);

  const grandMetrics = useMemo(() => {
    let totSalesQty = 0;
    let totFreeQty = 0;
    let totUnits = 0;
    let totSalesAmt = 0;
    let totFreeAmt = 0;
    let totGrossAmt = 0;

    retailersList.forEach(r => {
      totSalesQty += r.salesQty;
      totFreeQty += r.freeQty;
      totUnits += r.totalQty;
      totSalesAmt += r.salesAmount;
      totFreeAmt += r.freeAmount;
      totGrossAmt += r.grossAmount;
    });

    const monthAllocations = partywiseAggregatorStore.getAllocationsForMonth(selectedMonthCode);
    const allocatedChemistsCount = Object.keys(monthAllocations).length;

    return {
      totSalesQty: Number(totSalesQty.toFixed(2)),
      totFreeQty: Number(totFreeQty.toFixed(2)),
      totUnits: Number(totUnits.toFixed(2)),
      totSalesAmt: Number(totSalesAmt.toFixed(2)),
      totFreeAmt: Number(totFreeAmt.toFixed(2)),
      totGrossAmt: Number(totGrossAmt.toFixed(2)),
      allocatedChemistsCount
    };
  }, [retailersList, selectedMonthCode, refreshTrigger]);

  const handleFileUpload = async (file: File) => {
    setIsParsing(true);
    
    // Auto-detect stockist from file name or active tab
    const fUpper = file.name.toUpperCase();
    let effectiveStockist: 'dwarika' | 'modi' | 'nagda' | 'vardhman' = 
      selectedStockist === 'all' ? 'vardhman' : selectedStockist;

    if (fUpper.includes('VARDHMAN') || fUpper.includes('VARDHAMAN')) effectiveStockist = 'vardhman';
    else if (fUpper.includes('NAGDA')) effectiveStockist = 'nagda';
    else if (fUpper.includes('MODI')) effectiveStockist = 'modi';
    else if (fUpper.includes('DWARIKA')) effectiveStockist = 'dwarika';

    if (effectiveStockist !== selectedStockist && selectedStockist !== 'all') {
      setSelectedStockist(effectiveStockist);
    }

    const targetStockistName = 
      effectiveStockist === 'vardhman' ? 'Shree Vardhman' :
      effectiveStockist === 'nagda' ? 'Nagda Distributors' : 
      effectiveStockist === 'modi' ? 'Modi Distributors' : 
      'Dwarika Medicals';

    setStatusMsg(`Parsing ${targetStockistName} PDF '${file.name}'...`);

    try {
      let records: RetailerSaleRecord[] = [];
      let detectedMonthCode: string | undefined = undefined;

      if (effectiveStockist === 'vardhman') {
        const res = await parseVardhmanRetailerPdf(file);
        records = res.records;
        detectedMonthCode = res.detectedMonthCode;
      } else if (effectiveStockist === 'nagda') {
        const res = await parseNagdaRetailerPdf(file);
        records = res.records;
        detectedMonthCode = res.detectedMonthCode;
      } else if (effectiveStockist === 'modi') {
        const res = await parseModiRetailerPdf(file);
        records = res.records;
        detectedMonthCode = res.detectedMonthCode;
      } else {
        const res = await parseDwarikaRetailerPdf(file);
        records = res.records;
        detectedMonthCode = res.detectedMonthCode;
      }

      if (records.length === 0) {
        throw new Error(`Koi valid product ya chemist record nahi mila. Make sure this is ${targetStockistName} PDF.`);
      }

      const targetMonth = detectedMonthCode || selectedMonthCode;
      if (detectedMonthCode && detectedMonthCode !== selectedMonthCode) {
        setSelectedMonthCode(detectedMonthCode);
      }

      const stId = effectiveStockist;
      partywiseAggregatorStore.setPartyRecords(targetMonth, stId, records);

      setRefreshTrigger(prev => prev + 1);
      setStatusMsg(`🎉 SUCCESS! ${targetStockistName} (${targetMonth}) se ${records.length} clean entries save ho gayi hain!`);
    } catch (err: any) {
      alert("Parse Error: " + (err.message || String(err)));
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  const handleResetMonthData = () => {
    const stLabel = selectedStockist === 'modi' ? 'Modi Distributors' : selectedStockist === 'dwarika' ? 'Dwarika Medicals' : 'All Stockists';
    if (window.confirm(`⚠️ Kya aap ${selectedMonthCode} 2026 ka SIRF [${stLabel}] ka data reset karna chahte hain?\n(Dusre stockist ka data bilkul safe rahega)`)) {
      partywiseAggregatorStore.clearMonth(selectedMonthCode, selectedStockist);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setRefreshTrigger(prev => prev + 1);
      setStatusMsg(`🧹 ${selectedMonthCode} [${stLabel}] ka data reset ho gaya!`);
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  const handleOpenAllocationModal = (retailer: RetailerConsolidatedProfile) => {
    setAllocatingRetailer(retailer);
    const existingAllocations = partywiseAggregatorStore.getAllocationsForRetailer(selectedMonthCode, retailer.key);
    
    if (existingAllocations && existingAllocations.length > 0) {
      setModalAllocations(JSON.parse(JSON.stringify(existingAllocations)));
    } else {
      setModalAllocations([]);
    }

    setActiveDocIndex(0);
    setDoctorSearchQuery('');
  };

  const handleAddDoctorToChemist = (doc: MslDoctor) => {
    if (modalAllocations.some(a => a.doctorName.toUpperCase().trim() === doc.doctorName.toUpperCase().trim())) {
      alert(`Dr. ${doc.doctorName} pehle se is chemist me added hain!`);
      return;
    }

    const newDocAlloc: DoctorAllocation = {
      doctorName: doc.doctorName,
      speciality: doc.speciality || 'CONSULTANT',
      allocatedProducts: {}
    };

    const updated = [...modalAllocations, newDocAlloc];
    setModalAllocations(updated);
    setActiveDocIndex(updated.length - 1);
    setDoctorSearchQuery('');
  };

  const handleRemoveDoctorFromChemist = (docIdx: number) => {
    const updated = modalAllocations.filter((_, i) => i !== docIdx);
    setModalAllocations(updated);
    setActiveDocIndex(Math.max(0, docIdx - 1));
  };

  const getOtherDoctorsAllocatedQty = (productSn: number, currentDocIdx: number) => {
    let otherSales = 0;
    let otherFree = 0;

    modalAllocations.forEach((doc, idx) => {
      if (idx !== currentDocIdx && doc.allocatedProducts[productSn]) {
        otherSales += doc.allocatedProducts[productSn].salesQty || 0;
        otherFree += doc.allocatedProducts[productSn].freeQty || 0;
      }
    });

    return { otherSales, otherFree };
  };

  const handleToggleProductForDoctor = (productSn: number, itemMeta: any) => {
    if (!modalAllocations[activeDocIndex]) return;
    const currentDoc = { ...modalAllocations[activeDocIndex] };
    const { otherSales, otherFree } = getOtherDoctorsAllocatedQty(productSn, activeDocIndex);

    if (currentDoc.allocatedProducts[productSn]) {
      delete currentDoc.allocatedProducts[productSn];
    } else {
      const remSales = Math.max(0, itemMeta.salesQty - otherSales);
      const remFree = Math.max(0, itemMeta.freeQty - otherFree);
      const rate = itemMeta.rate || 0;
      const sAmt = Number((remSales * rate).toFixed(2));
      const fAmt = Number((remFree * rate).toFixed(2));
      const totQ = remSales + remFree;

      currentDoc.allocatedProducts[productSn] = {
        productSn,
        productName: itemMeta.productName,
        salesQty: remSales,
        freeQty: remFree,
        totalQty: totQ,
        rate: rate,
        salesAmount: sAmt,
        freeAmount: fAmt,
        grossAmount: Number((sAmt + fAmt).toFixed(2))
      };
    }

    const copy = [...modalAllocations];
    copy[activeDocIndex] = currentDoc;
    setModalAllocations(copy);
  };

  const handleSetCustomQty = (productSn: number, itemMeta: any, customSalesStr: string, customFreeStr: string) => {
    if (!modalAllocations[activeDocIndex]) return;
    const currentDoc = { ...modalAllocations[activeDocIndex] };
    const { otherSales, otherFree } = getOtherDoctorsAllocatedQty(productSn, activeDocIndex);

    const maxSales = Math.max(0, itemMeta.salesQty - otherSales);
    const maxFree = Math.max(0, itemMeta.freeQty - otherFree);

    const sQty = Math.min(maxSales, Math.max(0, parseFloat(customSalesStr) || 0));
    const fQty = Math.min(maxFree, Math.max(0, parseFloat(customFreeStr) || 0));
    const rate = itemMeta.rate || 0;
    const sAmt = Number((sQty * rate).toFixed(2));
    const fAmt = Number((fQty * rate).toFixed(2));
    const totQ = sQty + fQty;

    if (totQ > 0) {
      currentDoc.allocatedProducts[productSn] = {
        productSn,
        productName: itemMeta.productName,
        salesQty: sQty,
        freeQty: fQty,
        totalQty: totQ,
        rate: rate,
        salesAmount: sAmt,
        freeAmount: fAmt,
        grossAmount: Number((sAmt + fAmt).toFixed(2))
      };
    } else {
      delete currentDoc.allocatedProducts[productSn];
    }

    const copy = [...modalAllocations];
    copy[activeDocIndex] = currentDoc;
    setModalAllocations(copy);
  };

  const handleSaveAllocations = () => {
    if (!allocatingRetailer) return;
    partywiseAggregatorStore.saveRetailerAllocations(selectedMonthCode, allocatingRetailer.key, modalAllocations);
    setAllocatingRetailer(null);
    setRefreshTrigger(prev => prev + 1);
    setStatusMsg(`💾 ${allocatingRetailer.retailerName} ke ${modalAllocations.length} Doctors ki Product Allocations save ho gayi hain!`);
    setTimeout(() => setStatusMsg(null), 3500);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6 shadow-xl space-y-5">
      
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 transition cursor-pointer text-xs font-semibold"
          >
            <ArrowLeft size={15} /> Back to Statement
          </button>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              PARTYWISE ANALYSIS (DWARIKA &amp; MODI DISTRIBUTORS)
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full font-mono font-bold flex items-center gap-1">
                <Sparkles size={10} /> Dual Stockist Engine Active
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              BE: BANWARI LAL MEENA &bull; HQ: UDAIPUR &bull; Separate Dwarika &amp; Modi Data Pipelines
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-cyan-500/40">
            <Calendar size={13} className="text-cyan-400" />
            <span className="text-xs text-slate-400 font-semibold">Month:</span>
            <select
              value={selectedMonthCode}
              onChange={(e) => setSelectedMonthCode(e.target.value)}
              className="bg-transparent text-xs font-bold text-cyan-300 focus:outline-none cursor-pointer"
            >
              {MONTH_OPTIONS.map(opt => (
                <option key={opt.code} value={opt.code} className="bg-slate-900 text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleResetMonthData}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/80 rounded-xl text-xs font-bold transition cursor-pointer"
            title="Clear data for selected stockist/month"
          >
            <RotateCcw size={13} /> Reset
          </button>

          <label className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow">
            <Upload size={14} className={isParsing ? 'animate-bounce' : ''} />
            <span>
              {isParsing 
                ? 'Processing...' 
                : `Upload ${
                    selectedStockist === 'vardhman'
                      ? 'Vardhman'
                      : selectedStockist === 'nagda' 
                      ? 'Nagda' 
                      : selectedStockist === 'modi' 
                      ? 'Modi' 
                      : selectedStockist === 'dwarika' 
                      ? 'Dwarika' 
                      : 'Statement'
                  } PDF`}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf,.csv"
              disabled={isParsing}
              onChange={e => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
              className="hidden"
            />
          </label>

          <button
            onClick={() => exportPartywiseConsolidatedCSV(selectedMonthCode, selectedStockist)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow"
          >
            <Download size={14} /> Export CSV
          </button>

          <button
            onClick={() => exportPartywiseConsolidatedExcel(selectedMonthCode, selectedStockist)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow"
          >
            <FileSpreadsheet size={14} /> Export Excel
          </button>
        </div>
      </div>

      <CloudSyncBar
        storageKey={`statements/partywise_aggregator_${selectedMonthCode}_2026`}
        sheetTitle={`Partywise Analysis (${selectedMonthCode})`}
        getData={() => ({ 
          selectedMonthCode, 
          store: partywiseAggregatorStore.data,
          allocations: partywiseAggregatorStore.getAllocationsForMonth(selectedMonthCode)
        })}
        onLoadData={(cloudData: any) => {
          if (!cloudData) return;
          if (cloudData.store) {
            partywiseAggregatorStore.data = partywiseAggregatorStore.normalizeRawData(cloudData.store);
            partywiseAggregatorStore.persist();
          }
          if (cloudData.allocations) {
            try {
              const all = JSON.parse(localStorage.getItem('dios_chemist_doctor_allocations_v3') || '{}');
              all[selectedMonthCode] = cloudData.allocations;
              localStorage.setItem('dios_chemist_doctor_allocations_v3', JSON.stringify(all));
            } catch (e) {}
          }
          setRefreshTrigger(prev => prev + 1);
        }}
        onSaveLocal={() => {
          partywiseAggregatorStore.persist();
          setRefreshTrigger(prev => prev + 1);
        }}
      />

      {statusMsg && (
        <div className="p-3 bg-cyan-950/80 border border-cyan-500/60 text-cyan-200 rounded-xl text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span className="font-semibold">{statusMsg}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="p-1 hover:text-white cursor-pointer"><X size={15} /></button>
        </div>
      )}

      {/* 🌟 STOCKIST TABS (Dwarika vs Modi vs Consolidated) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar border-b border-slate-800">
        <span className="text-[10px] text-slate-400 uppercase font-bold pl-1 flex items-center gap-1">
          <Building2 size={13} className="text-cyan-400" /> Active Stockist:
        </span>
        {STOCKIST_TABS.map(st => {
          const isSelected = selectedStockist === st.id;
          const count = partywiseAggregatorStore.getMonthRetailers(selectedMonthCode, st.id).length;

          return (
            <button
              key={st.id}
              onClick={() => setSelectedStockist(st.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer border ${
                isSelected 
                  ? 'bg-cyan-600 text-white border-cyan-400 shadow-md' 
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              <span>{st.name}</span>
              {count > 0 && <span className="text-[10px] font-mono opacity-85">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* 4 DUAL-METRIC KPI STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 shadow-md">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Unique Retailers</div>
          <div className="text-xl font-bold text-white font-mono mt-1">
            {retailersList.length} <span className="text-xs font-normal text-slate-400">Chemists</span>
          </div>
          <div className="text-xs text-amber-400 font-mono mt-0.5">
            👨‍⚕️ {grandMetrics.allocatedChemistsCount} Chemists Allocated to MSL Drs
          </div>
        </div>

        <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 shadow-md">
          <div className="text-[10px] text-cyan-400 uppercase font-semibold">Total Billed &amp; Free Units</div>
          <div className="text-lg font-black text-cyan-300 font-mono mt-1">
            {grandMetrics.totSalesQty.toLocaleString()} <span className="text-xs text-cyan-400">Sales</span> + {grandMetrics.totFreeQty.toLocaleString()} <span className="text-xs text-amber-400">Free</span>
          </div>
          <div className="text-xs text-slate-300 font-mono font-bold mt-0.5">
            = {grandMetrics.totUnits.toLocaleString()} Total Units
          </div>
        </div>

        <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 shadow-md">
          <div className="text-[10px] text-emerald-400 uppercase font-semibold">Total Revenue (Sales Only)</div>
          <div className="text-xl font-black text-emerald-400 font-mono mt-1">
            ₹{grandMetrics.totSalesAmt.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 font-mono mt-0.5">
            Free Value: ₹{grandMetrics.totFreeAmt.toLocaleString()}
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-950/90 to-slate-950 p-3.5 rounded-2xl border-2 border-emerald-500/50 shadow-xl flex flex-col justify-between">
          <div className="text-[10px] text-emerald-300 uppercase font-black tracking-wide flex items-center justify-between">
            <span>TOTAL GROSS BUSINESS (QTY+FREE)</span>
            <Sparkles size={14} className="text-yellow-300 animate-pulse" />
          </div>
          <div className="text-2xl font-black text-emerald-300 font-mono mt-1">
            ₹{grandMetrics.totGrossAmt.toLocaleString()}
          </div>
        </div>
      </div>

      {/* VIEW SWITCHER TABS: CHEMIST DIRECTORY VS MSL DOCTOR LINKED SHEET */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
          <button
            onClick={() => setActiveTabMode('CHEMISTS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTabMode === 'CHEMISTS'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building2 size={15} />
            <span>🏢 Chemist Directory ({retailersList.length})</span>
          </button>

          <button
            onClick={() => setActiveTabMode('MSL_DOCTORS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTabMode === 'MSL_DOCTORS'
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 shadow-md shadow-amber-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Stethoscope size={15} />
            <span>👨‍⚕️ MSL Linked Doctor Intelligence ({doctorAnalyticsList.length})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search chemist, address, or doctor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* VIEW 1: CHEMIST DIRECTORY TABLE (FREEZE PANES UP TO ADDRESS) */}
      {activeTabMode === 'CHEMISTS' ? (
        <div className="overflow-x-auto max-h-[550px] border border-slate-800 rounded-2xl shadow-xl bg-slate-950 relative">
          <table className="w-full text-left text-xs border-separate border-spacing-0">
            <thead className="sticky top-0 bg-slate-950 text-slate-400 font-bold uppercase border-b border-slate-800 z-30">
              <tr>
                {/* ❄️ FROZEN COL 1: # (SrNo) */}
                <th style={{ width: '44px', minWidth: '44px', maxWidth: '44px', left: 0 }} className="p-3 text-center bg-slate-950 border-b border-r border-slate-800 sticky z-40 text-slate-400">
                  #
                </th>
                {/* ❄️ FROZEN COL 2: CHEMIST NAME */}
                <th style={{ width: '220px', minWidth: '220px', maxWidth: '220px', left: '44px' }} className="p-3 bg-slate-950 border-b border-r border-slate-800 sticky z-40 text-white">
                  Retailer / Chemist Name
                </th>
                {/* ❄️ FROZEN COL 3: ADDRESS (DIVIDER WITH CYAN BORDER) */}
                <th style={{ width: '130px', minWidth: '130px', maxWidth: '130px', left: '264px' }} className="p-3 bg-slate-950 border-b border-r-2 border-cyan-500 shadow-[3px_0_10px_rgba(0,0,0,0.5)] sticky z-40 text-cyan-300">
                  Address
                </th>
                <th className="p-3 min-w-[120px] text-slate-400 border-b border-r border-slate-800">Stockist</th>
                <th className="p-3 min-w-[240px] text-amber-400 border-b border-r border-slate-800">Allocated MSL Doctors</th>
                <th className="p-3 text-center w-24 text-cyan-400 border-b border-r border-slate-800">Sales Qty</th>
                <th className="p-3 text-center w-20 text-amber-400 border-b border-r border-slate-800">Free Qty</th>
                <th className="p-3 text-center w-24 text-slate-200 border-b border-r border-slate-800">Total Units</th>
                <th className="p-3 text-right min-w-[130px] text-emerald-400 border-b border-r border-slate-800">Sales Amount (₹)</th>
                <th className="p-3 text-right min-w-[140px] text-emerald-300 border-b border-r border-slate-800">Gross (₹ Qty+Free)</th>
                <th className="p-3 text-center w-16 border-b border-slate-800">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-xs bg-slate-900">
              {filteredRetailers.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-500 font-sans">
                    No retailer records for {selectedMonthCode} ({selectedStockist.toUpperCase()}). Upload statement PDF above to populate data!
                  </td>
                </tr>
              ) : (
                filteredRetailers.map((r, idx) => {
                  const allocs = partywiseAggregatorStore.getAllocationsForRetailer(selectedMonthCode, r.key);
                  const hasAllocs = allocs.length > 0;

                  return (
                    <tr key={r.key} className="hover:bg-slate-800/60 transition group">
                      {/* ❄️ FROZEN TD 1: # */}
                      <td style={{ width: '44px', minWidth: '44px', maxWidth: '44px', left: 0 }} className="p-2.5 text-center text-slate-500 border-b border-r border-slate-800/80 sticky z-20 bg-slate-900 group-hover:bg-slate-800">
                        {idx + 1}
                      </td>
                      {/* ❄️ FROZEN TD 2: NAME */}
                      <td style={{ width: '220px', minWidth: '220px', maxWidth: '220px', left: '44px' }} className="p-2.5 font-sans font-bold text-white border-b border-r border-slate-800/80 sticky z-20 bg-slate-900 group-hover:bg-slate-800 truncate">
                        {r.retailerName}
                      </td>
                      {/* ❄️ FROZEN TD 3: ADDRESS (DIVIDER) */}
                      <td style={{ width: '130px', minWidth: '130px', maxWidth: '130px', left: '264px' }} className="p-2.5 text-cyan-300 border-b border-r-2 border-cyan-500 shadow-[3px_0_10px_rgba(0,0,0,0.5)] sticky z-20 bg-slate-900 group-hover:bg-slate-800">
                        {r.address}
                      </td>
                      <td className="p-2.5 font-sans text-slate-400 border-b border-r border-slate-800/80">
                        {r.stockists.map(st => (
                          <span key={st} className={`inline-block px-1.5 py-0.5 rounded text-[10px] mr-1 ${st === 'Modi' ? 'bg-purple-950 text-purple-300 border border-purple-500/40' : 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'}`}>
                            {st}
                          </span>
                        ))}
                      </td>
                      
                      <td className="p-2 font-sans">
                        <button
                          type="button"
                          onClick={() => handleOpenAllocationModal(r)}
                          className={`w-full py-1.5 px-3 rounded-xl border text-xs font-semibold transition cursor-pointer flex items-center justify-between gap-1.5 text-left ${
                            hasAllocs
                              ? 'bg-amber-950/80 border-amber-500/60 text-amber-300 hover:bg-amber-900 shadow-sm'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div className="truncate flex items-center gap-1.5">
                            {hasAllocs ? (
                              <>
                                <Stethoscope size={13} className="text-amber-400 shrink-0" />
                                <span className="truncate">
                                  {allocs.length === 1 
                                    ? `Dr. ${allocs[0].doctorName} (${Object.keys(allocs[0].allocatedProducts).length} SKUs)`
                                    : `${allocs.length} Doctors (${allocs.map(a => a.doctorName.split(' ')[0]).join(', ')})`
                                  }
                                </span>
                              </>
                            ) : (
                              <span>+ Allocate Doctors &amp; SKUs</span>
                            )}
                          </div>
                          <ChevronRight size={14} className="shrink-0 text-amber-400" />
                        </button>
                      </td>

                      <td className="p-2.5 text-center font-bold text-cyan-300">{r.salesQty}</td>
                      <td className="p-2.5 text-center font-bold text-amber-300">{r.freeQty > 0 ? r.freeQty : '-'}</td>
                      <td className="p-2.5 text-center font-black text-white bg-slate-950/40">{r.totalQty}</td>
                      <td className="p-2.5 text-right font-bold text-emerald-400">₹{r.salesAmount.toLocaleString()}</td>
                      <td className="p-2.5 text-right font-black text-emerald-300 bg-emerald-950/20">₹{r.grossAmount.toLocaleString()}</td>
                      
                      <td className="p-2.5 text-center">
                        <button
                          onClick={() => setSelectedRetailer(r)}
                          className="p-1.5 text-cyan-400 hover:bg-cyan-500/20 rounded-lg transition cursor-pointer"
                          title="View 360° Breakdown"
                        >
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot className="sticky bottom-0 bg-slate-950 border-t-2 border-slate-700 font-bold z-30 text-xs font-mono">
              <tr>
                {/* ❄️ FROZEN FOOTER CELLS */}
                <td style={{ width: '44px', minWidth: '44px', maxWidth: '44px', left: 0 }} className="p-3 text-center text-cyan-400 border-r border-slate-800 sticky z-40 bg-slate-950">
                  Σ
                </td>
                <td style={{ width: '220px', minWidth: '220px', maxWidth: '220px', left: '44px' }} className="p-3 text-white font-sans uppercase border-r border-slate-800 sticky z-40 bg-slate-950">
                  GRAND TOTAL
                </td>
                <td style={{ width: '130px', minWidth: '130px', maxWidth: '130px', left: '264px' }} className="p-3 text-slate-300 font-mono border-r-2 border-cyan-500 shadow-[3px_0_10px_rgba(0,0,0,0.5)] sticky z-40 bg-slate-950">
                  {selectedMonthCode}
                </td>
                <td colSpan={2} className="p-3 text-slate-400 font-sans border-r border-slate-800">
                  {selectedStockist.toUpperCase()}
                </td>
                <td className="p-3 text-center text-cyan-300 font-black border-r border-slate-800/80">{grandMetrics.totSalesQty.toLocaleString()}</td>
                <td className="p-3 text-center text-amber-300 font-black border-r border-slate-800/80">{grandMetrics.totFreeQty.toLocaleString()}</td>
                <td className="p-3 text-center text-white font-black bg-slate-900 border-r border-slate-800/80">{grandMetrics.totUnits.toLocaleString()}</td>
                <td className="p-3 text-right text-emerald-400 font-black border-r border-slate-800/80">₹{grandMetrics.totSalesAmt.toLocaleString()}</td>
                <td className="p-3 text-right text-emerald-300 font-black bg-emerald-950/50 border-r border-slate-800/80">₹{grandMetrics.totGrossAmt.toLocaleString()}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        /* VIEW 2: MSL DOCTOR LINKED INTELLIGENCE SHEET (FROZEN DOCTOR PANES) */
        <div className="overflow-x-auto max-h-[550px] border border-slate-800 rounded-2xl shadow-xl bg-slate-950 relative">
          <table className="w-full text-left text-xs border-separate border-spacing-0">
            <thead className="sticky top-0 bg-slate-950 text-slate-400 font-bold uppercase border-b border-slate-800 z-30">
              <tr>
                <th style={{ width: '44px', minWidth: '44px', maxWidth: '44px', left: 0 }} className="p-3 text-center bg-slate-950 border-b border-r border-slate-800 sticky z-40 text-slate-400">
                  #
                </th>
                <th style={{ width: '200px', minWidth: '200px', maxWidth: '200px', left: '44px' }} className="p-3 bg-slate-950 border-b border-r border-slate-800 sticky z-40 text-amber-400">
                  MSL Doctor Name
                </th>
                <th style={{ width: '130px', minWidth: '130px', maxWidth: '130px', left: '244px' }} className="p-3 bg-slate-950 border-b border-r-2 border-amber-500 shadow-[3px_0_10px_rgba(0,0,0,0.5)] sticky z-40 text-slate-300">
                  Speciality
                </th>
                <th className="p-3 min-w-[240px] border-b border-r border-slate-800">Contributing Chemist Stores</th>
                <th className="p-3 text-center w-24 text-cyan-400">Sales Qty</th>
                <th className="p-3 text-center w-20 text-amber-400">Free Qty</th>
                <th className="p-3 text-center w-24 text-slate-200">Total Units</th>
                <th className="p-3 text-right min-w-[130px] text-emerald-400">Sales Amount (₹)</th>
                <th className="p-3 text-right min-w-[140px] text-emerald-300">Gross (₹ Qty+Free)</th>
                <th className="p-3 text-center w-20">Products</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-xs bg-slate-900">
              {filteredDoctorAnalytics.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500 font-sans">
                    Abhi tak koi bhi Chemist/Product kisi MSL Doctor ko allocate nahi hua hai.<br />
                    Upar <b>"Chemist Directory"</b> tab par jakar <b>"+ Allocate Doctors &amp; SKUs"</b> button dabayein!
                  </td>
                </tr>
              ) : (
                filteredDoctorAnalytics.map((doc, idx) => (
                  <tr key={doc.doctorName} className="hover:bg-slate-800/60 transition group">
                    <td style={{ width: '44px', minWidth: '44px', maxWidth: '44px', left: 0 }} className="p-2.5 text-center text-slate-500 border-b border-r border-slate-800/80 sticky z-20 bg-slate-900 group-hover:bg-slate-800">
                      {idx + 1}
                    </td>
                    <td style={{ width: '200px', minWidth: '200px', maxWidth: '200px', left: '44px' }} className="p-2.5 font-sans font-bold text-amber-300 border-b border-r border-slate-800/80 sticky z-20 bg-slate-900 group-hover:bg-slate-800 truncate">
                      Dr. {doc.doctorName}
                    </td>
                    <td style={{ width: '130px', minWidth: '130px', maxWidth: '130px', left: '244px' }} className="p-2.5 text-slate-300 border-b border-r-2 border-amber-500 shadow-[3px_0_10px_rgba(0,0,0,0.5)] sticky z-20 bg-slate-900 group-hover:bg-slate-800">
                      {doc.speciality}
                    </td>
                    
                    <td className="p-2.5 font-sans">
                      <div className="flex flex-wrap gap-1">
                        {doc.linkedRetailers.map((lr, lIdx) => (
                          <span key={lIdx} className="bg-slate-950 border border-slate-800 text-cyan-300 text-[10px] px-2 py-0.5 rounded-lg">
                            🏢 {lr.retailerName} (₹{lr.contributionAmount.toLocaleString()})
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="p-2.5 text-center font-bold text-cyan-300">{doc.salesQty}</td>
                    <td className="p-2.5 text-center font-bold text-amber-300">{doc.freeQty > 0 ? doc.freeQty : '-'}</td>
                    <td className="p-2.5 text-center font-black text-white bg-slate-950/40">{doc.totalQty}</td>
                    <td className="p-2.5 text-right font-bold text-emerald-400">₹{doc.salesAmount.toLocaleString()}</td>
                    <td className="p-2.5 text-right font-black text-emerald-300 bg-emerald-950/20">₹{doc.grossAmount.toLocaleString()}</td>
                    
                    <td className="p-2.5 text-center">
                      <button
                        onClick={() => setSelectedDoctorAnalytics(doc)}
                        className="px-2.5 py-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 text-slate-950 font-bold rounded-lg text-[10px] transition cursor-pointer flex items-center gap-1 mx-auto"
                      >
                        <Eye size={12} /> {Object.keys(doc.products).length} SKUs
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ALLOCATION MODAL (RETAINED IN FULL) */}
      {allocatingRetailer && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-2 md:p-4">
          <div className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl max-w-4xl w-full p-5 shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/40">
                  <Building2 size={22} />
                </span>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    {allocatingRetailer.retailerName}
                    <span className="text-[11px] font-mono bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30">
                      {allocatingRetailer.address}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Chemist Pool: <b className="text-cyan-300">{allocatingRetailer.salesQty} Sales</b> + <b className="text-amber-300">{allocatingRetailer.freeQty} Free</b> = <b className="text-white font-bold">{allocatingRetailer.totalQty} Total Units</b> &bull; Value: <b className="text-emerald-400">₹{allocatingRetailer.salesAmount.toLocaleString()}</b>
                  </p>
                </div>
              </div>
              <button onClick={() => setAllocatingRetailer(null)} className="text-slate-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
              <div className="text-xs font-bold text-amber-400 flex items-center justify-between">
                <span>1. Search &amp; Add Doctor for {allocatingRetailer.retailerName}:</span>
                <span className="text-[10px] text-slate-400 font-mono">123 MSL Doctors Ready</span>
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Type doctor name (e.g. Abhay, Dave, Deepak, Mona, Kapil)..."
                  value={doctorSearchQuery}
                  onChange={e => setDoctorSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pl-9 pr-3 py-1.5 text-xs focus:border-amber-400 focus:outline-none"
                />

                {doctorSearchQuery.trim().length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border-2 border-amber-500/60 rounded-xl shadow-2xl p-1.5 z-50 max-h-40 overflow-y-auto space-y-1">
                    {filteredMslDocsForSelector.map(doc => (
                      <div
                        key={doc.srNo}
                        onClick={() => handleAddDoctorToChemist(doc)}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-950 hover:bg-amber-950/60 border border-transparent hover:border-amber-500/40 text-xs cursor-pointer transition"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-500 text-[10px]">#{doc.srNo}</span>
                          <span className="font-bold text-white">Dr. {doc.doctorName}</span>
                          {doc.speciality && <span className="text-[10px] text-cyan-300 font-mono">({doc.speciality})</span>}
                        </div>
                        <span className="text-[10px] text-amber-400 font-bold">+ Add to Chemist</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {modalAllocations.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar border-b border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold pl-1">Allocating For:</span>
                {modalAllocations.map((alloc, idx) => {
                  const isActive = activeDocIndex === idx;
                  const allocatedSkuCount = Object.keys(alloc.allocatedProducts).length;

                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <span onClick={() => setActiveDocIndex(idx)}>
                        👨‍⚕️ Dr. {alloc.doctorName} ({allocatedSkuCount} SKUs)
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveDoctorFromChemist(idx)}
                        className="p-0.5 hover:text-rose-500 text-slate-500 rounded"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex-1 overflow-y-auto border border-slate-800 rounded-2xl p-2.5 bg-slate-950/70 space-y-2 max-h-[300px]">
              {modalAllocations.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 font-mono">
                  Upar search bar me doctor ka naam likh kar <b>"+ Add to Chemist"</b> karein.
                </div>
              ) : (
                <>
                  <div className="text-xs font-bold text-cyan-300 flex items-center justify-between pb-1 px-1 border-b border-slate-800/80">
                    <span>
                      2. Allocate Sales &amp; Free Units for <b className="text-amber-400 font-bold">Dr. {modalAllocations[activeDocIndex]?.doctorName}</b>:
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      SKU List ({Object.keys(allocatingRetailer.items).length} Items)
                    </span>
                  </div>

                  {Object.entries(allocatingRetailer.items).map(([snStr, it]) => {
                    const sn = Number(snStr);
                    const currentDoc = modalAllocations[activeDocIndex];
                    const allocData = currentDoc?.allocatedProducts[sn];
                    const isPrescribed = !!allocData;
                    const { otherSales, otherFree } = getOtherDoctorsAllocatedQty(sn, activeDocIndex);

                    const maxRemSales = Math.max(0, it.salesQty - otherSales);
                    const maxRemFree = Math.max(0, it.freeQty - otherFree);
                    const maxRemTotal = maxRemSales + maxRemFree;

                    return (
                      <div
                        key={sn}
                        className={`p-2.5 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                          isPrescribed
                            ? 'bg-slate-900 border-amber-500/60 shadow-sm'
                            : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-[210px]">
                          <input
                            type="checkbox"
                            checked={isPrescribed}
                            onChange={() => handleToggleProductForDoctor(sn, it)}
                            className="rounded text-amber-500 cursor-pointer h-4 w-4"
                          />
                          <div>
                            <div className="font-bold text-white">{it.productName || itemDesc(sn)}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              Pool: <b className="text-cyan-300">{it.salesQty} Sales</b> + <b className="text-amber-300">{it.freeQty} Free</b> = <b className="text-white">{it.totalQty} Units</b>
                            </div>
                          </div>
                        </div>

                        <div className="text-[10px] font-mono text-slate-400">
                          {otherSales > 0 || otherFree > 0 ? (
                            <span className="text-purple-300">
                              Others: {otherSales}S+{otherFree}F | Rem: <b className="text-emerald-400">{maxRemSales}S+{maxRemFree}F ({maxRemTotal})</b>
                            </span>
                          ) : (
                            <span className="text-emerald-400 font-bold">
                              Full Pool: {maxRemSales}S+{maxRemFree}F ({maxRemTotal})
                            </span>
                          )}
                        </div>

                        {isPrescribed ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleProductForDoctor(sn, it)}
                              className="px-2 py-1 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/50 rounded-lg text-[10px] font-bold cursor-pointer"
                            >
                              Full Rem ({maxRemTotal})
                            </button>

                            <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-cyan-500/40">
                              <span className="text-[10px] text-cyan-400 font-bold">Sales:</span>
                              <input
                                type="number"
                                placeholder="0"
                                value={allocData.salesQty}
                                onChange={e => handleSetCustomQty(sn, it, e.target.value, String(allocData.freeQty))}
                                className="w-12 bg-transparent text-cyan-300 font-mono font-bold text-xs text-center focus:outline-none"
                              />
                            </div>

                            <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-amber-500/40">
                              <span className="text-[10px] text-amber-400 font-bold">Free:</span>
                              <input
                                type="number"
                                placeholder="0"
                                value={allocData.freeQty}
                                onChange={e => handleSetCustomQty(sn, it, String(allocData.salesQty), e.target.value)}
                                className="w-10 bg-transparent text-amber-300 font-mono font-bold text-xs text-center focus:outline-none"
                              />
                            </div>

                            <span className="bg-slate-950 border border-slate-700 text-white font-mono font-bold px-2 py-1 rounded-lg text-[11px]">
                              Total: {allocData.totalQty}
                            </span>

                            <span className="text-emerald-400 font-mono font-bold w-20 text-right">
                              ₹{allocData.salesAmount.toLocaleString()}
                            </span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleProductForDoctor(sn, it)}
                            className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 rounded-lg text-[11px] font-semibold cursor-pointer"
                          >
                            + Allocate
                          </button>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <div className="text-xs font-mono text-slate-300">
                Doctors Configured: <b className="text-amber-400 font-bold">{modalAllocations.length}</b>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAllocatingRetailer(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSaveAllocations}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg cursor-pointer flex items-center gap-1.5"
                >
                  <Check size={15} /> Save &amp; Lock Allocations
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 360-DEGREE DOCTOR PRODUCT ANALYTICS MODAL */}
      {selectedDoctorAnalytics && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/50 rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl">
                  <Stethoscope size={22} />
                </span>
                <div>
                  <h3 className="text-base font-bold text-white">Dr. {selectedDoctorAnalytics.doctorName}</h3>
                  <p className="text-xs text-amber-300 font-mono">
                    Speciality: {selectedDoctorAnalytics.speciality} &bull; Month: {selectedMonthCode} 2026
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedDoctorAnalytics(null)} className="text-slate-400 hover:text-white cursor-pointer"><X size={18} /></button>
            </div>

            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Contributing Chemist Stores:</div>
              <div className="flex flex-wrap gap-1.5">
                {selectedDoctorAnalytics.linkedRetailers.map((lr, i) => (
                  <span key={i} className="bg-slate-900 border border-slate-700 text-cyan-300 text-xs px-2.5 py-1 rounded-xl">
                    🏢 {lr.retailerName} (Sales: ₹{lr.contributionAmount.toLocaleString()} | Gross: ₹{lr.contributionGross.toLocaleString()})
                  </span>
                ))}
              </div>
            </div>

            <div className="overflow-y-auto flex-1 border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-950 text-slate-400 font-bold uppercase border-b border-slate-800">
                  <tr>
                    <th className="p-2.5 text-center w-10">#</th>
                    <th className="p-2.5">Product Name</th>
                    <th className="p-2.5 text-center w-24 text-cyan-400">Sales Qty</th>
                    <th className="p-2.5 text-center w-20 text-amber-400">Free Qty</th>
                    <th className="p-2.5 text-center w-24 text-slate-200">Total Units</th>
                    <th className="p-2.5 text-right w-28 text-emerald-400">Sales Amount (₹)</th>
                    <th className="p-2.5 text-right w-28 text-emerald-300">Gross (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-xs bg-slate-900">
                  {Object.entries(selectedDoctorAnalytics.products).map(([snStr, p], idx) => (
                    <tr key={snStr} className="hover:bg-slate-800/40">
                      <td className="p-2.5 text-center text-slate-500">{idx + 1}</td>
                      <td className="p-2.5 font-sans font-semibold text-white">{p.productName}</td>
                      <td className="p-2.5 text-center font-bold text-cyan-300">{p.salesQty}</td>
                      <td className="p-2.5 text-center font-bold text-amber-300">{p.freeQty > 0 ? p.freeQty : '-'}</td>
                      <td className="p-2.5 text-center font-black text-white">{p.totalQty}</td>
                      <td className="p-2.5 text-right font-bold text-emerald-400">₹{p.salesAmount.toLocaleString()}</td>
                      <td className="p-2.5 text-right font-black text-emerald-300">₹{p.grossAmount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300">
                Total Revenue: <b className="text-emerald-400 text-sm">₹{selectedDoctorAnalytics.salesAmount.toLocaleString()}</b> (Gross with Free: ₹{selectedDoctorAnalytics.grossAmount.toLocaleString()})
              </span>
              <button onClick={() => setSelectedDoctorAnalytics(null)} className="px-5 py-2 bg-slate-800 text-white font-bold rounded-xl cursor-pointer">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* 360-DEGREE RETAILER DETAIL MODAL */}
      {selectedRetailer && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500/50 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <span className="p-2 bg-cyan-500/20 text-cyan-400 rounded-xl">
                  <Building2 size={20} />
                </span>
                <div>
                  <h3 className="text-base font-bold text-white">{selectedRetailer.retailerName}</h3>
                  <p className="text-xs text-cyan-400 font-mono">Location: {selectedRetailer.address} &bull; Month: {selectedMonthCode}</p>
                </div>
              </div>
              <button onClick={() => setSelectedRetailer(null)} className="text-slate-400 hover:text-white cursor-pointer"><X size={18} /></button>
            </div>

            <div className="overflow-y-auto flex-1 border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-950 text-slate-400 font-bold uppercase border-b border-slate-800">
                  <tr>
                    <th className="p-2.5 text-center w-10">#</th>
                    <th className="p-2.5">Product Name</th>
                    <th className="p-2.5 text-center w-20 text-cyan-400">Sales Qty</th>
                    <th className="p-2.5 text-center w-20 text-amber-400">Free Qty</th>
                    <th className="p-2.5 text-center w-20 text-white">Total</th>
                    <th className="p-2.5 text-right w-24 text-emerald-400">Sales (₹)</th>
                    <th className="p-2.5 text-right w-24 text-emerald-300">Gross (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                  {Object.entries(selectedRetailer.items).map(([snStr, it], idx) => (
                    <tr key={snStr} className="hover:bg-slate-800/40">
                      <td className="p-2 text-center text-slate-500">{idx + 1}</td>
                      <td className="p-2 font-sans font-semibold text-white">{it.productName || itemDesc(Number(snStr))}</td>
                      <td className="p-2 text-center font-bold text-cyan-300">{it.salesQty}</td>
                      <td className="p-2 text-center font-bold text-amber-300">{it.freeQty > 0 ? it.freeQty : '-'}</td>
                      <td className="p-2 text-center font-black text-white">{it.totalQty}</td>
                      <td className="p-2 text-right font-bold text-emerald-300">₹{it.salesAmount.toLocaleString()}</td>
                      <td className="p-2 text-right font-black text-emerald-300">₹{it.grossAmount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400 font-mono">
                Total Business: <b className="text-emerald-400">₹{selectedRetailer.salesAmount.toLocaleString()}</b> (Gross: ₹{selectedRetailer.grossAmount.toLocaleString()})
              </span>
              <button onClick={() => setSelectedRetailer(null)} className="px-5 py-2 bg-slate-800 text-white font-bold rounded-xl cursor-pointer">Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

function itemDesc(sn: number): string {
  const found = MASTER_PRODUCTS.find((p: any) => p.sn === sn);
  return found ? found.name : `Product #${sn}`;
}
