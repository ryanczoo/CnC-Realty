# Booking Calendar: Google Setup Guide (for Ryan)

You do the clicking. Claude does not drive your browser.

## Part A: Google Cloud

Open a **private/incognito window** so your personal Gmail is not the active account. Sign in as **ryanchong@cncrealtygroup.com** only.

1. Go to console.cloud.google.com. Click the project picker (top bar) → **New Project** → name it **CnC Booking** → **Create**. Make sure it is selected.
2. Menu → **APIs & Services** → **Library** → search **Google Calendar API** → **Enable**.
3. Menu → **APIs & Services** → **OAuth consent screen** (may be called **Google Auth Platform**):
   1. User type **External**. App name **CnC Realty Booking**. Support email and developer email: ryanchong@cncrealtygroup.com.
   2. **Scopes** → **Add or remove scopes**. Keep the defaults (openid, email) and add:
      - `https://www.googleapis.com/auth/calendar.events`
      - `https://www.googleapis.com/auth/calendar.freebusy`
   3. **Publish app** → set Publishing status to **In production**. (Testing mode disconnects the calendar every 7 days.)
4. Menu → **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID** → type **Web application**. Under **Authorized redirect URIs** add exactly these two:
   - `https://cncrealtygroup.com/api/google-calendar/callback`
   - `http://localhost:3000/api/google-calendar/callback`
5. Click **Create**. Copy the **Client ID** and **Client secret**.

## Part B: Keys

Four values go in **Vercel** (Project → Settings → Environment Variables, tick Production + Preview + Development) and in `apps/web/.env.local`:

- `GOOGLE_CAL_CLIENT_ID` (you paste, from Google)
- `GOOGLE_CAL_CLIENT_SECRET` (you paste, from Google)
- `GOOGLE_TOKEN_KEY` (Claude generates and hands to you)
- `BOOKING_LINK_SECRET` (Claude generates and hands to you)

Never paste these into chat screenshots or email.

## Part C: Connect (after deploy)

1. Dashboard → **Settings** → **Google Calendar** card → **Connect Google Calendar**.
2. Pick **ryanchong@cncrealtygroup.com**.
3. Google shows "Google hasn't verified this app". This is expected: it is a private app only you use. Click **Advanced** → **Go to CnC Realty Booking (unsafe)**.
4. On the permissions screen, tick **both** Google Calendar boxes, then click **Continue** / **Allow**. (If you leave them unticked the site shows an error and won't save the connection.)

## Part D: Days off

Add one of these to your Google Calendar:

- A timed event, 8 AM to 8 PM (Busy by default), or
- An all-day event switched to **Busy**. All-day events default to Free and will NOT block bookings.

## Part E: Recruiting email button

1. In your Outlook template, add a button or link with the text **Book a call** pointing to exactly:
   `https://cncrealtygroup.com/join?book=AGENT#book-a-call`
2. Send one email to yourself. The mailer uses your newest Sent copy as the template.
