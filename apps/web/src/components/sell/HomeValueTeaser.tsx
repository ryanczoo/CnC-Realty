"use client";

import { useRouter } from "next/navigation";
import { AddressAutocomplete, AddressSuggestion } from "@/components/home-value/AddressAutocomplete";
import { RevealLine } from "@/components/ui/reveal-text";

function CalculatorIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={props.className}>
      <path d="M21 12C21 16.714 21 19.0711 19.682 20.5355C18.364 22 16.2426 22 12 22C7.75736 22 5.63604 22 4.31802 20.5355C3 19.0711 3 16.714 3 12C3 7.28595 3 4.92893 4.31802 3.46447C5.63604 2 7.75736 2 12 2C16.2426 2 18.364 2 19.682 3.46447C20.5583 4.43821 20.852 5.80655 20.9504 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 8C7 7.53501 7 7.30252 7.05111 7.11177C7.18981 6.59413 7.59413 6.18981 8.11177 6.05111C8.30252 6 8.53501 6 9 6H15C15.465 6 15.6975 6 15.8882 6.05111C16.4059 6.18981 16.8102 6.59413 16.9489 7.11177C17 7.30252 17 7.53501 17 8C17 8.46499 17 8.69748 16.9489 8.88823C16.8102 9.40587 16.4059 9.81019 15.8882 9.94889C15.6975 10 15.465 10 15 10H9C8.53501 10 8.30252 10 8.11177 9.94889C7.59413 9.81019 7.18981 9.40587 7.05111 8.88823C7 8.69748 7 8.46499 7 8Z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="13" r="1" fill="currentColor" />
      <circle cx="8" cy="17" r="1" fill="currentColor" />
      <circle cx="12" cy="13" r="1" fill="currentColor" />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
      <circle cx="16" cy="13" r="1" fill="currentColor" />
      <circle cx="16" cy="17" r="1" fill="currentColor" />
    </svg>
  );
}

function TagPriceIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={props.className}>
      <path d="M15.3893 15.3891C15.9751 14.8033 16.0542 13.9327 15.5661 13.4445C15.0779 12.9564 14.2073 13.0355 13.6215 13.6213C13.0358 14.2071 12.1652 14.2863 11.677 13.7981C11.1888 13.3099 11.268 12.4393 11.8538 11.8536M15.3893 15.3891L15.7429 15.7426M15.3893 15.3891C14.9883 15.7901 14.4539 15.9537 14 15.8604M11.5002 11.5L11.8538 11.8536M11.8538 11.8536C12.185 11.5223 12.6073 11.3531 13 11.3568" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8.60693 10.8789C9.7115 10.8789 10.6069 9.98348 10.6069 8.87891C10.6069 7.77434 9.7115 6.87891 8.60693 6.87891C7.50236 6.87891 6.60693 7.77434 6.60693 8.87891" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16.1369 4.72848C14.5914 3.18295 13.8186 2.41018 12.816 2.12264C11.8134 1.83509 10.7485 2.08083 8.61875 2.57231L7.39057 2.85574C5.59881 3.26922 4.70292 3.47597 4.08944 4.08944C3.47597 4.70292 3.26922 5.59881 2.85574 7.39057L2.57231 8.61875C2.08083 10.7485 1.83509 11.8134 2.12264 12.816C2.41018 13.8186 3.18295 14.5914 4.72848 16.1369L6.55812 17.9665C9.24711 20.6555 10.5916 22 12.2623 22C13.933 22 15.2775 20.6555 17.9665 17.9665C20.6555 15.2775 22 13.933 22 12.2623C22 10.9198 21.1319 9.788 19.3957 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CourseUpIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={props.className}>
      <path d="M22 7V12.5458M22 7H16.4179M22 7L17.5 11.5M14.6203 14.3347C13.6227 15.3263 13.1238 15.822 12.5051 15.822C11.8864 15.8219 11.3876 15.326 10.3902 14.3342L10.1509 14.0962C9.15254 13.1035 8.65338 12.6071 8.03422 12.6074C7.41506 12.6076 6.91626 13.1043 5.91867 14.0977L2 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MapPointWaveIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={props.className}>
      <path d="M5.875 12.5729C5.30847 11.2498 5 9.84107 5 8.51463C5 4.9167 8.13401 2 12 2C15.866 2 19 4.9167 19 8.51463C19 12.0844 16.7658 16.2499 13.2801 17.7396C12.4675 18.0868 11.5325 18.0868 10.7199 17.7396C9.60664 17.2638 8.62102 16.5151 7.79508 15.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 9C14 10.1046 13.1046 11 12 11C10.8954 11 10 10.1046 10 9C10 7.89543 10.8954 7 12 7C13.1046 7 14 7.89543 14 9Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M20.9605 15.5C21.6259 16.1025 22 16.7816 22 17.5C22 18.4251 21.3797 19.285 20.3161 20M3.03947 15.5C2.37412 16.1025 2 16.7816 2 17.5C2 19.9853 6.47715 22 12 22C13.6529 22 15.2122 21.8195 16.5858 21.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const FEATURES = [
  { icon: CalculatorIcon, label: "Our Estimate", body: "Based off real numbers and information directly from the MLS" },
  { icon: TagPriceIcon, label: "Comparable Sales", body: "Check out what similar homes in your neighborhood sold for" },
  { icon: CourseUpIcon, label: "Price History", body: "See past sales and prices of your home or other properties" },
  { icon: MapPointWaveIcon, label: "Market Snapshot", body: "Get a good idea of recent activity within your zip code" },
];

export function HomeValueTeaser() {
  const router = useRouter();

  function handleSelect(s: AddressSuggestion) {
    const params = new URLSearchParams({
      address: s.street,
      city: s.city,
      state: s.state,
      zip: s.zip,
      lat: String(s.lat),
      lng: String(s.lng),
    });
    router.push(`/home-value?${params.toString()}`);
  }

  return (
    <section className="mx-auto max-w-5xl px-6 py-28 text-center">
      <h2 className="font-sans text-[2.8rem] font-light text-[#1B1B1B] xl:text-[3.4rem]">
        <RevealLine>
          <span className="text-[2.1rem] xl:text-[2.5rem]">Sell </span>
          <span style={{ color: "#9E8C61", fontWeight: 500 }}>Smarter</span>
        </RevealLine>
      </h2>
      <p className="mt-5 text-lg text-[#1B1B1B]/60 xl:text-xl">
        Instant home value report complete with MLS data and local insight of your home free
      </p>

      <div className="mx-auto mt-12 max-w-2xl">
        <AddressAutocomplete onSelect={handleSelect} />
      </div>

      <div className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-x-14 gap-y-10 text-left sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, label, body }) => (
          <div key={label} className="flex gap-5">
            <Icon className="mt-1 h-8 w-8 shrink-0 text-[#1B1B1B]/70" />
            <div>
              <p className="text-base font-medium uppercase tracking-wide text-[#1B1B1B]">{label}</p>
              <p className="mt-1.5 text-lg text-[#1B1B1B]/60">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
