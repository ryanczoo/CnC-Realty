import { User } from "lucide-react";

interface Props {
  listAgentName?: string | null;
  listAgentLicense?: string | null;
  listOfficeName?: string | null;
  className?: string;
  iconClassName?: string;
}

export function AgentAttribution({
  listAgentName,
  listAgentLicense,
  listOfficeName,
  className = "mt-4 flex items-center gap-2 text-sm text-[#1B1B1B]/70",
  iconClassName = "h-4 w-4 shrink-0 text-[#9E8C61]",
}: Props) {
  return (
    <div className={className}>
      <User className={iconClassName} />
      {listAgentName || listOfficeName ? (
        <span>
          {listAgentName && <>Listed by <span className="text-[#1B1B1B]/80">{listAgentName}</span></>}
          {listAgentName && listAgentLicense && <span className="text-[#1B1B1B]/60"> · DRE #{listAgentLicense}</span>}
          {listOfficeName && <>{listAgentName ? " · " : "Listed by "}<span className="text-[#1B1B1B]/80">{listOfficeName}</span></>}
        </span>
      ) : (
        <span>Listing courtesy of California Regional MLS</span>
      )}
    </div>
  );
}
