import { ArrowUpRight } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-charcoal text-white/50 py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-10 md:gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-terracotta flex items-center justify-center">
                <span className="text-white font-display font-bold text-sm">
                  S
                </span>
              </div>
              <span className="font-display text-xl text-white tracking-tight">
                SEER
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed">
              AI Prompt Intelligence Platform.
              <br />
              Powered by MCP.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-xs font-semibold tracking-widest uppercase text-white/30 mb-4">
              Product
            </h4>
            <ul className="flex flex-col gap-2.5">
              {[
                { label: "Features", href: "/#features" },
                { label: "Pricing", href: "/#pricing" },
                { label: "Dashboard", href: "/dashboard" },
                { label: "Docs", href: "/docs" },
              ].map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    className="text-sm hover:text-white transition-colors"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-xs font-semibold tracking-widest uppercase text-white/30 mb-4">
              Resources
            </h4>
            <ul className="flex flex-col gap-2.5">
              {[
                { label: "Install Guide", href: "/docs/install" },
                { label: "API Reference", href: "/docs/api" },
                { label: "GitHub", href: "#", external: true },
              ].map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    className="text-sm hover:text-white transition-colors inline-flex items-center gap-1"
                  >
                    {item.label}
                    {item.external && <ArrowUpRight size={11} />}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-xs font-semibold tracking-widest uppercase text-white/30 mb-4">
              Legal
            </h4>
            <ul className="flex flex-col gap-2.5">
              {["Privacy Policy", "Terms of Service"].map((item) => (
                <li key={item}>
                  <a
                    href="#"
                    className="text-sm hover:text-white transition-colors"
                  >
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 pt-6 border-t border-white/8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs">
            &copy; {new Date().getFullYear()} SEER. All rights reserved.
          </p>
          <p className="text-xs text-white/30">
            Built with Claude Code
          </p>
        </div>
      </div>
    </footer>
  );
}
