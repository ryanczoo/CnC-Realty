import { describe, it, expect } from 'vitest';
import { googleCardView } from '@/components/dashboard/GoogleCalendarCard';

describe('googleCardView', () => {
  it('connected shows the email and Disconnect', () => {
    expect(googleCardView('connected', 'ryanchong@cncrealtygroup.com')).toEqual({
      line: '✓ Connected as ryanchong@cncrealtygroup.com',
      button: 'Disconnect',
    });
  });
  it('disconnected invites connecting', () => {
    expect(googleCardView('disconnected')).toEqual({
      line: 'Lets visitors book 15-min calls on your calendar.',
      button: 'Connect Google Calendar',
    });
  });
  it('broken says bookings are paused', () => {
    expect(googleCardView('broken')).toEqual({
      line: 'Connection lost — bookings are paused.',
      button: 'Reconnect',
    });
  });
});
