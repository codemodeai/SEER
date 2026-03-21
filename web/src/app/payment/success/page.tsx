"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { motion } from "framer-motion";
import { CheckCircle, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

function SuccessContent() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") ?? "Starter";
  const price = searchParams.get("price") ?? "19";

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="max-w-lg w-full text-center"
      >
        {/* Success icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="w-20 h-20 rounded-full bg-accent-sage/15 flex items-center justify-center mx-auto mb-8"
        >
          <CheckCircle size={40} className="text-accent-sage" />
        </motion.div>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="font-display text-4xl md:text-5xl text-charcoal tracking-tight"
        >
          You&apos;re all set!
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-4 text-warm-brown-light text-lg leading-relaxed"
        >
          Your <span className="font-semibold text-charcoal capitalize">{plan}</span> plan is now active.
        </motion.p>

        {/* Plan card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 bg-ivory rounded-2xl border border-sand/60 p-6 text-left"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-terracotta/10 flex items-center justify-center">
              <Sparkles size={20} className="text-terracotta" />
            </div>
            <div>
              <p className="text-xs text-muted font-semibold tracking-widest uppercase">
                Active Plan
              </p>
              <p className="font-display text-xl text-charcoal capitalize">
                {plan}
              </p>
            </div>
          </div>
          <div className="flex items-baseline gap-1 mb-4">
            <span className="font-display text-3xl text-charcoal">${price}</span>
            <span className="text-sm text-muted">/month</span>
          </div>
          <div className="h-px bg-sand/60 mb-4" />
          <ul className="space-y-2 text-sm text-warm-brown-light">
            <li className="flex items-center gap-2">
              <CheckCircle size={14} className="text-accent-sage" />
              Payment confirmed
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle size={14} className="text-accent-sage" />
              API key activated
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle size={14} className="text-accent-sage" />
              Dashboard unlocked
            </li>
          </ul>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-8 flex flex-col gap-3"
        >
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 py-4 rounded-full bg-terracotta hover:bg-terracotta-dark text-white font-semibold text-sm transition-all shadow-lg shadow-terracotta/20"
          >
            Go to Dashboard
            <ArrowRight size={16} />
          </Link>
          <Link
            href="/dashboard/install"
            className="flex items-center justify-center gap-2 py-3 rounded-full bg-cream-dark hover:bg-sand text-charcoal font-medium text-sm transition-all border border-sand"
          >
            Install SEER
          </Link>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-6 text-xs text-muted"
        >
          A confirmation receipt has been sent to your email.
        </motion.p>
      </motion.div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}
