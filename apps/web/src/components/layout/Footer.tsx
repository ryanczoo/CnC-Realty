import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t bg-[var(--brand-navy)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div>
            <h3 className="text-lg font-bold text-[var(--brand-gold)]">CnC Realty Group</h3>
            <p className="mt-2 text-sm text-gray-300">
              California&apos;s trusted real estate brokerage. Helping buyers find their dream home
              and agents build their business.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-300">
              Quick Links
            </h4>
            <ul className="mt-3 space-y-2 text-sm">
              {[
                { href: "/buy", label: "Buy" },
                { href: "/sell", label: "Sell" },
                { href: "/join", label: "Join CnC" },
                { href: "/news", label: "News" },
                { href: "/about", label: "About" },
                { href: "/contact", label: "Contact" },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-gray-300 hover:text-[var(--brand-gold)]">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-300">
              Contact
            </h4>
            <ul className="mt-3 space-y-2 text-sm text-gray-300">
              <li>
                <a href="mailto:info@cncrealtygroup.com" className="hover:text-[var(--brand-gold)]">
                  info@cncrealtygroup.com
                </a>
              </li>
              <li>
                <a href="https://cncrealtygroup.com" className="hover:text-[var(--brand-gold)]">
                  cncrealtygroup.com
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-white/10 pt-6 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} CnC Realty Group. All rights reserved. CA DRE #XXXXXXXX
        </div>
      </div>
    </footer>
  );
}
