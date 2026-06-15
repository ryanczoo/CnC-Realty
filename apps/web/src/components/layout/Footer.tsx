"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { SPRING_HOVER } from "@/lib/motion";

function EmailIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 7.00005L10.2 11.65C11.2667 12.45 12.7333 12.45 13.8 11.65L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2.03998C6.5 2.03998 2 6.52998 2 12.06C2 17.06 5.66 21.21 10.44 21.96V14.96H7.9V12.06H10.44V9.84998C10.44 7.33998 11.93 5.95998 14.22 5.95998C15.31 5.95998 16.45 6.14998 16.45 6.14998V8.61998H15.19C13.95 8.61998 13.56 9.38998 13.56 10.18V12.06H16.34L15.89 14.96H13.56V21.96C15.9164 21.5878 18.0622 20.3855 19.6099 18.57C21.1576 16.7546 22.0054 14.4456 22 12.06C22 6.52998 17.5 2.03998 12 2.03998Z"/>
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 18C15.3137 18 18 15.3137 18 12C18 8.68629 15.3137 6 12 6C8.68629 6 6 8.68629 6 12C6 15.3137 8.68629 18 12 18ZM12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16Z" fill="currentColor"/>
      <path d="M18 5C17.4477 5 17 5.44772 17 6C17 6.55228 17.4477 7 18 7C18.5523 7 19 6.55228 19 6C19 5.44772 18.5523 5 18 5Z" fill="currentColor"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M1.65396 4.27606C1 5.55953 1 7.23969 1 10.6V13.4C1 16.7603 1 18.4405 1.65396 19.7239C2.2292 20.8529 3.14708 21.7708 4.27606 22.346C5.55953 23 7.23969 23 10.6 23H13.4C16.7603 23 18.4405 23 19.7239 22.346C20.8529 21.7708 21.7708 20.8529 22.346 19.7239C23 18.4405 23 16.7603 23 13.4V10.6C23 7.23969 23 5.55953 22.346 4.27606C21.7708 3.14708 20.8529 2.2292 19.7239 1.65396C18.4405 1 16.7603 1 13.4 1H10.6C7.23969 1 5.55953 1 4.27606 1.65396C3.14708 2.2292 2.2292 3.14708 1.65396 4.27606ZM13.4 3H10.6C8.88684 3 7.72225 3.00156 6.82208 3.0751C5.94524 3.14674 5.49684 3.27659 5.18404 3.43597C4.43139 3.81947 3.81947 4.43139 3.43597 5.18404C3.27659 5.49684 3.14674 5.94524 3.0751 6.82208C3.00156 7.72225 3 8.88684 3 10.6V13.4C3 15.1132 3.00156 16.2777 3.0751 17.1779C3.14674 18.0548 3.27659 18.5032 3.43597 18.816C3.81947 19.5686 4.43139 20.1805 5.18404 20.564C5.49684 20.7234 5.94524 20.8533 6.82208 20.9249C7.72225 20.9984 8.88684 21 10.6 21H13.4C15.1132 21 16.2777 20.9984 17.1779 20.9249C18.0548 20.8533 18.5032 20.7234 18.816 20.564C19.5686 20.1805 20.1805 19.5686 20.564 18.816C20.7234 18.5032 20.8533 18.0548 20.9249 17.1779C20.9984 16.2777 21 15.1132 21 13.4V10.6C21 8.88684 20.9984 7.72225 20.9249 6.82208C20.8533 5.94524 20.7234 5.49684 20.564 5.18404C20.1805 4.43139 19.5686 3.81947 18.816 3.43597C18.5032 3.27659 18.0548 3.14674 17.1779 3.0751C16.2777 3.00156 15.1132 3 13.4 3Z" fill="currentColor"/>
    </svg>
  );
}

function YoutubeIcon() {
  return (
    <svg width="38" height="38" viewBox="0 -0.5 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M18.168 19.0028C20.4724 19.0867 22.41 17.29 22.5 14.9858V9.01982C22.41 6.71569 20.4724 4.91893 18.168 5.00282H6.832C4.52763 4.91893 2.58998 6.71569 2.5 9.01982V14.9858C2.58998 17.29 4.52763 19.0867 6.832 19.0028H18.168Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M12.008 9.17784L15.169 11.3258C15.3738 11.4454 15.4997 11.6647 15.4997 11.9018C15.4997 12.139 15.3738 12.3583 15.169 12.4778L12.008 14.8278C11.408 15.2348 10.5 14.8878 10.5 14.2518V9.75184C10.5 9.11884 11.409 8.77084 12.008 9.17784Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
const NAV_LINKS = [
  { href: "/buy", label: "Buy" },
  { href: "/sell", label: "Sell" },
  { href: "/rent", label: "Rent" },
  { href: "/manage", label: "Property Management" },
  { href: "/join", label: "Join CnC" },
  { href: "/contact", label: "Contact" },
  { href: "/news", label: "News" },
];

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms" },
  { href: "/fair-housing", label: "Fair Housing Notice" },
{ href: "/dmca", label: "DMCA Notice" },
  { href: "/do-not-sell", label: "Do Not Sell or Share My Personal Information" },
];

export function Footer() {
  const ref = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = 1;
  }, []);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end end"],
  });

  const clipPath = useTransform(
    scrollYProgress,
    [0, 1],
    ["inset(65% 0 0 0)", "inset(0% 0 0 0)"]
  );

  return (
    <footer ref={ref} className="sticky bottom-0 min-h-[600px] w-full overflow-hidden">
      {/* Video background */}
      <motion.div className="absolute inset-0" style={{ clipPath }}>
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          className="h-full w-full object-cover object-center"
        >
          <source src="/videos/footer-bg.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/55" />
      </motion.div>

      {/* Content */}
      <motion.div
        className="absolute inset-0 flex flex-col justify-end"
        style={{ clipPath }}
      >
        {/* Main 3-column row */}
        <div className="flex items-end justify-between px-8 pb-6 pt-12 lg:px-16">

          {/* Left — large logo */}
          <div className="flex-shrink-0">
            <Image
              src="/logo-white.png"
              alt="CnC Realty Group"
              width={280}
              height={280}
              className="object-contain object-left"
            />
          </div>

          {/* Center — contact + newsletter + socials */}
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="flex flex-col items-center gap-2">
              <p className="font-sans text-base font-light text-white">
                Los Angeles, CA, USA
              </p>
              <a
                href="mailto:info@cncrealtygroup.com"
                className="flex items-center gap-2 font-sans text-base font-light text-white transition-colors hover:text-[#9E8C61]"
              >
                <EmailIcon />
                info@cncrealtygroup.com
              </a>
            </div>

            <div className="flex w-full max-w-[280px] flex-col gap-2">
              <p className="font-sans text-base font-light text-white">
                Subscribe to our Newsletter:
              </p>
              <div className="relative flex items-center border-b border-white/40 pb-1 transition-colors focus-within:border-white/80">
                <input
                  type="email"
                  placeholder="Enter Email"
                  className="w-full bg-transparent font-sans text-base font-light text-white placeholder-white/40 outline-none"
                />
                <button
                  type="button"
                  aria-label="Subscribe"
                  className="ml-2 flex-shrink-0 text-white/60 transition-colors hover:text-white"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 30 30"
                    fill="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ transform: "rotate(-90deg)" }}
                  >
                    <path d="M16 20.488c0-.13.053-.253.146-.344l13-13.002c.42-.44 1.174.24.706.707l-13 13c-.302.31-.853.096-.853-.362zM.852 7.142l14 14.002c.447.447-.273 1.16-.707.707l-14-14c-.444-.445.26-1.155.707-.708z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Social icons */}
            <div className="flex items-center gap-7">
              {[
                {
                  href: "https://www.facebook.com/CnCRealtyGroup", label: "Facebook", icon: <FacebookIcon />,
                },
                {
                  href: "https://www.instagram.com/cncrealty", label: "Instagram", icon: <InstagramIcon />,
                },
                {
                  href: "https://www.youtube.com/@CnCRealtyGroup", label: "YouTube", icon: <YoutubeIcon />,
                },
              ].map(({ href, label, icon }) => (
                <motion.a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex items-center justify-center text-white/80 hover:text-white"
                  whileHover={{ scale: 1.2 }}
                  transition={SPRING_HOVER}
                >
                  {icon}
                </motion.a>
              ))}
            </div>
          </div>

          {/* Right — nav links */}
          <div className="flex flex-col items-end gap-2">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-sans text-base font-light text-white transition-colors hover:text-[#9E8C61]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Bottom legal bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-8 py-4 lg:px-16">
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-sans text-xs text-white/40">CA DRE #02439028</span>
            <span className="font-sans text-xs text-white/40">Designated Broker - Ryan Chong</span>
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-sans text-xs text-white/40 transition-colors hover:text-white/70"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <span className="font-sans text-xs text-white/40">
              © {new Date().getFullYear()} CnC Realty
            </span>
            <span className="font-sans text-xs text-white/40">All Rights Reserved</span>
          </div>
        </div>
      </motion.div>
    </footer>
  );
}
