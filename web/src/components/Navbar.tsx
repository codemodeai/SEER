"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Docs", href: "/docs" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    // Check for Supabase auth cookie presence
    const hasAuthCookie = document.cookie
      .split(";")
      .some((c) => c.trim().startsWith("sb-") && c.includes("auth-token"));
    setLoggedIn(hasAuthCookie);
  }, []);

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

        {/* CTA / User */}
        <div className="hidden md:flex items-center gap-3">
          {!loggedIn && (
            <a
              href="/login"
              className="text-sm font-medium text-warm-brown-light hover:text-charcoal transition-colors px-4 py-2"
            >
              Log in
            </a>
          )}
          <a
            href="/dashboard"
            className="text-sm font-semibold text-white bg-terracotta hover:bg-terracotta-dark px-5 py-2.5 rounded-full transition-all shadow-sm hover:shadow-md"
          >
            Dashboard
          </a>
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
              {!loggedIn && (
                <a
                  href="/login"
                  className="text-sm font-medium text-warm-brown-light py-2"
                >
                  Log in
                </a>
              )}
              <a
                href="/dashboard"
                className="text-sm font-semibold text-white bg-terracotta text-center px-5 py-2.5 rounded-full mt-1"
              >
                Dashboard
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
