import Link from "next/link";
import { Container, Section } from "@/components/ds";

/** The closing strip for businesses. */
export function LandingGetListed() {
  return (
    <Section size="sm" className="py-10 md:py-14">
      <Container className="flex flex-col items-start gap-4 lg:flex-row lg:items-center lg:gap-5">
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
      </Container>
    </Section>
  );
}
