/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  MapPin, 
  Briefcase, 
  Cpu, 
  ExternalLink, 
  Mail, 
  CheckCircle2, 
  Loader2, 
  FileText, 
  Layout, 
  Copy, 
  AlertCircle,
  RefreshCw,
  ChevronRight
} from 'lucide-react';
import { US_CITIES, NICHES, NICHE_CATEGORIES } from './constants';
import axios from 'axios';

interface Lead {
  name: string;
  website: string;
  address?: string;
  city?: string;
  state?: string;
  place_id?: string;
  // Processing states
  status: 'pending' | 'processing' | 'completed' | 'error';
  step: 'scraping' | 'extracting' | 'capturing' | 'auditing' | 'drafting' | 'done';
  email?: string;
  audit?: { score: number; findings: string };
  draft?: { subject: string; body: string };
  screenshot?: string;
  error?: string;
}

export default function App() {
  const [niche, setNiche] = useState(NICHES[0]);
  const [city, setCity] = useState(US_CITIES[0].city);
  const [state, setState] = useState(US_CITIES[0].state);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [activeNav, setActiveNav] = useState<'dashboard' | 'analytics' | 'campaigns'>('dashboard');
  const [auditSlide, setAuditSlide] = useState(0);

  const [error, setError] = useState<string | null>(null);

  // Auto-update state when city changes
  const handleCityChange = (newCity: string) => {
    setCity(newCity);
    const mapping = US_CITIES.find(c => c.city === newCity);
    if (mapping) {
      setState(mapping.state);
    }
  };

  const startSearch = async () => {
    setIsSearching(true);
    setError(null);
    setLeads([]);
    setProcessedCount(0);
    setSelectedIdx(null);
    
    try {
      const categories = NICHE_CATEGORIES[niche];
      const response = await axios.post('/api/search-leads', { niche, city, state, categories });
      const foundLeads = (response.data.leads || []).map((l: any) => ({
        ...l,
        status: 'pending',
        step: 'scraping'
      }));
      
      if (foundLeads.length === 0) {
        setError("No leads found with a website in this area. Try a different city or niche.");
      }

      setLeads(foundLeads);
      if (foundLeads.length > 0) setSelectedIdx(0);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to search for leads. Please check your API keys.");
    } finally {
      setIsSearching(false);
    }
  };

  const processAllLeads = async () => {
    for (let i = 0; i < leads.length; i++) {
      await processLead(i);
      setProcessedCount(i + 1);
    }
  };

  const processLead = async (index: number) => {
    const lead = leads[index];
    if (lead.status === 'completed') return;

    updateLead(index, { status: 'processing', step: 'extracting' });

    try {
      // Simulate steps for UI feel
      const steps: Lead['step'][] = ['extracting', 'capturing', 'auditing', 'drafting'];
      for (const step of steps) {
        updateLead(index, { step });
        await new Promise(r => setTimeout(r, 600));
      }
      
      const response = await axios.post('/api/process-lead', { website: lead.website, name: lead.name, niche });
      
      updateLead(index, { 
        status: 'completed', 
        step: 'done',
        email: response.data.email,
        audit: response.data.audit,
        draft: response.data.draft,
        screenshot: response.data.screenshot
      });
    } catch (error) {
      updateLead(index, { status: 'error', error: 'Process failed' });
    }
  };

  const updateLead = (index: number, updates: Partial<Lead>) => {
    setLeads(prev => prev.map((l, i) => i === index ? { ...l, ...updates } : l));
  };

  const selectedLead = selectedIdx !== null ? leads[selectedIdx] : null;

  return (
    <div className="h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden flex flex-col">
      {/* Navbar */}
      <nav className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-slate-900/50 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">ProspectPilot</span>
        </div>
        <div className="flex items-center gap-6 text-sm font-medium">
          <span 
            onClick={() => setActiveNav('dashboard')}
            className={`cursor-pointer hidden sm:block transition-colors ${activeNav === 'dashboard' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Dashboard
          </span>
          <span 
            onClick={() => setActiveNav('analytics')}
            className={`cursor-pointer hidden sm:block transition-colors ${activeNav === 'analytics' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Analytics
          </span>
          <span 
            onClick={() => setActiveNav('campaigns')}
            className={`cursor-pointer hidden sm:block transition-colors ${activeNav === 'campaigns' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Campaigns
          </span>
          <div className="h-8 w-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-[10px] font-bold text-slate-500">AP</div>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden p-4 gap-4">
        {activeNav === 'dashboard' ? (
          <>
            {/* Left Sidebar */}
        <aside className="w-80 flex flex-col gap-4 shrink-0 overflow-y-auto pb-4">
          <section className="bg-slate-900/80 border border-white/5 rounded-2xl p-4 shadow-xl">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-1">Search Parameters</h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-500 ml-1">Industry Niche</label>
                <select 
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer"
                >
                  {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-500 ml-1">Target City</label>
                <div className="relative">
                  <select 
                    value={city}
                    onChange={(e) => handleCityChange(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer"
                  >
                    {US_CITIES.map(c => <option key={c.city} value={c.city}>{c.city}</option>)}
                  </select>
                  <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-500 ml-1">State</label>
                <input 
                  type="text" 
                  value={state} 
                  disabled 
                  className="w-full bg-slate-950 border border-slate-800 text-slate-600 rounded-xl px-3 py-2 text-sm cursor-not-allowed font-medium"
                />
              </div>
              <button 
                onClick={startSearch}
                disabled={isSearching}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-all text-sm shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 group"
              >
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin text-white/70" /> : <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />}
                {isSearching ? "Finding Leads..." : "Start Extraction Pipeline"}
              </button>
            </div>
          </section>

          <section className="flex-1 bg-slate-900/80 border border-white/5 rounded-2xl p-4 overflow-hidden flex flex-col shadow-xl">
            <div className="flex items-center justify-between mb-4 px-1">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Scraped Leads</h3>
              <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-full text-[10px] border border-indigo-500/20 font-bold">
                {leads.length} Found
              </span>
            </div>
            
            <div className="space-y-3 overflow-y-auto pr-1 flex-1 custom-scrollbar">
              <AnimatePresence mode="popLayout">
                {leads.map((lead, idx) => (
                  <motion.div 
                    key={lead.place_id || idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    onClick={() => {
                      setSelectedIdx(idx);
                      setAuditSlide(0);
                    }}
                    className={`p-3 rounded-xl cursor-pointer transition-all border group ${
                      selectedIdx === idx 
                        ? 'bg-slate-800 border-indigo-500/50 ring-1 ring-indigo-500/20 shadow-lg' 
                        : 'bg-slate-800/30 border-white/5 hover:border-white/10 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <span className={`text-sm font-semibold truncate ${selectedIdx === idx ? 'text-white' : 'text-slate-300'}`}>
                        {lead.name}
                      </span>
                      {lead.audit && (
                        <span className={`text-xs font-black shrink-0 ${
                          lead.audit.score > 75 ? 'text-emerald-400' : lead.audit.score > 50 ? 'text-amber-400' : 'text-rose-400'
                        }`}>
                          {lead.audit.score}%
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 block truncate font-mono uppercase tracking-tighter">
                      {lead.website.replace(/^https?:\/\//, '')}
                    </span>
                    
                    <div className="mt-2.5 flex items-center gap-2">
                      <div className="h-1 flex-1 bg-slate-950 rounded-full overflow-hidden">
                        <motion.div 
                          className={`h-full ${
                            lead.status === 'completed' ? 'bg-emerald-500' : 'bg-indigo-500'
                          }`}
                          initial={{ width: 0 }}
                          animate={{ 
                            width: lead.status === 'completed' ? '100%' : 
                                   lead.status === 'processing' ? '60%' : '0%' 
                          }}
                        />
                      </div>
                      <span className="text-[9px] text-slate-600 uppercase font-black tracking-widest min-w-[50px] text-right">
                        {lead.status === 'completed' ? "Ready" : lead.status === 'processing' ? "Auditing" : "Queued"}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {leads.length === 0 && !isSearching && !error && (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 gap-4 opacity-30">
                  <Layout className="w-10 h-10" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">No Leads Extracted</p>
                </div>
              )}

              {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center space-y-2">
                  <AlertCircle className="w-5 h-5 text-rose-500 mx-auto" />
                  <p className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">{error}</p>
                </div>
              )}
            </div>

            {leads.length > 0 && (
              <button 
                onClick={processAllLeads}
                disabled={leads.every(l => l.status === 'completed') || leads.some(l => l.status === 'processing')}
                className="mt-4 w-full py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-20"
              >
                Launch Pipeline for All
              </button>
            )}
          </section>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col gap-4 overflow-hidden">
          {selectedLead ? (
            <div className="flex-1 grid grid-cols-1 xl:grid-cols-2 grid-rows-2 gap-4 overflow-hidden">
              {/* Top Card: Overview */}
              <motion.div 
                layoutId={`lead-header-${selectedLead.place_id}`}
                className="col-span-1 xl:col-span-2 row-span-1 bg-slate-900 border border-white/5 rounded-3xl flex flex-col overflow-hidden shadow-2xl relative"
              >
                <div className="flex h-full flex-col md:flex-row">
                  <div className="md:w-1/2 p-10 flex flex-col justify-center relative z-10 bg-slate-900">
                    <div className="flex items-center gap-3 mb-6">
                      {selectedLead.audit ? (
                        <div className={`px-4 py-1 rounded-full text-xs font-black border tracking-widest uppercase ${
                          selectedLead.audit.score > 75 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          Score: {selectedLead.audit.score}/100
                        </div>
                      ) : (
                        <div className="px-4 py-1 bg-slate-800 text-slate-500 rounded-full text-xs font-black border border-white/5 tracking-widest uppercase">
                          Pending Audit
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 font-mono">
                        <div className={`w-2 h-2 rounded-full ${selectedLead.email ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`}></div>
                        {selectedLead.email || "finding contact..."}
                      </div>
                    </div>

                    <h2 className="text-4xl font-extrabold text-white mb-3 tracking-tighter leading-tight">
                      {selectedLead.name}
                    </h2>
                    
                    <p className="text-slate-400 text-base leading-relaxed max-w-lg mb-8">
                      {selectedLead.audit?.findings.split('.')[0]}. Typically, such issues lead to lower conversion rates in local {niche.toLowerCase()} markets.
                    </p>

                    <div className="flex gap-8">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-slate-600 uppercase font-bold tracking-widest">Address</span>
                        <span className="text-sm text-slate-400 truncate max-w-[150px]">{selectedLead.address || "N/A"}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-slate-600 uppercase font-bold tracking-widest">Niche</span>
                        <span className="text-sm text-indigo-400 font-bold">{niche}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-slate-600 uppercase font-bold tracking-widest">Status</span>
                        <span className="text-sm text-emerald-400 italic">{selectedLead.status === 'completed' ? 'Verified' : 'Pending'}</span>
                      </div>
                    </div>
                    
                    {selectedLead.status === 'pending' && (
                      <button 
                        onClick={() => processLead(selectedIdx!)}
                        className="mt-8 self-start bg-white text-slate-950 font-black px-8 py-3 rounded-2xl hover:bg-slate-200 transition-all text-sm uppercase tracking-widest shadow-xl shadow-white/5"
                      >
                        Audit Now
                      </button>
                    )}

                    {selectedLead.status === 'error' && (
                      <div className="mt-8 flex flex-col gap-3">
                         <div className="flex items-center gap-2 text-rose-500 font-bold text-xs uppercase tracking-widest">
                           <AlertCircle className="w-4 h-4" />
                           {selectedLead.error || "Processing Failed"}
                         </div>
                         <button 
                           onClick={() => processLead(selectedIdx!)}
                           className="self-start text-xs font-black text-indigo-400 hover:text-indigo-300 underline underline-offset-4 uppercase tracking-widest"
                         >
                           Retry Analysis
                         </button>
                      </div>
                    )}
                  </div>

                  <div className="md:w-1/2 bg-slate-800 p-3 border-l border-white/5 relative overflow-hidden group">
                    <div className="w-full h-full bg-slate-950 rounded-2xl overflow-hidden relative border border-white/5 shadow-inner">
                      {selectedLead.screenshot ? (
                        <>
                          <img 
                            referrerPolicy="no-referrer" 
                            src={selectedLead.screenshot} 
                            alt="Audit Snapshot" 
                            className="w-full h-full object-cover object-top opacity-50 group-hover:scale-105 transition-transform duration-1000" 
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent opacity-60" />
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-950 flex-col gap-3">
                           <div className="w-12 h-12 rounded-full border-2 border-white/5 border-t-indigo-500/30 animate-spin" />
                           <span className="font-mono text-[10px] text-slate-700 tracking-widest uppercase">Waiting for Capture</span>
                        </div>
                      )}
                      
                      {selectedLead.audit && (
                        <div className="absolute bottom-6 left-6 right-6 bg-slate-900/90 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-2xl transform translate-y-2 group-hover:translate-y-0 transition-transform">
                          <div className="flex items-center gap-2 mb-2">
                             <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
                             <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest">AI Vision Analysis</span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed italic">
                            "{selectedLead.audit.findings}"
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Bottom Left: Detailed Findings */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900 border border-white/5 rounded-3xl p-8 flex flex-col shadow-2xl"
              >
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">Website Audit Logs</h3>
                  {selectedLead.audit && (
                    <div className="flex gap-1.5">
                      {selectedLead.audit.findings.split('.').filter(f => f.trim().length > 0).map((_, i) => (
                        <button 
                          key={i}
                          onClick={() => setAuditSlide(i)}
                          className={`w-2 h-2 rounded-full transition-all ${auditSlide === i ? 'bg-indigo-500 w-4' : 'bg-slate-800'}`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-hidden relative">
                  {selectedLead.audit ? (
                    <div className="h-full">
                      <AnimatePresence mode="wait">
                        {selectedLead.audit.findings.split('.').filter(f => f.trim().length > 0).map((finding, fidx) => (
                          fidx === auditSlide && (
                            <motion.div 
                              key={fidx}
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -20 }}
                              className="h-full flex flex-col justify-center"
                            >
                              <div className="bg-slate-800/20 p-8 rounded-3xl border border-white/5 space-y-6">
                                <span className={`text-4xl ${fidx === 0 ? 'text-rose-500' : 'text-amber-500'}`}>
                                  {fidx === 0 ? '×' : '⚠'}
                                </span>
                                <p className="text-xl text-slate-300 leading-relaxed font-semibold italic">
                                  "{finding.trim()}."
                                </p>
                                <div className="text-xs text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
                                   <div className="w-1 h-1 bg-indigo-500 rounded-full"></div>
                                   Impact: High conversion bottleneck
                                </div>
                              </div>
                            </motion.div>
                          )
                        ))}
                      </AnimatePresence>
                      
                      <div className="absolute bottom-0 left-0 right-0 flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest pt-4 border-t border-white/5">
                        <span>Observation {auditSlide + 1}</span>
                        <div className="flex gap-4">
                          <button 
                            disabled={auditSlide === 0}
                            onClick={() => setAuditSlide(s => s - 1)}
                            className="hover:text-white disabled:opacity-20"
                          >Prev</button>
                          <button 
                            disabled={auditSlide === selectedLead.audit.findings.split('.').filter(f => f.trim().length > 0).length - 1}
                            onClick={() => setAuditSlide(s => s + 1)}
                            className="hover:text-white disabled:opacity-20"
                          >Next</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center py-10 opacity-20 flex-col gap-4">
                      <Layout className="w-12 h-12" />
                      <p className="font-bold text-xs uppercase tracking-widest text-center">Run analysis to populate logs</p>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Bottom Right: Email Draft */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-indigo-900/10 border border-indigo-500/20 rounded-3xl p-8 flex flex-col ring-1 ring-indigo-500/10 shadow-2xl relative overflow-hidden"
              >
                <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px]" />
                
                <div className="flex items-center justify-between mb-6 relative z-10">
                  <h3 className="text-sm font-black text-indigo-300 uppercase tracking-[0.2em]">Outreach Copy</h3>
                  {selectedLead.draft && (
                    <button 
                      onClick={() => navigator.clipboard.writeText(`${selectedLead.draft?.subject}\n\n${selectedLead.draft?.body}`)}
                      className="text-[10px] bg-indigo-500/10 text-indigo-300 px-3 py-1.5 rounded-lg border border-indigo-500/30 hover:bg-indigo-500/20 font-black uppercase tracking-widest transition-all"
                    >
                      Copy All
                    </button>
                  )}
                </div>

                <div className="flex-1 bg-slate-950/40 backdrop-blur-sm rounded-2xl p-6 border border-indigo-500/10 overflow-auto custom-scrollbar relative z-10 shadow-inner">
                  {selectedLead.draft ? (
                    <div className="space-y-4">
                      <div className="flex flex-col gap-2 pb-4 border-b border-white/5">
                        <span className="text-[9px] text-slate-600 uppercase font-bold tracking-widest">Subject Line</span>
                        <span className="text-sm font-bold text-indigo-200">{selectedLead.draft.subject}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] text-slate-600 uppercase font-bold tracking-widest">Body</span>
                        <div className="text-xs text-slate-400 leading-[1.8] font-mono whitespace-pre-wrap">
                          {selectedLead.draft.body}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center opacity-20 flex-col gap-4 py-10">
                      <Mail className="w-12 h-12" />
                      <p className="font-bold text-xs uppercase tracking-widest text-center">Drafting AI Copy...</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-20 gap-8 bg-slate-900 border border-white/5 rounded-3xl opacity-50">
               <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center border border-white/5 shadow-2xl">
                 <Cpu className="w-10 h-10 text-slate-600" />
               </div>
               <div className="space-y-3">
                 <h2 className="text-2xl font-black text-white uppercase tracking-widest">System Standby</h2>
                 <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">
                   Lead parsing engine is currently idling. Initiate a search or select an extracted prospect from the sidebar to begin competitive auditing.
                 </p>
               </div>
            </div>
          )}
        </main>
      </>
        ) : activeNav === 'analytics' ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 border border-white/5 rounded-3xl p-12 text-center gap-6 shadow-2xl">
            <div className="w-20 h-20 bg-indigo-600/10 rounded-full flex items-center justify-center border border-indigo-500/20 shadow-xl">
              <RefreshCw className="w-8 h-8 text-indigo-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white uppercase tracking-widest">Global Analytics</h2>
              <p className="text-slate-500 max-w-sm">Aggregating conversion data from all processed leads. This module will integrate with your SMTP/G-Workspace logs.</p>
            </div>
            <div className="grid grid-cols-3 gap-6 w-full max-w-2xl mt-8">
               {[
                 { label: 'Total Scraped', val: '1,280' },
                 { label: 'Emails Found', val: '840' },
                 { label: 'Audit Avg', val: '62%' }
               ].map(stat => (
                 <div key={stat.label} className="bg-slate-950 p-6 rounded-2xl border border-white/5">
                    <div className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-1">{stat.label}</div>
                    <div className="text-2xl font-black text-white">{stat.val}</div>
                 </div>
               ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 border border-white/5 rounded-3xl p-12 text-center gap-6 shadow-2xl">
            <div className="w-20 h-20 bg-emerald-600/10 rounded-full flex items-center justify-center border border-emerald-500/20 shadow-xl">
              <Mail className="w-8 h-8 text-emerald-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white uppercase tracking-widest">Campaign Manager</h2>
              <p className="text-slate-500 max-w-sm">Schedule and track cold email sequences. Connect your email provider to launch the drafts generated in the dashboard.</p>
            </div>
            <div className="mt-8 px-8 py-3 bg-white text-slate-950 font-black rounded-xl uppercase tracking-widest text-xs cursor-pointer hover:bg-slate-200 transition-all">
               Connect SMTP Provider
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LeadCard({ lead, onProcess, index, key }: { lead: Lead; onProcess: () => void | Promise<void>; index: number; key?: any }) {
  // This component is no longer used in the main flow but kept for structure or simple results if needed.
  return null;
}
