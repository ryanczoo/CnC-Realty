import { FAQ } from "@/components/home/FAQ";
import { GradientBridge } from "@/components/ui/GradientBridge";
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
      <GradientBridge from="#F2F0EF" to="#DAD4D2" />
      <FAQ className="bg-[#DAD4D2]" />
      <GradientBridge from="#DAD4D2" to="#F2F0EF" />
      <JoinCnCCTA />
    </>
  );
}
