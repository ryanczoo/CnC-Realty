import { cache } from "react";
import { notFound } from "next/navigation";
import { agentJsonLd } from "@/lib/json-ld";

export const revalidate = 300;
import { prisma } from "@/lib/prisma";
import { AgentProfileHero } from "@/components/agents/AgentProfileHero";
import { AgentContactForm } from "@/components/agents/AgentContactForm";
import type { Metadata } from "next";

const getAgent = cache((slug: string) =>
  prisma.agent.findUnique({
    where: { slug },
    select: {
      id: true,
      userId: true,
      slug: true,
      displayName: true,
      title: true,
      bio: true,
      headshot: true,
      licenseNum: true,
      licenseState: true,
      yearsExp: true,
      specialties: true,
      phone: true,
      instagram: true,
      facebook: true,
      location: true,
      language: true,
      user: { select: { email: true } },
      listingsClosed: true,
      volumeClosed: true,
      propertiesRented: true,
    },
  })
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

  // Fetch up to 12 closed transactions for the Past Transactions section.
  // Referrals are excluded: referring a client out isn't a transaction the
  // agent personally closed (no property/price, handled by someone else).
  const rawTransactions = await prisma.transactionFile.findMany({
    where: { agentId: agent.id, status: "CLOSED", transactionSide: { not: "REFERRAL" } },
    select: {
      id: true,
      propertyAddress: true,
      city: true,
      state: true,
      transactionSide: true,
      salePrice: true,
      listPrice: true,
      closeOfEscrow: true,
    },
    orderBy: { closeOfEscrow: "desc" },
    take: 12,
  });

  // Serialize Date → ISO string so the server component can pass it as props
  const transactions = rawTransactions.map((tx) => ({
    id: tx.id,
    propertyAddress: tx.propertyAddress,
    city: tx.city,
    state: tx.state,
    transactionSide: tx.transactionSide,
    salePrice: tx.salePrice ?? null,
    listPrice: tx.listPrice ?? null,
    closeOfEscrow: tx.closeOfEscrow?.toISOString() ?? null,
  }));

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
          title={agent.title}
          headshot={agent.headshot ? `/api/headshot/${agent.userId}` : null}
          bio={agent.bio}
          licenseNum={agent.licenseNum}
          licenseState={agent.licenseState}
          yearsExp={agent.yearsExp}
          specialties={agent.specialties}
          phone={agent.phone}
          email={agent.user.email}
          instagram={agent.instagram}
          facebook={agent.facebook}
          location={agent.location}
          language={agent.language}
          listingsClosed={agent.listingsClosed}
          volumeClosed={agent.volumeClosed}
          propertiesRented={agent.propertiesRented}
          transactions={transactions}
        />

        <section id="contact" className="bg-cnc-bg py-16">
          <div className="mx-auto max-w-xl px-6">
            <h2 className="mb-2 font-sans text-2xl font-light text-[#1B1B1B]">
              Get in Touch
            </h2>
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
