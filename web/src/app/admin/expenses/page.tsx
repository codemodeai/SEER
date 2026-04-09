"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Receipt,
  Plus,
  Loader2,
  Trash2,
  Edit3,
  X,
  Check,
  Server,
  Globe,
  Database,
  Cloud,
  CreditCard,
  AlertTriangle,
} from "lucide-react";

interface Expense {
  id: string;
  name: string;
  category: string;
  amount_usd: number;
  frequency: string;
  provider: string | null;
  notes: string | null;
  due_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { value: "api", label: "API", icon: Server },
  { value: "database", label: "Database", icon: Database },
  { value: "hosting", label: "Hosting", icon: Cloud },
  { value: "domain", label: "Domain", icon: Globe },
  { value: "service", label: "Service", icon: CreditCard },
  { value: "other", label: "Other", icon: Receipt },
];

const CATEGORY_COLORS: Record<string, string> = {
  api: "bg-blue-50 text-blue-600 border-blue-200",
  database: "bg-purple-50 text-purple-600 border-purple-200",
  hosting: "bg-emerald-50 text-emerald-600 border-emerald-200",
  domain: "bg-amber-50 text-amber-600 border-amber-200",
  service: "bg-pink-50 text-pink-600 border-pink-200",
  other: "bg-gray-50 text-gray-600 border-gray-200",
};

const EMPTY_FORM = {
  name: "",
  category: "other",
  amount_usd: "",
  frequency: "monthly",
  provider: "",
  notes: "",
  due_date: "",
};

export default function AdminExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalMonthly, setTotalMonthly] = useState(0);
  const [totalAnnual, setTotalAnnual] = useState(0);
  const [byCategory, setByCategory] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchExpenses = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/expenses");
      if (res.ok) {
        const data = await res.json();
        setExpenses(data.expenses);
        setTotalMonthly(data.totalMonthly);
        setTotalAnnual(data.totalAnnual);
        setByCategory(data.byCategory);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setShowForm(true);
  }

  function openEdit(e: Expense) {
    setForm({
      name: e.name,
      category: e.category,
      amount_usd: e.amount_usd.toString(),
      frequency: e.frequency,
      provider: e.provider ?? "",
      notes: e.notes ?? "",
      due_date: e.due_date ?? "",
    });
    setEditId(e.id);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name || !form.amount_usd) return;
    setSaving(true);
    try {
      if (editId) {
        await fetch("/api/admin/expenses", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editId,
            name: form.name,
            category: form.category,
            amount_usd: parseFloat(form.amount_usd),
            frequency: form.frequency,
            provider: form.provider || null,
            notes: form.notes || null,
            due_date: form.due_date || null,
          }),
        });
      } else {
        await fetch("/api/admin/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            amount_usd: parseFloat(form.amount_usd),
            provider: form.provider || null,
            notes: form.notes || null,
            due_date: form.due_date || null,
          }),
        });
      }
      setShowForm(false);
      fetchExpenses();
    } catch { alert("Failed to save."); }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this expense?")) return;
    await fetch("/api/admin/expenses", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchExpenses();
  }

  async function toggleActive(id: string, is_active: boolean) {
    await fetch("/api/admin/expenses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active: !is_active }),
    });
    fetchExpenses();
  }

  function formatDue(d: string | null) {
    if (!d) return null;
    const date = new Date(d);
    const now = new Date();
    const diff = Math.ceil((date.getTime() - now.getTime()) / 86400000);
    if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, urgent: true };
    if (diff <= 7) return { text: `Due in ${diff}d`, urgent: true };
    if (diff <= 30) return { text: `Due in ${diff}d`, urgent: false };
    return { text: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }), urgent: false };
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-terracotta" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl text-charcoal">Expense Management</h1>
          <p className="text-sm text-muted mt-1">Track recurring costs: database, hosting, APIs, services</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-terracotta text-white text-sm font-semibold hover:bg-terracotta-dark transition-all"
        >
          <Plus size={16} />
          Add Expense
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-ivory rounded-2xl border border-sand/60 p-5">
          <p className="text-[10px] uppercase tracking-widest text-muted">Total Monthly</p>
          <p className="font-display text-2xl text-charcoal mt-1">${totalMonthly.toFixed(2)}</p>
        </div>
        <div className="bg-ivory rounded-2xl border border-sand/60 p-5">
          <p className="text-[10px] uppercase tracking-widest text-muted">Total Annual</p>
          <p className="font-display text-2xl text-charcoal mt-1">${totalAnnual.toFixed(2)}</p>
        </div>
        <div className="bg-ivory rounded-2xl border border-sand/60 p-5">
          <p className="text-[10px] uppercase tracking-widest text-muted">Active Expenses</p>
          <p className="font-display text-2xl text-charcoal mt-1">{expenses.filter(e => e.is_active).length}</p>
        </div>
      </div>

      {/* Breakdown by category */}
      {Object.keys(byCategory).length > 0 && (
        <div className="bg-ivory rounded-2xl border border-sand/60 p-5">
          <h3 className="font-display text-lg text-charcoal mb-3">Monthly Cost by Category</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {CATEGORIES.map(cat => {
              const amount = byCategory[cat.value] ?? 0;
              if (amount === 0) return null;
              const Icon = cat.icon;
              return (
                <div key={cat.value} className="bg-cream-dark rounded-xl p-3 text-center">
                  <Icon size={18} className="mx-auto text-muted mb-1" />
                  <p className="font-display text-lg text-charcoal">${amount.toFixed(2)}</p>
                  <p className="text-xs text-muted">{cat.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add/Edit form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowForm(false)}>
          <div className="bg-ivory rounded-2xl border border-sand/60 p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-xl text-charcoal">{editId ? "Edit Expense" : "Add Expense"}</h3>
              <button onClick={() => setShowForm(false)} className="text-muted hover:text-charcoal"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted block mb-1">Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Supabase Pro"
                  className="w-full px-3 py-2 rounded-lg bg-cream-dark border border-sand/60 text-sm text-charcoal focus:outline-none focus:border-terracotta/40"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted block mb-1">Amount (USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.amount_usd}
                    onChange={e => setForm(f => ({ ...f, amount_usd: e.target.value }))}
                    placeholder="25.00"
                    className="w-full px-3 py-2 rounded-lg bg-cream-dark border border-sand/60 text-sm text-charcoal focus:outline-none focus:border-terracotta/40"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Frequency</label>
                  <select
                    value={form.frequency}
                    onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-cream-dark border border-sand/60 text-sm text-charcoal focus:outline-none"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                    <option value="one-time">One-time</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted block mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-cream-dark border border-sand/60 text-sm text-charcoal focus:outline-none"
                  >
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Provider</label>
                  <input
                    value={form.provider}
                    onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                    placeholder="e.g. Supabase"
                    className="w-full px-3 py-2 rounded-lg bg-cream-dark border border-sand/60 text-sm text-charcoal focus:outline-none focus:border-terracotta/40"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Due Date</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-cream-dark border border-sand/60 text-sm text-charcoal focus:outline-none focus:border-terracotta/40"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional notes..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-cream-dark border border-sand/60 text-sm text-charcoal focus:outline-none focus:border-terracotta/40 resize-none"
                />
              </div>
              <button
                onClick={handleSave}
                disabled={saving || !form.name || !form.amount_usd}
                className="w-full py-2.5 rounded-xl bg-terracotta text-white text-sm font-semibold hover:bg-terracotta-dark transition-all disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin mx-auto" /> : editId ? "Update Expense" : "Add Expense"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expenses list */}
      {expenses.length === 0 ? (
        <div className="bg-ivory rounded-2xl border border-sand/60 flex flex-col items-center py-20 gap-2">
          <Receipt size={36} className="text-muted/20" />
          <p className="text-sm text-muted">No expenses tracked yet</p>
          <button onClick={openAdd} className="mt-2 text-sm text-terracotta font-semibold hover:underline">
            Add your first expense
          </button>
        </div>
      ) : (
        <div className="bg-ivory rounded-2xl border border-sand/60 overflow-hidden">
          <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] px-5 py-3 border-b border-sand/40 bg-cream-dark/50">
            <span className="text-[10px] font-semibold tracking-widest uppercase text-muted">Expense</span>
            <span className="text-[10px] font-semibold tracking-widest uppercase text-muted">Category</span>
            <span className="text-[10px] font-semibold tracking-widest uppercase text-muted">Amount</span>
            <span className="text-[10px] font-semibold tracking-widest uppercase text-muted">Frequency</span>
            <span className="text-[10px] font-semibold tracking-widest uppercase text-muted">Due</span>
            <span className="text-[10px] font-semibold tracking-widest uppercase text-muted">Actions</span>
          </div>
          <div className="divide-y divide-sand/30">
            {expenses.map(e => {
              const due = formatDue(e.due_date);
              return (
                <div
                  key={e.id}
                  className={`sm:grid sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] flex flex-col gap-1 px-5 py-3.5 ${
                    !e.is_active ? "opacity-50" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-charcoal">{e.name}</p>
                    {e.provider && <p className="text-xs text-muted">{e.provider}</p>}
                    {e.notes && <p className="text-xs text-muted/70 truncate">{e.notes}</p>}
                  </div>
                  <div className="flex items-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${CATEGORY_COLORS[e.category] ?? CATEGORY_COLORS.other}`}>
                      {e.category}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm font-semibold text-charcoal">${Number(e.amount_usd).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm text-muted capitalize">{e.frequency}</span>
                  </div>
                  <div className="flex items-center">
                    {due ? (
                      <span className={`flex items-center gap-1 text-xs ${due.urgent ? "text-terracotta font-semibold" : "text-muted"}`}>
                        {due.urgent && <AlertTriangle size={11} />}
                        {due.text}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => openEdit(e)} className="w-7 h-7 rounded-lg bg-cream-dark flex items-center justify-center text-muted hover:text-charcoal">
                      <Edit3 size={13} />
                    </button>
                    <button onClick={() => toggleActive(e.id, e.is_active)} className="w-7 h-7 rounded-lg bg-cream-dark flex items-center justify-center text-muted hover:text-charcoal" title={e.is_active ? "Deactivate" : "Activate"}>
                      {e.is_active ? <X size={13} /> : <Check size={13} />}
                    </button>
                    <button onClick={() => handleDelete(e.id)} className="w-7 h-7 rounded-lg bg-cream-dark flex items-center justify-center text-muted hover:text-terracotta">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
