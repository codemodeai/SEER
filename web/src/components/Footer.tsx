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
                <span className="text-white font-display font-bold text-sm">S</span>
              </div>
              <span className="font-display text-xl text-white tracking-tight">SEER</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed">
              Master Control Protocol.
              <br />
              Your AI, fully controlled.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-xs font-semibold tracking-widest uppercase text-white/30 mb-4">Product</h4>
            <ul className="flex flex-col gap-2.5">
              {[
                { label: "Features", href: "/#features" },
                { label: "Pricing", href: "/pricing" },
                { label: "Download", href: "/download" },
                { label: "Docs", href: "/docs" },
              ].map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="text-sm hover:text-white transition-colors">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Install */}
          <div>
            <h4 className="text-xs font-semibold tracking-widest uppercase text-white/30 mb-4">Install</h4>
            <ul className="flex flex-col gap-2.5">
              {[
                { label: "Mac (Apple Silicon)", href: "https://github.com/codemodeai/SEER/releases/latest/download/SEER_aarch64.dmg" },
                { label: "Mac (Intel)", href: "https://github.com/codemodeai/SEER/releases/latest/download/SEER_x64.dmg" },
                { label: "Windows (.exe)", href: "https://github.com/codemodeai/SEER/releases/latest/download/SEER_1.0.0_x64-setup.exe" },
                { label: "Linux (.AppImage)", href: "https://github.com/codemodeai/SEER/releases/latest/download/SEER_1.0.0_x64.AppImage" },
                { label: "iOS App Store", href: "https://apps.apple.com/app/seer-ai/id0000000000", external: true },
                { label: "Google Play", href: "https://play.google.com/store/apps/details?id=ai.seer.app", external: true },
              ].map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    className="text-sm hover:text-white transition-colors inline-flex items-center gap-1"
                    {...(item.external ? { target: "_blank", rel: "noreferrer" } : {})}
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
            <h4 className="text-xs font-semibold tracking-widest uppercase text-white/30 mb-4">Company</h4>
            <ul className="flex flex-col gap-2.5">
              {[
                { label: "Sign up", href: "/signup" },
                { label: "Log in", href: "/login" },
                { label: "Privacy Policy", href: "#" },
                { label: "Terms of Service", href: "#" },
              ].map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="text-sm hover:text-white transition-colors">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 pt-6 border-t border-white/8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs">&copy; {new Date().getFullYear()} SEER. All rights reserved.</p>
          <p className="text-xs text-white/30">Built with Claude Code</p>
        </div>
      </div>
    </footer>
  );
}
