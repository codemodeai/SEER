"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useState } from "react";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { AgencyProvider, useAgency } from "@/lib/agency-context";
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  ChevronRight,
  Sun,
  Moon,
  Menu,
  X,
  Building2,
  Loader2,
  AlertTriangle,
  Key,
  Cloud,
  Activity,
  BarChart3,
  Megaphone,
  BookOpen,
  FolderKanban,
  Lock,
} from "lucide-react";

function AgencyPortalContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const slug = params?.slug as string;
  const { theme, toggle } = useTheme();
  const { agency, role, loading, error } = useAgency();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = agency?.enabledFeatures ?? { announcements: true, project_management: false };

  const sidebarLinks = [
    { label: "Overview", href: `/agency/${slug}`, icon: LayoutDashboard },
    { label: "Users", href: `/agency/${slug}/users`, icon: Users },
    { label: "API Keys", href: `/agency/${slug}/keys`, icon: Key },
    { label: "Cloud Memory", href: `/agency/${slug}/memory`, icon: Cloud },
    { label: "Activity", href: `/agency/${slug}/activity`, icon: Activity },
    { label: "Analytics", href: `/agency/${slug}/analytics`, icon: BarChart3 },
    { label: "Projects", href: `/agency/${slug}/projects`, icon: FolderKanban, locked: !features.project_management },
    { label: "Announcements", href: `/agency/${slug}/announcements`, icon: Megaphone, locked: !features.announcements },
    { label: "Guide", href: `/agency/${slug}/guide`, icon: BookOpen },
    { label: "Settings", href: `/agency/${slug}/settings`, icon: Settings },
  ];

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Loading agency portal...</span>
        </div>
      </div>
    );
  }

  if (error || !agency) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertTriangle size={40} className="text-terracotta mx-auto mb-4" />
          <h1 className="font-display text-2xl text-charcoal mb-2">
            {error === "Access denied" ? "Access Denied" : "Agency Not Found"}
          </h1>
          <p className="text-muted text-sm mb-6">
            {error === "Access denied"
              ? "You don't have permission to access this agency portal."
              : "The agency you're looking for doesn't exist or has been removed."}
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-ivory border-r border-sand/60 fixed inset-y-0 left-0 z-40">
        {/* Agency branding + Theme toggle */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-sand/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-terracotta flex items-center justify-center">
              {agency.logoUrl ? (
                <img
                  src={agency.logoUrl}
                  alt={agency.name}
                  className="w-8 h-8 rounded-lg object-cover"
                />
              ) : (
                <Building2 size={16} className="text-white" />
              )}
            </div>
            <span className="font-display text-xl text-charcoal tracking-tight truncate max-w-[140px]">
              {agency.name}
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
              link.href === `/agency/${slug}`
                ? pathname === `/agency/${slug}`
                : pathname.startsWith(link.href);
            const isLocked = "locked" in link && link.locked;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isLocked
                    ? "text-muted/50 hover:bg-cream-dark hover:text-muted"
                    : isActive
                      ? "bg-terracotta/10 text-terracotta"
                      : "text-warm-brown-light hover:bg-cream-dark hover:text-charcoal"
                }`}
              >
                <link.icon size={18} />
                {link.label}
                {isLocked ? (
                  <Lock size={12} className="ml-auto opacity-40" />
                ) : isActive ? (
                  <ChevronRight size={14} className="ml-auto opacity-50" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        {/* Agency info + logout */}
        <div className="px-3 pb-4 flex flex-col gap-2">
          <div className="px-4 py-3 rounded-xl bg-cream-dark border border-sand/50">
            <p className="text-[10px] font-semibold tracking-widest uppercase text-muted">
              Agency Portal
            </p>
            <p className="mt-1 font-display text-lg text-charcoal">{agency.name}</p>
            <p className="text-xs text-muted mt-0.5">
              {agency.memberCount} / {agency.maxUsers} members
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-sand overflow-hidden">
              <div
                className="h-full rounded-full bg-terracotta"
                style={{
                  width: `${Math.min((agency.memberCount / agency.maxUsers) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
          <div className="px-4 py-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-terracotta/10 text-terracotta">
              {role}
            </span>
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-charcoal transition-colors"
          >
            <LayoutDashboard size={16} />
            Back to Dashboard
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-charcoal transition-colors"
          >
            <LogOut size={16} />
            Log out
          </button>
        </div>
      </aside>

      {/* Mobile drawer overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-ivory border-r border-sand/60 flex flex-col transition-transform duration-300 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-14 flex items-center justify-between px-5 border-b border-sand/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-terracotta flex items-center justify-center">
              <Building2 size={14} className="text-white" />
            </div>
            <span className="font-display text-lg text-charcoal tracking-tight truncate max-w-[130px]">
              {agency.name}
            </span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="w-8 h-8 rounded-lg bg-cream-dark border border-sand/60 flex items-center justify-center text-muted"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {sidebarLinks.map((link) => {
            const isActive =
              link.href === `/agency/${slug}`
                ? pathname === `/agency/${slug}`
                : pathname.startsWith(link.href);
            const isLocked = "locked" in link && link.locked;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isLocked
                    ? "text-muted/50 hover:bg-cream-dark hover:text-muted"
                    : isActive
                      ? "bg-terracotta/10 text-terracotta"
                      : "text-warm-brown-light hover:bg-cream-dark hover:text-charcoal"
                }`}
              >
                <link.icon size={18} />
                {link.label}
                {isLocked ? (
                  <Lock size={12} className="ml-auto opacity-40" />
                ) : isActive ? (
                  <ChevronRight size={14} className="ml-auto opacity-50" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-4 flex flex-col gap-2">
          <button
            onClick={toggle}
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-charcoal transition-colors"
          >
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            {theme === "light" ? "Dark mode" : "Light mode"}
          </button>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-charcoal transition-colors"
          >
            <LayoutDashboard size={16} />
            Back to Dashboard
          </Link>
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
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="w-8 h-8 rounded-lg bg-cream-dark border border-sand/60 flex items-center justify-center text-muted"
            >
              <Menu size={16} />
            </button>
            <span className="font-display text-lg text-charcoal truncate">
              {agency.name}
            </span>
          </div>
        </header>

        <main className="p-4 sm:p-6 md:p-8 lg:p-10 max-w-[1400px]">{children}</main>
      </div>
    </div>
  );
}

export default function AgencyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <AgencyProvider>
        <AgencyPortalContent>{children}</AgencyPortalContent>
      </AgencyProvider>
    </ThemeProvider>
  );
}
