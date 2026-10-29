// Shown by the Search page and the city pages when the listings query fails.
export function SearchUnavailable() {
  return (
    <div data-navbar-theme="light" className="flex min-h-screen items-center justify-center bg-[#F2F0EF]">
      <div className="text-center">
        <p className="text-lg font-light text-[#1B1B1B]">Unable to load listings right now.</p>
        <p className="mt-2 text-sm text-[#1B1B1B]/50">Please check your connection and try again.</p>
      </div>
    </div>
  );
}
