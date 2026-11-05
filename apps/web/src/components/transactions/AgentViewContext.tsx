"use client";
import { createContext, useCallback, useContext } from "react";
import { withAgentView } from "@/lib/agent-view";

// Wraps the Agent-section file page. Shared file components send the agent-view
// marker only inside it; the Admin file page is never wrapped, so it sends none.
const AgentViewContext = createContext(false);

export function AgentViewProvider({ children }: { children: React.ReactNode }) {
  return <AgentViewContext.Provider value={true}>{children}</AgentViewContext.Provider>;
}

const agentFetch: typeof fetch = (input, init) => fetch(input, withAgentView(init));

// Stable: returns the same function on every render so effects don't retrigger.
export function useFileFetch(): typeof fetch {
  const inAgentView = useContext(AgentViewContext);
  return useCallback<typeof fetch>(
    (input, init) => (inAgentView ? agentFetch(input, init) : fetch(input, init)),
    [inAgentView],
  );
}
