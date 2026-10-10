// Tabs on the client /account page. State and panels use the full names; phones (<1024px)
// show the short label so all three fit on one line at 320px.
export const ACCOUNT_TABS = ["Saved Properties", "Tour Requests", "Settings"] as const;
export type AccountTab = (typeof ACCOUNT_TABS)[number];

const SHORT: Record<AccountTab, string> = {
  "Saved Properties": "Saved",
  "Tour Requests": "Tours",
  Settings: "Settings",
};

export function accountTabShortLabel(tab: AccountTab): string {
  return SHORT[tab];
}
