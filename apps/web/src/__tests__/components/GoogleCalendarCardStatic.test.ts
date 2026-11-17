import { describe, it, expect, vi } from 'vitest';
import { createElement, forwardRef, type ElementType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GoogleCalendarCard from '@/components/dashboard/GoogleCalendarCard';

// The pulse only runs in the browser, so server markup can't show it. Instead, tag every
// framer-motion element so the test can see whether the card's buttons are animated ones.
// (vi.mock is hoisted above the imports, so the card below gets this mock.)
vi.mock('framer-motion', () => {
  const tag = (Comp: ElementType) =>
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    forwardRef<unknown, Record<string, unknown>>(function Tagged({ animate, transition, whileHover, ...rest }, ref) {
      return createElement(Comp, { ...rest, ref, 'data-motion': 'true' });
    });
  const motion = new Proxy(tag, { get: (_t, el: string) => tag(el as ElementType) });
  return { motion };
});

function renderWith(status: { status: 'connected' | 'disconnected'; email?: string }) {
  const qc = new QueryClient();
  qc.setQueryData(['google-calendar', 'status'], status);
  return renderToStaticMarkup(
    createElement(QueryClientProvider, { client: qc }, createElement(GoogleCalendarCard)),
  );
}

// Ryan (2026-11-17): the Connect / Disconnect buttons stay still — no pulse.
describe('GoogleCalendarCard buttons are static', () => {
  it('Disconnect button is not an animated element', () => {
    const html = renderWith({ status: 'connected', email: 'ryanchong@cncrealtygroup.com' });
    const button = html.match(/<button[^>]*>Disconnect<\/button>/)?.[0];
    expect(button).toBeDefined();
    expect(button).not.toContain('data-motion');
  });

  it('Connect link is not an animated element', () => {
    const html = renderWith({ status: 'disconnected' });
    const link = html.match(/<a[^>]*>Connect Google Calendar<\/a>/)?.[0];
    expect(link).toBeDefined();
    expect(link).not.toContain('data-motion');
  });
});
