import { FAQ } from "@/components/home/FAQ";
import { FeaturedListingsServer } from "@/components/home/FeaturedListingsServer";
import { HeroSection } from "@/components/home/HeroSection";
import { JoinCnCCTA } from "@/components/home/JoinCnCCTA";
import { ServicesSection } from "@/components/home/ServicesSection";
import { Testimonials } from "@/components/home/Testimonials";
import { WhyCnC } from "@/components/home/WhyCnC";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <FeaturedListingsServer />
      <div className="bg-[#F2F0EF] px-16 pt-10 pb-0">
        <div className="h-px w-full bg-[#1B1B1B]/10" />
      </div>
      <WhyCnC />
      <div className="bg-[#F2F0EF] px-16 py-10">
        <div className="h-px w-full bg-[#1B1B1B]/10" />
      </div>
      <ServicesSection />
      <div className="bg-[#F2F0EF] px-16 py-10">
        <div className="h-px w-full bg-[#1B1B1B]/10" />
      </div>
      <Testimonials />
      <div style={{ height: "80px", background: "linear-gradient(to bottom, #F2F0EF, #DAD4D2)" }} />
      <FAQ className="bg-[#DAD4D2]" />
      <div style={{ height: "80px", background: "linear-gradient(to bottom, #DAD4D2, #F2F0EF)" }} />
      <JoinCnCCTA />
    </>
  );
}
