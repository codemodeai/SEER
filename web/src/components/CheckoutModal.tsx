"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, CreditCard, Smartphone, ExternalLink } from "lucide-react";

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  plan: string;
  priceUsd: number;
  priceInr: number;
}

export default function CheckoutModal({
  open,
  onClose,
  plan,
  priceUsd,
  priceInr,
}: CheckoutModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-charcoal/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-x-0 bottom-0 sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-50 w-full sm:max-w-md"
          >
            <div className="bg-ivory rounded-t-2xl sm:rounded-2xl border border-sand shadow-2xl shadow-charcoal/20 overflow-hidden sm:mx-4 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="bg-charcoal px-5 sm:px-6 py-4 sm:py-5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/40 font-semibold tracking-widest uppercase">
                    Subscribe to SEER
                  </p>
                  <h3 className="mt-1 font-display text-2xl text-white">
                    {plan} Plan
                  </h3>
                </div>
                <button
                  onClick={onClose}
                  className="text-white/40 hover:text-white transition-colors p-1"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content */}
              <div className="p-5 sm:p-6">
                {/* Price display */}
                <div className="flex items-center justify-between bg-cream-dark rounded-xl p-4 mb-6">
                  <div>
                    <p className="text-xs text-muted">Monthly subscription</p>
                    <p className="font-display text-3xl text-charcoal mt-1">
                      ${priceUsd}
                      <span className="text-sm text-muted font-body">
                        /month
                      </span>
                    </p>
                    <p className="text-xs text-muted mt-1">
                      or ₹{priceInr.toLocaleString()} for Indian users
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-terracotta/10 flex items-center justify-center">
                    <CreditCard size={22} className="text-terracotta" />
                  </div>
                </div>

                {/* Payment methods info */}
                <div className="space-y-3 mb-6">
                  <p className="text-xs font-semibold tracking-widest uppercase text-muted">
                    Payment Methods
                  </p>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-cream-dark">
                    <ExternalLink size={16} className="text-warm-brown-light" />
                    <div>
                      <p className="text-sm font-medium text-charcoal">
                        Global — Dodo Payments
                      </p>
                      <p className="text-xs text-muted">
                        Cards, PayPal, 30+ payment methods in 150+ countries
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-cream-dark">
                    <Smartphone size={16} className="text-warm-brown-light" />
                    <div>
                      <p className="text-sm font-medium text-charcoal">
                        India — Razorpay
                      </p>
                      <p className="text-xs text-muted">
                        UPI, Indian cards, net banking, wallets
                      </p>
                    </div>
                  </div>
                </div>

                {/* Demo notice */}
                <div className="bg-terracotta/8 border border-terracotta/15 rounded-xl p-4 mb-6">
                  <p className="text-xs text-terracotta font-semibold">
                    Demo Mode
                  </p>
                  <p className="text-xs text-warm-brown-light mt-1">
                    Payment gateways are not configured yet. Once Dodo & Razorpay
                    API keys are added, this button will redirect to the live
                    checkout.
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col gap-3">
                  <button
                    onClick={onClose}
                    className="w-full py-3.5 rounded-full bg-terracotta hover:bg-terracotta-dark text-white font-semibold text-sm transition-all shadow-md shadow-terracotta/20"
                  >
                    Proceed to checkout →
                  </button>
                  <button
                    onClick={onClose}
                    className="w-full py-3 rounded-full bg-cream-dark hover:bg-sand text-charcoal font-medium text-sm transition-all border border-sand"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
