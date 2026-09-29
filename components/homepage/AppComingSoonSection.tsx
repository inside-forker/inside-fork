import type { ReactNode } from "react";
import Image from "next/image";
import { Bell, QrCode, Tag, WifiOff } from "lucide-react";

const appPerks = [
  { icon: WifiOff, text: "Your tickets saved on your phone, even offline" },
  { icon: Bell, text: "Push reminders before your events start" },
  { icon: Tag, text: "Deals and card offers wherever you are" },
  { icon: QrCode, text: "Scan QR codes to earn XP around the city" },
];

function AppleGlyph() {
  return (
    <svg viewBox="0 0 384 512" className="h-6 w-6" fill="currentColor" aria-hidden>
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 512 512" className="h-6 w-6" fill="currentColor" aria-hidden>
      <path d="M325.3 234.3 104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z" />
    </svg>
  );
}

function DisabledStoreBadge({
  glyph,
  kicker,
  store,
}: {
  glyph: ReactNode;
  kicker: string;
  store: string;
}) {
  return (
    <span
      role="link"
      aria-disabled="true"
      aria-label={`${store}: coming soon`}
      title="Coming soon"
      className="relative inline-flex cursor-not-allowed select-none items-center gap-3 rounded-xl border border-white/20 bg-black px-4 py-2.5 text-white opacity-60 grayscale"
    >
      {glyph}
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-wide text-white/70">
          {kicker}
        </span>
        <span className="text-base font-semibold">{store}</span>
      </span>
      <span className="absolute -right-2 -top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
        Soon
      </span>
    </span>
  );
}

export function AppComingSoonSection() {
  return (
    <section className="py-12 sm:py-16 md:py-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl bg-neutral-950 text-white">
          <div className="grid items-center gap-10 p-6 sm:p-10 lg:grid-cols-2 lg:p-14">
            <div>
              <span className="inline-flex items-center rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                Coming soon
              </span>
              <h2 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                Inside Karachi, in your pocket
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/70 sm:text-base">
                The Inside Karachi app for iPhone and Android is on its way.
                Everything on the site, plus a few things that work better on
                your phone.
              </p>

              <ul className="mt-6 space-y-3">
                {appPerks.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-3 text-sm sm:text-base">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                      <Icon className="h-4 w-4 text-primary" aria-hidden />
                    </span>
                    <span className="text-white/85">{text}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-wrap gap-4">
                <DisabledStoreBadge
                  glyph={<AppleGlyph />}
                  kicker="Download on the"
                  store="App Store"
                />
                <DisabledStoreBadge
                  glyph={<PlayGlyph />}
                  kicker="Get it on"
                  store="Google Play"
                />
              </div>
            </div>

            <div className="mx-auto flex w-full max-w-md justify-center gap-4">
              <Image
                src="/assets/app/01-explore-karachi.jpg"
                alt="Inside Karachi app home screen"
                width={640}
                height={1385}
                sizes="(min-width: 1024px) 220px, 45vw"
                className="w-1/2 rounded-2xl"
              />
              <Image
                src="/assets/app/04-events-tickets.jpg"
                alt="Inside Karachi app events and tickets screen"
                width={640}
                height={1385}
                sizes="(min-width: 1024px) 220px, 45vw"
                className="mt-10 w-1/2 rounded-2xl"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
