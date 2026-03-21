"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { ThemeProvider, useTheme } from "@/lib/theme";
import {
  LayoutDashboard,
  Download,
  Key,
  CreditCard,
  LogOut,
  ChevronRight,
  Sun,
  Moon,
} from "lucide-react";

const sidebarLinks = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Install Guide", href: "/dashboard/install", icon: Download },
  { label: "API Keys", href: "/dashboard/keys", icon: Key },
  { label: "Billing", href: "/dashboard/billing", icon: CreditCard },
];

const PLAN_LIMITS: Record<string, number> = {
  free: 50,
  starter: 200,
  pro: 1000,
  agency: 99999,
};

function DashboardContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [plan, setPlan] = useState("free");
  const [usage, setUsage] = useState(0);

  useEffect(() => {
    async function fetchUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await fetch("/api/auth/setup-user", { method: "POST" });

      const { data } = await supabase
        .from("users")
        .select("plan, usage_this_month")
        .eq("id", user.id)
        .single();

      if (data) {
        setPlan(data.plan);
        setUsage(data.usage_this_month);
      }
    }
    fetchUser();
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const limit = PLAN_LIMITS[plan] ?? 50;
  const pct = plan === "agency" ? 0 : Math.min((usage / limit) * 100, 100);

  return (
    <div className="min-h-screen bg-cream flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-ivory border-r border-sand/60 fixed inset-y-0 left-0 z-40">
        {/* Logo + Theme toggle */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-sand/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-terracotta flex items-center justify-center">
              <span className="text-white font-display font-bold text-sm">S</span>
            </div>
            <span className="font-display text-xl text-charcoal tracking-tight">
              SEER
            </span>
          </div>
          <button
            onClick={toggle}
            className="w-8 h-8 rounded-lg bg-cream-dark border border-sand/60 flex items-center justify-center text-muted hover:text-terracotta hover:border-terracotta/30 transition-all"
            title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          >
            {theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {sidebarLinks.map((link) => {
            const isActive =
              link.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-terracotta/10 text-terracotta"
                    : "text-warm-brown-light hover:bg-cream-dark hover:text-charcoal"
                }`}
              >
                <link.icon size={18} />
                {link.label}
                {isActive && (
                  <ChevronRight size={14} className="ml-auto opacity-50" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Plan badge + logout */}
        <div className="px-3 pb-4 flex flex-col gap-2">
          <div className="px-4 py-3 rounded-xl bg-cream-dark border border-sand/50">
            <p className="text-[10px] font-semibold tracking-widest uppercase text-muted">
              Current Plan
            </p>
            <p className="mt-1 font-display text-lg text-charcoal capitalize">{plan}</p>
            <p className="text-xs text-muted mt-0.5">
              {plan === "agency"
                ? "Unlimited calls"
                : `${usage} / ${limit.toLocaleString()} calls used`}
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-sand overflow-hidden">
              <div
                className="h-full rounded-full bg-terracotta"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-charcoal transition-colors"
          >
            <LogOut size={16} />
            Log out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:pl-64">
        {/* Top bar (mobile) */}
        <header className="lg:hidden h-14 bg-ivory border-b border-sand/60 flex items-center justify-between px-4 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-terracotta flex items-center justify-center">
              <span className="text-white font-display font-bold text-xs">S</span>
            </div>
            <span className="font-display text-lg text-charcoal">Dashboard</span>
          </div>
          <button
            onClick={toggle}
            className="w-8 h-8 rounded-lg bg-cream-dark border border-sand/60 flex items-center justify-center text-muted hover:text-terracotta transition-all"
          >
            {theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
          </button>
        </header>

        <main className="p-6 md:p-8 lg:p-10 max-w-[1400px]">{children}</main>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <DashboardContent>{children}</DashboardContent>
    </ThemeProvider>
  );
}
