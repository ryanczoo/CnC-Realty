// The newsletter consent line shown above the submit button of every contact
// form that enrolls visitors (the /contact page, the shared contact pop-up and
// the agent-profile form). One place for the wording.
export function ContactConsentNotice() {
  return (
    <p className="font-sans text-xs leading-relaxed text-[#1B1B1B]/50">
      By submitting, I agree to be contacted by CnC Realty for real estate services or news (unsubscribe anytime via email).
    </p>
  );
}
