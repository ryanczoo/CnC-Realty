import { User } from "lucide-react";

interface Props {
  rawData: Record<string, unknown> | null;
  className?: string;
  iconClassName?: string;
}

export function AgentAttribution({
  rawData,
  className = "mt-4 flex items-center gap-2 text-sm text-[#1B1B1B]/70",
  iconClassName = "h-4 w-4 shrink-0 text-[#9E8C61]",
}: Props) {
  const agent = rawData?.ListAgentFullName as string | undefined;
  const office = rawData?.ListOfficeName as string | undefined;
  const license = rawData?.ListAgentStateLicense as string | undefined;

  return (
    <div className={className}>
      <User className={iconClassName} />
      {agent || office ? (
        <span>
          {agent && <>Listed by <span className="text-[#1B1B1B]/80">{agent}</span></>}
          {agent && license && <span className="text-[#1B1B1B]/60"> · DRE #{license}</span>}
          {office && <>{agent ? " · " : "Listed by "}<span className="text-[#1B1B1B]/80">{office}</span></>}
        </span>
      ) : (
        <span>Listing courtesy of California Regional MLS</span>
      )}
    </div>
  );
}
