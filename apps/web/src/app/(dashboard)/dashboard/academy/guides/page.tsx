const GUIDES = [
  { title: "Independent Contractor Agreement", href: "/join/ica" },
  { title: "W-9 Form", href: "/documents/w9-blank.pdf" },
];

export const metadata = { title: "Helpful Guides | CnC Realty" };

export default function HelpfulGuidesPage() {
  return (
    <div>
      <h1 className="mb-6 font-sans text-2xl font-medium text-[#1B1B1B]">Helpful Guides</h1>

      <ul className="max-w-md divide-y divide-[#1B1B1B]/10 rounded-xl border border-[#1B1B1B]/10 bg-white">
        {GUIDES.map(({ title, href }) => (
          <li key={href}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-5 py-4 font-sans text-sm text-[#1B1B1B] transition-colors hover:bg-[#F2F0EF] hover:text-[#9E8C61]"
            >
              {title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
