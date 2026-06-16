import { FloatingNav } from "@/components/ui/floating-nav";
import { Hero } from "@/components/landing/hero";
import { BlockTeaser } from "@/components/landing/block-teaser";
import { HowItWorks } from "@/components/landing/how-it-works";
import { DeepbookBeat } from "@/components/landing/deepbook-beat";
import { SecurityTrust } from "@/components/landing/security-trust";
import { WalrusReceipts } from "@/components/landing/walrus-receipts";
import { WhySui } from "@/components/landing/why-sui";
import { Cta } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";

/**
 * Landing root route — /
 * Page-wide pastel wash (3 fixed radial gradients): sky-blue dominant,
 * orange + lime accents, very subtle. Sections compose in narrative order
 * under the floating pill nav. Each section component owns its own
 * <section id="..."> landmark — page.tsx uses plain divs as structural
 * groupings to avoid duplicate landmark IDs.
 */
export default function LandingPage() {
  return (
    <div className="relative w-full overflow-x-hidden">
      {/* Page-wide pastel wash — fixed behind everything, low opacity.
          In dark mode: reduced opacity via data-pastel-wash CSS rule so the
          warm colour blobs don't create jarring bright patches on the dark canvas. */}
      <div
        aria-hidden
        data-pastel-wash
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(62% 52% at 16% -6%, hsl(205 96% 72% / 0.26), transparent 62%)," +
            "radial-gradient(42% 38% at 95% 2%, hsl(28 96% 66% / 0.15), transparent 58%)," +
            "radial-gradient(50% 44% at 50% 112%, hsl(150 62% 66% / 0.14), transparent 60%)",
        }}
      />

      <FloatingNav />

      <main id="main-content">
        {/* Hero owns no section id — home anchor lives here for nav scroll */}
        <div id="home">
          <Hero />
        </div>
        {/* Each component below declares its own <section id="..."> */}
        <BlockTeaser />
        <HowItWorks />
        <DeepbookBeat />
        <SecurityTrust />
        <WalrusReceipts />
        <WhySui />
        <Cta />
      </main>

      <Footer />
    </div>
  );
}
