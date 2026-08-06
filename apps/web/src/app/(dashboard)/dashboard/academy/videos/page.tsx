import { prisma } from "@/lib/prisma";
import { VideoCard } from "@/components/academy/VideoCard";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Training Videos | CnC Realty" };

export default async function TrainingVideosPage() {
  let videos: {
    id: string;
    title: string;
    youtubeId: string;
    description: string | null;
    creditLabel: string | null;
  }[] = [];

  try {
    videos = await prisma.academyVideo.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  } catch {
    // DB unreachable — show empty state
  }

  return (
    <div>
      <h1 className="mb-6 font-sans text-2xl font-medium text-[#1B1B1B]">Training Videos</h1>

      {videos.length === 0 ? (
        <EmptyState message="No training videos yet." />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {videos.map((video) => (
            <VideoCard
              key={video.id}
              title={video.title}
              youtubeId={video.youtubeId}
              description={video.description}
              creditLabel={video.creditLabel}
            />
          ))}
        </div>
      )}
    </div>
  );
}
