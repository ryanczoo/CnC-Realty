"use client";

import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const FORCE_DARK_ROUTES = ["/account", "/dashboard", "/admin"];

const NAV_LINKS = [
  { href: "/buy", label: "Buy" },
  { href: "/sell", label: "Sell" },
  { href: "/rent", label: "Rent" },
  { href: "/manage", label: "Property Management" },
  { href: "/join", label: "Join CnC" },
  { href: "/contact", label: "Contact" },
  { href: "/news", label: "News" },
];

function BurgerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4 5C3.44772 5 3 5.44772 3 6C3 6.55228 3.44772 7 4 7H20C20.5523 7 21 6.55228 21 6C21 5.44772 20.5523 5 20 5H4ZM7 12C7 11.4477 7.44772 11 8 11H20C20.5523 11 21 11.4477 21 12C21 12.5523 20.5523 13 20 13H8C7.44772 13 7 12.5523 7 12ZM13 18C13 17.4477 13.4477 17 14 17H20C20.5523 17 21 17.4477 21 18C21 18.5523 20.5523 19 20 19H14C13.4477 19 13 18.5523 13 18Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const isHomepage = pathname === "/";
  const forceDark = FORCE_DARK_ROUTES.some((r) => pathname.startsWith(r));
  const [scrolled, setScrolled] = useState(false);
  const [pastHero, setPastHero] = useState(forceDark);
  const [menuOpen, setMenuOpen] = useState(false);
  const heroHeightRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    setPastHero(forceDark);
    setScrolled(false);
  }, [forceDark]);

  useEffect(() => {
    heroHeightRef.current = window.innerHeight;
    const onResize = () => { heroHeightRef.current = window.innerHeight; };
    window.addEventListener("resize", onResize);

    const onScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const y = window.scrollY;
        setScrolled((prev) => { const next = y > 30; return prev === next ? prev : next; });
        if (isHomepage && !forceDark) {
          const next = y > heroHeightRef.current * 0.85;
          setPastHero((prev) => prev === next ? prev : next);
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [isHomepage, forceDark]);

  const pillCls = cn(
    "flex h-9 items-center justify-center rounded-full px-4 text-sm font-medium transition-all duration-300",
    pastHero
      ? "border border-[#1B1B1B]/60 text-[#1B1B1B] hover:border-[#1B1B1B] hover:bg-[#1B1B1B] hover:text-white"
      : "border border-white/60 text-white hover:border-white hover:bg-white hover:text-black"
  );

  function getAuthLink() {
    if (!session) return { href: "/login", label: "Login" };
    return session.user.role === "BUYER"
      ? { href: "/account", label: "My Account" }
      : { href: "/dashboard", label: "Dashboard" };
  }
  const authLink = getAuthLink();

  return (
    <>
      <header
        className={cn(
          "fixed top-0 z-50 w-full transition-all duration-300",
          scrolled && !pastHero && "bg-black/10 backdrop-blur-md border-b border-white/10",
          pastHero && "bg-[#F2F0EF]/60 backdrop-blur-md border-b border-[#1B1B1B]/10"
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" onClick={() => setMenuOpen(false)}>
            <motion.div
              whileHover={{ scale: 1.15 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <Image
                src="/logo-white.png"
                alt="CnC Realty Group"
                height={19}
                width={65}
                className="object-contain transition-[filter] duration-300"
                style={pastHero ? { filter: "invert(1)" } : undefined}
                priority
              />
            </motion.div>
          </Link>

          <div className="flex items-center gap-3">
            {authLink && (
              <motion.div whileHover={{ scale: 1.15 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                <Link href={authLink.href}>
                  <span className={pillCls}>{authLink.label}</span>
                </Link>
              </motion.div>
            )}

            <motion.button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              whileHover={{ scale: 1.15 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300",
                pastHero
                  ? "border border-[#1B1B1B]/60 text-[#1B1B1B] hover:border-[#1B1B1B] hover:bg-[#1B1B1B] hover:text-white"
                  : "border border-white/60 text-white hover:border-white hover:bg-white hover:text-black"
              )}
            >
              {menuOpen ? <X size={15} /> : <BurgerIcon />}
            </motion.button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/40"
              onClick={() => setMenuOpen(false)}
            />

            <motion.div
              key="panel"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="fixed right-4 top-[4.5rem] z-50 w-56 overflow-hidden rounded-xl border border-white/10 bg-zinc-900/95 shadow-2xl backdrop-blur-md sm:right-6 lg:right-8"
            >
              <nav className="py-3">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="block px-6 py-3 text-center text-sm font-medium text-white/80 transition-colors hover:bg-white/5 hover:text-[#c9a84c]"
                  >
                    {link.label}
                  </Link>
                ))}

                {session && (
                  <>
                    <div className="mx-6 my-2 h-px bg-white/10" />
                    <button
                      onClick={() => { signOut(); setMenuOpen(false); }}
                      className="block w-full px-6 py-3 text-center text-sm text-white/40 transition-colors hover:text-[#c9a84c]"
                    >
                      Sign Out
                    </button>
                  </>
                )}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
