"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Download, LogOut, LayoutDashboard } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import type { User } from "@supabase/supabase-js";

const navLinks = [
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Download", href: "/download" },
  { label: "Docs", href: "/docs" },
];

function getDisplayName(user: User): string {
  const meta = user.user_metadata ?? {};
  return (
    (meta.name as string) ||
    (meta.full_name as string) ||
    (meta.user_name as string) ||
    user.email?.split("@")[0] ||
    "Account"
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setMenuOpen(false);
    window.location.href = "/";
  }

  const displayName = user ? getDisplayName(user) : "";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-cream/80 backdrop-blur-xl border-b border-sand/60">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5 group">
          <img
            src="/logo.png"
            alt="SEER"
            width={32}
            height={32}
            className="rounded-lg shadow-sm group-hover:shadow-md transition-shadow"
          />
          <span className="font-display text-xl text-charcoal tracking-tight">
            SEER
          </span>
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-warm-brown-light hover:text-terracotta transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* CTAs */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2.5 text-sm font-medium text-charcoal hover:bg-sand/40 transition-colors px-3 py-1.5 rounded-full"
              >
                <span className="w-7 h-7 rounded-full bg-terracotta text-white text-xs font-semibold flex items-center justify-center">
                  {getInitials(displayName)}
                </span>
                <span className="max-w-[140px] truncate">{displayName}</span>
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 mt-2 w-56 rounded-xl border border-sand bg-ivory shadow-lg overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b border-sand/80">
                      <p className="text-xs text-muted">Signed in as</p>
                      <p className="text-sm font-medium text-charcoal truncate">
                        {user.email}
                      </p>
                    </div>
                    <a
                      href="/authorize"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-charcoal hover:bg-cream-dark transition-colors"
                    >
                      <LayoutDashboard size={15} />
                      Open Desktop App
                    </a>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-charcoal hover:bg-cream-dark transition-colors border-t border-sand/80"
                    >
                      <LogOut size={15} />
                      Sign out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <a
              href="/login"
              className="text-sm font-medium text-warm-brown-light hover:text-charcoal transition-colors px-4 py-2"
            >
              Log in
            </a>
          )}
          <a
            href="/download"
            className="group flex items-center gap-2 text-sm font-semibold text-white bg-terracotta hover:bg-terracotta-dark px-5 py-2.5 rounded-full transition-all shadow-sm hover:shadow-md"
          >
            <Download size={14} className="group-hover:-translate-y-0.5 transition-transform" />
            Download App
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 text-charcoal"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-cream border-b border-sand overflow-hidden"
          >
            <div className="px-6 py-4 flex flex-col gap-3">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="text-sm font-medium text-warm-brown-light py-2"
                >
                  {link.label}
                </a>
              ))}
              <hr className="border-sand" />
              {user ? (
                <>
                  <div className="flex items-center gap-3 py-2">
                    <span className="w-8 h-8 rounded-full bg-terracotta text-white text-xs font-semibold flex items-center justify-center">
                      {getInitials(displayName)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-charcoal truncate">{displayName}</p>
                      <p className="text-xs text-muted truncate">{user.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 text-sm font-medium text-warm-brown-light py-2"
                  >
                    <LogOut size={15} />
                    Sign out
                  </button>
                </>
              ) : (
                <a href="/login" className="text-sm font-medium text-warm-brown-light py-2">
                  Log in
                </a>
              )}
              <a
                href="/download"
                className="flex items-center justify-center gap-2 text-sm font-semibold text-white bg-terracotta text-center px-5 py-2.5 rounded-full mt-1"
              >
                <Download size={14} />
                Download App
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
