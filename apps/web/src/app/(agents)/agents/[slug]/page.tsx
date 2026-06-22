import { cache } from "react";
import { notFound } from "next/navigation";
import { agentJsonLd } from "@/lib/json-ld";

export const revalidate = 300;
import { prisma } from "@/lib/prisma";
import { AgentProfileHero } from "@/components/agents/AgentProfileHero";
import { AgentContactForm } from "@/components/agents/AgentContactForm";
import type { Metadata } from "next";

const getAgent = cache((slug: string) =>
  prisma.agent.findUnique({ where: { slug }, select: { id: true, userId: true, slug: true, displayName: true, bio: true, headshot: true, licenseNum: true, licenseState: true, yearsExp: true, specialties: true, phone: true, instagram: true, facebook: true, linkedin: true, listingsClosed: true, volumeClosed: true } })
);

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const agent = await getAgent(params.slug);
  if (!agent) return { title: "Agent Not Found | CnC Realty" };
  return {
    title: `${agent.displayName ?? agent.slug} | CnC Realty Group`,
    description:
      agent.bio ?? `Connect with ${agent.displayName ?? "a CnC Realty agent"} today.`,
  };
}

export default async function AgentProfilePage({ params }: Props) {
  const agent = await getAgent(params.slug);
  if (!agent) notFound();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            agentJsonLd({
              name: agent.displayName ?? agent.slug,
              slug: agent.slug,
              bio: agent.bio,
              headshot: agent.headshot ? `/api/headshot/${agent.userId}` : null,
              phone: agent.phone,
            })
          ),
        }}
      />
      <main data-navbar-theme="dark">
      <AgentProfileHero
        displayName={agent.displayName}
        headshot={agent.headshot ? `/api/headshot/${agent.userId}` : null}
        bio={agent.bio}
        licenseNum={agent.licenseNum}
        licenseState={agent.licenseState}
        yearsExp={agent.yearsExp}
        specialties={agent.specialties}
        phone={agent.phone}
        instagram={agent.instagram}
        facebook={agent.facebook}
        linkedin={agent.linkedin}
        listingsClosed={agent.listingsClosed}
        volumeClosed={agent.volumeClosed}
      />

      <section className="bg-cnc-bg py-16">
        <div className="mx-auto max-w-xl px-6">
          <h2 className="mb-2 font-sans text-2xl font-light text-[#1B1B1B]">Get in Touch</h2>
          <p className="mb-8 font-sans text-sm text-[#1B1B1B]/60">
            Ready to buy, sell, or just have questions? Send a message and{" "}
            {agent.displayName ?? "the agent"} will reach out.
          </p>
          <AgentContactForm slug={params.slug} />
        </div>
      </section>
    </main>
    </>
  );
}
