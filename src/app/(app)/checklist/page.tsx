"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckSquare, Square, Plus, Trash2, Loader2, Search,
  ClipboardList, CheckCircle2, Camera, ChevronDown, ChevronUp, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";
function authH() { return { Authorization: `Bearer ${localStorage.getItem("access_token") ?? ""}` }; }
function jsonH() { return { "Content-Type": "application/json", ...authH() }; }

const CATEGORIES = [
  { key: "pre_shoot",  label: "Pre-Shoot",   color: "bg-blue-100 text-blue-700 border-blue-200"   },
  { key: "day_of",     label: "Day Of",      color: "bg-amber-100 text-amber-700 border-amber-200" },
  { key: "post_shoot", label: "Post-Shoot",  color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { key: "general",   label: "General",     color: "bg-slate-100 text-slate-600 border-slate-200" },
];
const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));

interface ChecklistItem { id: string; label: string; category: string; isChecked: boolean; sortOrder: number; }
interface Booking { id: string; bookingNumber: string; eventName?: string; status: string; }

export default function ChecklistPage() {
  const [view, setView] = useState<"templates" | "program">("templates");
  const [templates, setTemplates] = useState<ChecklistItem[]>([]);
  const [programItems, setProgramItems] = useState<ChecklistItem[]>([]);
  const [programInfo, setProgramInfo] = useState<Booking | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [addingFor, setAddingFor] = useState<"template" | "program" | null>(null);
  const [bookingSearch, setBookingSearch] = useState("");
  const [showBookingList, setShowBookingList] = useState(false);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`${API}/checklist/templates`, { headers: authH() });
    if (r.ok) setTemplates(await r.json());
    setLoading(false);
  }, []);

  const loadBookings = useCallback(async () => {
    const r = await fetch(`${API}/bookings?limit=50`, { headers: authH() });
    if (r.ok) {
      const d = await r.json();
      setBookings(Array.isArray(d) ? d : (d.items ?? []));
    }
  }, []);

  useEffect(() => { loadTemplates(); loadBookings(); }, [loadTemplates, loadBookings]);

  async function loadProgramChecklist(bookingId: string) {
    setLoading(true);
    const r = await fetch(`${API}/checklist/programs/${bookingId}`, { headers: authH() });
    if (r.ok) {
      const d = await r.json();
      setProgramInfo(d.booking);
      setProgramItems(d.items);
    }
    setLoading(false);
  }

  async function toggleItem(item: ChecklistItem, isProg: boolean) {
    const r = await fetch(`${API}/checklist/items/${item.id}`, {
      method: "PATCH", headers: jsonH(), body: JSON.stringify({ isChecked: !item.isChecked }),
    });
    if (r.ok) {
      if (isProg) setProgramItems(p => p.map(x => x.id === item.id ? { ...x, isChecked: !x.isChecked } : x));
      else setTemplates(p => p.map(x => x.id === item.id ? { ...x, isChecked: !x.isChecked } : x));
    }
  }

  async function deleteItem(id: string, isProg: boolean) {
    const r = await fetch(`${API}/checklist/items/${id}`, { method: "DELETE", headers: authH() });
    if (r.ok) {
      if (isProg) setProgramItems(p => p.filter(x => x.id !== id));
      else setTemplates(p => p.filter(x => x.id !== id));
    }
  }

  async function addItem() {
    if (!newLabel.trim()) return;
    if (addingFor === "template") {
      const r = await fetch(`${API}/checklist/templates`, {
        method: "POST", headers: jsonH(), body: JSON.stringify({ label: newLabel, category: newCategory }),
      });
      if (r.ok) { const item = await r.json(); setTemplates(p => [...p, item]); setNewLabel(""); setAddingFor(null); }
    } else if (addingFor === "program" && selectedBookingId) {
      const r = await fetch(`${API}/checklist/programs/${selectedBookingId}`, {
        method: "POST", headers: jsonH(), body: JSON.stringify({ label: newLabel, category: newCategory }),
      });
      if (r.ok) { const item = await r.json(); setProgramItems(p => [...p, item]); setNewLabel(""); setAddingFor(null); }
    }
  }

  const grouped = (items: ChecklistItem[]) => {
    const g: Record<string, ChecklistItem[]> = {};
    for (const item of items) {
      if (!g[item.category]) g[item.category] = [];
      g[item.category].push(item);
    }
    return g;
  };

  const filteredBookings = bookings.filter(b =>
    b.bookingNumber.toLowerCase().includes(bookingSearch.toLowerCase()) ||
    (b.eventName ?? "").toLowerCase().includes(bookingSearch.toLowerCase())
  );

  const progChecked = programItems.filter(i => i.isChecked).length;
  const progTotal = programItems.length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-indigo-600" />
            Checklist
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Manage shoot day tasks and per-program checklists</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView("templates")}
            className={cn("h-9 px-4 rounded-xl text-sm font-medium border transition-all",
              view === "templates" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-200")}>
            Templates
          </button>
          <button onClick={() => setView("program")}
            className={cn("h-9 px-4 rounded-xl text-sm font-medium border transition-all",
              view === "program" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-200")}>
            By Program
          </button>
        </div>
      </div>

      {/* ── Templates View ── */}
      {view === "templates" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Default tasks auto-assigned to every new program checklist</p>
            <button onClick={() => setAddingFor("template")}
              className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" />Add Task
            </button>
          </div>

          {addingFor === "template" && (
            <div className="flex items-center gap-2 p-4 bg-indigo-50 border border-indigo-200 rounded-2xl">
              <input value={newLabel} onChange={e => setNewLabel(e.target.value)} onKeyDown={e => e.key === "Enter" && addItem()}
                placeholder="Task description…" autoFocus
                className="flex-1 h-10 px-3 rounded-xl border border-indigo-200 bg-white text-sm focus:outline-none focus:border-indigo-400" />
              <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
                className="h-10 px-3 rounded-xl border border-indigo-200 bg-white text-sm focus:outline-none">
                {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <button onClick={addItem} className="h-10 px-4 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">Save</button>
              <button onClick={() => setAddingFor(null)} className="w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50"><X className="w-4 h-4 text-slate-400" /></button>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
          ) : templates.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
              <ClipboardList className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No template tasks yet</p>
              <p className="text-sm text-slate-400 mt-1">Add tasks and they'll auto-populate every program</p>
            </div>
          ) : (
            Object.entries(grouped(templates)).map(([cat, items]) => {
              const c = CATEGORY_MAP[cat] ?? CATEGORY_MAP.general;
              return (
                <div key={cat} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div className={cn("flex items-center gap-2 px-4 py-3 border-b border-slate-100")}>
                    <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border", c.color)}>{c.label}</span>
                    <span className="text-xs text-slate-400">{items.length} task{items.length > 1 ? "s" : ""}</span>
                  </div>
                  <ul className="divide-y divide-slate-50">
                    {items.map(item => (
                      <li key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 group transition-colors">
                        <span className="text-slate-300"><CheckSquare className="w-4 h-4" /></span>
                        <span className="flex-1 text-sm text-slate-700">{item.label}</span>
                        <button onClick={() => deleteItem(item.id, false)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center">
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Program View ── */}
      {view === "program" && (
        <div className="space-y-4">
          {/* Program selector */}
          <div className="relative">
            <button onClick={() => setShowBookingList(o => !o)}
              className="w-full flex items-center justify-between gap-3 h-12 px-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors text-left">
              <div className="flex items-center gap-2.5 min-w-0">
                <Camera className="w-4 h-4 text-slate-400 flex-shrink-0" />
                {programInfo ? (
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-slate-800 block truncate">{programInfo.eventName || programInfo.bookingNumber}</span>
                    <span className="text-xs text-slate-400">{programInfo.bookingNumber}</span>
                  </div>
                ) : (
                  <span className="text-sm text-slate-400">Select a program…</span>
                )}
              </div>
              {showBookingList ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
            </button>

            {showBookingList && (
              <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
                <div className="p-2 border-b border-slate-100">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input value={bookingSearch} onChange={e => setBookingSearch(e.target.value)}
                      placeholder="Search program…" autoFocus
                      className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-400" />
                  </div>
                </div>
                <ul className="max-h-64 overflow-y-auto">
                  {filteredBookings.map(b => (
                    <li key={b.id}>
                      <button onClick={() => { setSelectedBookingId(b.id); loadProgramChecklist(b.id); setShowBookingList(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 text-left transition-colors">
                        <Camera className="w-4 h-4 text-slate-300 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{b.eventName || b.bookingNumber}</p>
                          <p className="text-xs text-slate-400">{b.bookingNumber}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                  {filteredBookings.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-400">No programs found</li>}
                </ul>
              </div>
            )}
          </div>

          {!selectedBookingId ? (
            <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
              <Camera className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Select a program above</p>
              <p className="text-sm text-slate-400 mt-1">to view and manage its checklist</p>
            </div>
          ) : loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
          ) : (
            <>
              {/* Progress */}
              {progTotal > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span className="text-sm font-semibold text-slate-700">{progChecked}/{progTotal} completed</span>
                    </div>
                    <span className="text-sm font-bold text-indigo-600">{Math.round((progChecked / progTotal) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(progChecked / progTotal) * 100}%` }} />
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button onClick={() => setAddingFor("program")}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors">
                  <Plus className="w-4 h-4" />Add Task
                </button>
              </div>

              {addingFor === "program" && (
                <div className="flex items-center gap-2 p-4 bg-indigo-50 border border-indigo-200 rounded-2xl">
                  <input value={newLabel} onChange={e => setNewLabel(e.target.value)} onKeyDown={e => e.key === "Enter" && addItem()}
                    placeholder="Task description…" autoFocus
                    className="flex-1 h-10 px-3 rounded-xl border border-indigo-200 bg-white text-sm focus:outline-none focus:border-indigo-400" />
                  <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
                    className="h-10 px-3 rounded-xl border border-indigo-200 bg-white text-sm focus:outline-none">
                    {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                  <button onClick={addItem} className="h-10 px-4 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">Save</button>
                  <button onClick={() => setAddingFor(null)} className="w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50"><X className="w-4 h-4 text-slate-400" /></button>
                </div>
              )}

              {Object.entries(grouped(programItems)).map(([cat, items]) => {
                const c = CATEGORY_MAP[cat] ?? CATEGORY_MAP.general;
                return (
                  <div key={cat} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                      <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border", c.color)}>{c.label}</span>
                      <span className="text-xs text-slate-400">{items.filter(i => i.isChecked).length}/{items.length} done</span>
                    </div>
                    <ul className="divide-y divide-slate-50">
                      {items.map(item => (
                        <li key={item.id} className={cn("flex items-center gap-3 px-4 py-3 hover:bg-slate-50 group transition-colors", item.isChecked && "bg-emerald-50/50")}>
                          <button onClick={() => toggleItem(item, true)} className="flex-shrink-0">
                            {item.isChecked
                              ? <CheckSquare className="w-5 h-5 text-emerald-500" />
                              : <Square className="w-5 h-5 text-slate-300 hover:text-indigo-400" />}
                          </button>
                          <span className={cn("flex-1 text-sm", item.isChecked ? "text-slate-400 line-through" : "text-slate-700")}>
                            {item.label}
                          </span>
                          <button onClick={() => deleteItem(item.id, true)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center">
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}

              {programItems.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                  <p className="text-slate-400 text-sm">No checklist items for this program</p>
                  <p className="text-xs text-slate-400 mt-1">Add template tasks or click "Add Task" above</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
