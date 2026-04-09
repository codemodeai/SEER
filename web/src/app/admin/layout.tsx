"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { createClient } from "@/lib/supabase-browser";
import {
  LayoutDashboard,
  Users,
  DollarSign,
  Server,
  Receipt,
  LogOut,
  ChevronRight,
  Sun,
  Moon,
  Menu,
  X,
  Ticket,
  Shield,
  Loader2,
} from "lucide-react";

const sidebarLinks = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Revenue", href: "/admin/revenue", icon: DollarSign },
  { label: "API Costs", href: "/admin/api-costs", icon: Server },
  { label: "Expenses", href: "/admin/expenses", icon: Receipt },
  { label: "Tickets", href: "/admin/tickets", icon: Ticket },
];

function AdminContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkAdmin() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email?.toLowerCase() === "support@codemodeai.com") {
        setAuthed(true);
      }
      setChecking(false);
    }
    checkAdmin();
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-terracotta" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-4">
        <div className="text-center">
          <Shield size={48} className="text-muted/20 mx-auto mb-4" />
          <h1 className="font-display text-2xl text-charcoal">Access Denied</h1>
          <p className="text-sm text-muted mt-2">This page is restricted to SEER admins only.</p>
          <a href="/" className="mt-6 inline-block px-6 py-2.5 rounded-full bg-terracotta text-white text-sm font-semibold hover:bg-terracotta-dark transition-all">
            Go Home
          </a>
        </div>
      </div>
    );
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-cream flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-charcoal fixed inset-y-0 left-0 z-40">
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-terracotta flex items-center justify-center">
              <span className="text-white font-display font-bold text-sm">S</span>
            </div>
            <span className="font-display text-xl text-white tracking-tight">Admin</span>
          </div>
          <button
            onClick={toggle}
            className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all"
          >
            {theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {sidebarLinks.map((link) => {
            const isActive = link.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-terracotta text-white"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                <link.icon size={18} />
                {link.label}
                {isActive && <ChevronRight size={14} className="ml-auto opacity-50" />}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-4 flex flex-col gap-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 text-sm text-white/40 hover:text-white transition-colors"
          >
            <LayoutDashboard size={16} />
            Back to Dashboard
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 text-sm text-white/40 hover:text-white transition-colors"
          >
            <LogOut size={16} />
            Log out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Mobile drawer */}
      <aside className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-charcoal flex flex-col transition-transform duration-300 ${
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        <div className="h-14 flex items-center justify-between px-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-terracotta flex items-center justify-center">
              <span className="text-white font-display font-bold text-xs">S</span>
            </div>
            <span className="font-display text-lg text-white tracking-tight">Admin</span>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/50">
            <X size={16} />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {sidebarLinks.map((link) => {
            const isActive = link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
            return (
              <Link key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive ? "bg-terracotta text-white" : "text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                <link.icon size={18} />
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 pb-4">
          <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 text-sm text-white/40 hover:text-white transition-colors">
            <LogOut size={16} />
            Log out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:pl-64">
        <header className="lg:hidden h-14 bg-charcoal flex items-center justify-between px-4 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileMenuOpen(true)} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/50">
              <Menu size={16} />
            </button>
            <span className="font-display text-lg text-white">Admin Console</span>
          </div>
        </header>
        <main className="p-4 sm:p-6 md:p-8 lg:p-10 max-w-[1400px]">{children}</main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AdminContent>{children}</AdminContent>
    </ThemeProvider>
  );
}
