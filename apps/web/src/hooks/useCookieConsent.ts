"use client";

import { useState, useEffect } from "react";

type ConsentState = "granted" | "denied" | null;

const STORAGE_KEY = "cnc_cookie_consent";

export function useCookieConsent() {
  const [consent, setConsent] = useState<ConsentState>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ConsentState | null;
    setConsent(stored);
  }, []);

  const grant = () => {
    localStorage.setItem(STORAGE_KEY, "granted");
    setConsent("granted");
  };

  const deny = () => {
    localStorage.setItem(STORAGE_KEY, "denied");
    setConsent("denied");
  };

  return { consent, grant, deny };
}
