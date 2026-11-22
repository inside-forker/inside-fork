import Link from "next/link";
import { Container, Section } from "@/components/ds";

/**
 * The strip for businesses. It follows the area map on white, so a hairline
 * opens it instead of a band of its own.
 */
export function LandingGetListed() {
  return (
    <Section size="sm" className="pt-0 md:pt-0">
      <Container>
        <div className="flex flex-col items-start gap-4 border-t border-border pt-10 md:pt-14 lg:flex-row lg:items-center lg:gap-5">
          <p className="flex-1 text-[19px] font-bold leading-7 tracking-[-0.02em] lg:text-[22px] lg:leading-[30px]">
            Run a place in Karachi?{" "}
            <span className="font-normal">Get it in front of people deciding where to go.</span>
          </p>
          <Link
            href="/get-listed"
            className="inline-flex h-[52px] shrink-0 items-center rounded-full bg-primary px-[26px] text-body font-semibold text-primary-foreground transition-opacity duration-fast hover:opacity-90"
          >
            Get listed
          </Link>
        </div>
      </Container>
    </Section>
  );
}
