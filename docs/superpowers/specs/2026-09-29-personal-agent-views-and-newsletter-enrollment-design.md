# Personal Agent Views, Lead Assignment in All Leads, Newsletter Enrollment — Design

**Status:** design agreed with Ryan 2026-09-29, pending review of this written spec.
**Why:** the newsletter walkthrough (step 4) surfaced three problems: an admin's Agent-section tabs show every agent's data (a newsletter signup landed on Ryan's personal Leads board); a newsletter subscriber could not be assigned to an agent at all; and agents could see a newsletter list for something only admins control. Ryan also wants contact-form visitors enrolled in the newsletter.

## Decisions (Ryan)
1. **Agent section = personal for everyone, including admins.** Overview, Leads, Pipeline, Tasks, Transactions, Campaigns show only the signed-in user's own data. Ryan has his own leads to work; other agents' pipelines/tasks/campaigns are the agents' job.
2. **Admin section stays brokerage-wide** (Admin → Overview, All Agents, All Leads, All Files, …). Unchanged.
3. **Newsletter subscribers live in All Leads only.** They stay out of the Unassigned tab and its count (a subscriber isn't a lead to hand out).
4. **Any lead without an agent can be assigned from the All Leads tab** (subscriber or not), using the existing Assign flow.
5. **Newsletter is admin-only.** Agents can't send one (already enforced) and no longer see a newsletter smart list. Admins get one list named **"Newsletter"**, showing every subscriber in the brokerage.
6. **Contact-form enrollment, option C (disclaimer, no checkbox)** on three forms: the /contact page, the shared contact pop-up, and the agent-profile contact form. Disclaimer text (exact): *"By submitting, I agree to be contacted by CnC Realty for real estate services or news (unsubscribe anytime via email)."* Enrollees get the newsletter welcome email.
7. **Not enrolled:** the homepage "Let's Start" form and the property tour-request form.
8. **Assigned subscribers keep the name "Newsletter Subscriber"** so the agent knows it came from Ryan.
9. **Export CSV** restyled to match the "New Listing" button.

## 1. Personal Agent section

The pattern `role !== "ADMIN" ? session.user.agentId : null` (admin → no filter) is replaced with the signed-in user's own `session.user.agentId` in the Agent-section data paths. `agentId` is already cached on the session, so no extra lookups.

| Surface | File | Change |
|---|---|---|
| Overview (Agent) | `app/(dashboard)/dashboard/page.tsx` | counts scoped to own `agentId` |
| Leads board + custom smart lists + brokerage banner | `app/(dashboard)/dashboard/leads/page.tsx` | own `agentId` (admins now also get their custom lists and the "assigned to you" banner) |
| Smart list results | `GET /api/leads` (filters branch) | own `agentId`, **except** the admin "Newsletter" list (§3) |
| Lead pickers (campaign recipients, New Deal search, Link Contact) | `GET /api/leads` (no-filters branch) | own leads only — consistent with personal Campaigns/Pipeline |
| Pipeline board | `GET /api/deals?pipeline=` | own `agentId` |
| Deals box on a lead's page | `GET /api/deals?leadId=` | **unchanged for admins** — so an admin opening another agent's lead from All Leads still sees its deals |
| Tasks | `GET /api/tasks` | `lead: { agentId }` for everyone |
| Campaigns list | `app/(dashboard)/dashboard/campaigns/page.tsx` | list uses the already-present `personalAgentId` |
| Transactions | `/api/listings`, `/api/transactions` | already personal — no change |

Not touched: every `/admin/*` page, lead detail access (admins can still open any lead), `checkOwnership` (admins can still act on any record), per-agent email limits (Admin → All Agents, admin-only, enforced at send time — unaffected by what the Campaigns list shows).

An admin with no Agent record would see empty Agent-section tabs (Ryan has one).

## 2. Assigning from All Leads

- **Extract** the existing Assign modal and its state/handler out of `app/(dashboard)/admin/leads/AdminLeadsClient.tsx` into a shared `components/leads/AssignLeadModal.tsx` (props: lead to assign, agent list, onAssigned, onClose). Same `PATCH /api/admin/leads/[id]/assign` backend, same agent email, same pulse/spring button styles.
- The **Unassigned tab** uses it exactly as today.
- The **All Leads tab** shows an **Assign** button in the Agent column wherever the lead has no agent (replacing the plain "Unassigned" text). After assigning, that row shows the agent's name.
- The agent list is already loaded by `admin/leads/page.tsx` — no new query. It includes Ryan's own Agent record, so he can assign a lead to himself.
- `lib/unassigned-leads.ts` (`UNASSIGNED_LEADS_WHERE`) is **unchanged** — subscribers stay out of the Unassigned tab/count.

## 3. "Newsletter" smart list (admin-only)

- `PREBUILT_LISTS` entry renamed **"Newsletter"** (slug unchanged, `newsletter-subscribers`, so existing links work) and marked admin-only.
- `SmartListSidebar` hides admin-only lists for non-admins; `resolveListFilters` / the leads page treat the slug as invalid for non-admins (falls back to the Kanban).
- `GET /api/leads`: a filter set containing the `newsletter` condition is **brokerage-wide for admins** (the one exception to §1) and **rejected (403) for non-admins**.

## 4. Newsletter enrollment from contact forms

### Shared signup: `lib/newsletter.ts` → `subscribeToNewsletter()`
The logic now inline in `app/api/newsletter/subscribe/route.ts` moves here, used by the footer route and the three contact forms.

```
subscribeToNewsletter({ email, leadId?, source: "footer" | "contact-form" })
```

Rules, in order:
1. **One subscription per email address.** If any lead with that email (case-insensitive, shared `emailMatchWhere`) is already subscribed and not opted out → do nothing (no second subscription, no second welcome). Prevents the same person receiving every newsletter twice (the newsletter send reads subscribed *leads*, not unique addresses).
2. **A contact form never overrides an unsubscribe.** When the call comes from a contact form (`source: "contact-form"`) and any lead with that email has `newsletterOptOut = true` → do nothing. Only the footer (an explicit signup) re-subscribes an opted-out address — today's footer behavior, unchanged.
3. Otherwise subscribe **the given `leadId`** (the lead the contact form just created — for the agent-profile form that is the agent's lead, so it stays with the agent), or for the footer the oldest matching lead, or create the brokerage "Newsletter Subscriber" lead as today.
4. Welcome email ("Heck yeah, You're In!") only on a first subscription, via the existing `sendSafely(sendNewsletterWelcome(...))`.

The footer route keeps its rate limit, email validation and always-`{ ok: true }` response; its existing tests are kept and moved to cover the shared function where they test its logic.

### Which requests enroll
- `POST /api/leads` gains an optional `newsletterConsent: true`, sent only by the /contact page and `ContactModal`. When present, after creating the lead it calls `subscribeToNewsletter({ email, leadId, source: "contact-form" })`. All other callers (homepage "Let's Start", property tour request, an agent's Add Lead) don't send it → not enrolled.
- `POST /api/agents/[slug]/contact` always enrolls (it is only used by `AgentContactForm`), subscribing the agent's newly created lead.
- Enrollment failures never fail the form submission (logged via `sendSafely`/Sentry pattern) — the visitor's inquiry is what matters.

### Shared disclaimer: `components/ui/ContactConsentNotice.tsx`
One component holding the exact wording (decision 6), placed directly above the submit button in the /contact page, `ContactModal` (all 10 places it opens) and `AgentContactForm`. Small gray text matching each form's existing helper text.

### Legal basis (Claude's reading of the statutes, accepted by Ryan — not attorney advice)
- Cal. Bus. & Prof. Code §17529.1(l)/(o): someone who "has made an inquiry and has provided his or her e-mail address" has a preexisting business relationship, so newsletters to them are not "unsolicited" under §17529.2, provided each offers an opt-out (the newsletter's unsubscribe link does).
- CAN-SPAM (15 U.S.C. §7704(a)(5)): opt-out and physical address (in every email's shared footer) required; the "advertisement" label is excused only with prior affirmative consent (§7702(1)). Option C's disclaimer may not count as express consent; accepted by Ryan. The welcome email doubles as a clear notice of enrollment with an unsubscribe link.
- Privacy policy already covers promotional email and has an Email Marketing Opt-Out section.

## 5. Export CSV
`app/(dashboard)/admin/leads/page.tsx`: the Export CSV link gets the "New Listing" button's classes exactly (`rounded-full border border-[#1B1B1B]/20 bg-white px-4 py-2 text-sm text-[#1B1B1B]`). No shared button component exists for these; matching the reference directly.

## Performance
- Personal scoping narrows queries; the filters used (`Lead @@index([agentId])`, `Deal @@index([agentId])`, tasks via the lead's agent) are indexed and are the same queries agents already run.
- The two lookups newly run for admins on the Leads page (custom lists, assigned-leads banner) are small, indexed by agent, and already in the page's `Promise.all`.
- The admin "Newsletter" list only queries when opened. `newsletterSubscribedAt` has no index — fine at current volume; add one if the list grows into the thousands.
- Assign in All Leads reuses the already-loaded agent list. Contact-form enrollment runs only on public form submission, never on dashboard loads.
- Verify after build: timed load of each Agent tab for the admin account, before vs after.

## Testing
TDD throughout. New/updated tests:
- Scoping: overview, leads page, `GET /api/leads` (filters + no-filters, newsletter exception, agent 403), `GET /api/deals` (pipeline personal, leadId unscoped for admin), `GET /api/tasks`, campaigns page.
- `subscribeToNewsletter`: one-per-email, contact form doesn't override opt-out, footer does re-subscribe, subscribes the given lead (agent's lead stays assigned), welcome only on first join.
- `POST /api/leads` enrolls only with `newsletterConsent`; agent contact route enrolls into the agent's lead.
- Prebuilt list visibility by role.
Then full suite, `tsc`, lint, production build, and a browser pass: admin tabs personal, Newsletter list, Assign from All Leads, disclaimer on all three forms, live welcome email to a test address.

## Out of scope
Adding an index on `newsletterSubscribedAt`; an "advertisement" label on newsletters (option C accepted without one); the 5 hook warnings and the /sell "Our Values" dev warning (both deliberately left).
