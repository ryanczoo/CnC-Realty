import { Skeleton } from "@/components/ui/skeleton";

export default function PropertiesLoading() {
  return (
    <div className="flex h-[calc(100vh-64px)] mt-16">
      <div className="w-[45%] overflow-y-auto border-r border-[#E8E6E4] p-4 space-y-4">
        <Skeleton className="h-12 w-full rounded-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl overflow-hidden space-y-2">
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ))}
      </div>
      <div className="flex-1">
        <Skeleton className="h-full w-full rounded-none" />
      </div>
    </div>
  );
}
