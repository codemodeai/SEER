import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import TerminalDemo from "@/components/TerminalDemo";
import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
import Surfaces from "@/components/Surfaces";
import Pricing from "@/components/Pricing";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <TerminalDemo />
        <Features />
        <HowItWorks />
        <Surfaces />
        <Pricing />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
