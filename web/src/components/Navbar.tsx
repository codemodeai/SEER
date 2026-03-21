"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, User } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Docs", href: "#docs" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<{
    name: string;
    email: string;
  } | null>(null);

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (authUser) {
        setUser({
          name:
            authUser.user_metadata?.full_name ||
            authUser.user_metadata?.name ||
            authUser.email?.split("@")[0] ||
            "User",
          email: authUser.email ?? "",
        });
      }
    }
    checkAuth();
  }, []);

  const initial = user?.name?.charAt(0)?.toUpperCase() ?? "";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-cream/80 backdrop-blur-xl border-b border-sand/60">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-terracotta flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
            <span className="text-white font-display font-bold text-sm tracking-tight">
              S
            </span>
          </div>
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

        {/* CTA / User */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <a
              href="/dashboard"
              className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-charcoal hover:bg-charcoal/90 transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-terracotta flex items-center justify-center">
                <span className="text-white text-xs font-bold">{initial}</span>
              </div>
              <span className="text-sm font-medium text-white">
                {user.name}
              </span>
            </a>
          ) : (
            <>
              <a
                href="/login"
                className="text-sm font-medium text-warm-brown-light hover:text-charcoal transition-colors px-4 py-2"
              >
                Log in
              </a>
              <a
                href="/signup"
                className="text-sm font-semibold text-white bg-terracotta hover:bg-terracotta-dark px-5 py-2.5 rounded-full transition-all shadow-sm hover:shadow-md"
              >
                Get started free
              </a>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 text-charcoal"
          onClick={() => setOpen(!open)}
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
                <a
                  href="/dashboard"
                  className="flex items-center gap-3 py-2"
                >
                  <div className="w-8 h-8 rounded-full bg-terracotta flex items-center justify-center">
                    <span className="text-white text-sm font-bold">
                      {initial}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-charcoal">
                      {user.name}
                    </p>
                    <p className="text-xs text-muted">Go to Dashboard</p>
                  </div>
                </a>
              ) : (
                <>
                  <a
                    href="/login"
                    className="text-sm font-medium text-warm-brown-light py-2"
                  >
                    Log in
                  </a>
                  <a
                    href="/signup"
                    className="text-sm font-semibold text-white bg-terracotta text-center px-5 py-2.5 rounded-full mt-1"
                  >
                    Get started free
                  </a>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
