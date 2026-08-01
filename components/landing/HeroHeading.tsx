/** Props for the staggered landing hero heading. */
export interface HeroHeadingProps {
  /** First white line. */
  lineOne: string;
  /** Second white line. */
  lineTwo: string;
  /** Gradient line rendered larger, after a delay. */
  gradientLine: string;
  /** Delay in ms before the gradient line fades in. */
  gradientDelayMs?: number;
}

/** "Your content / Just got a / MANAGER" with the sequenced fade-in. */
export function HeroHeading({ lineOne, lineTwo, gradientLine, gradientDelayMs = 1000 }: HeroHeadingProps) {
  return (
    <h1 className="flex flex-col items-center leading-[0.95]">
      <span className="cm-rise text-[13vw] font-extrabold tracking-tight md:text-[76px]" style={{ animationDelay: "0ms" }}>
        {lineOne}
      </span>
      <span className="cm-rise text-[13vw] font-extrabold tracking-tight md:text-[76px]" style={{ animationDelay: "0ms" }}>
        {lineTwo}
      </span>
      <span
        className="ig-gradient-text cm-rise mt-6 text-[16vw] font-extrabold uppercase tracking-tight md:mt-8 md:text-[96px]"
        style={{ animationDelay: `${gradientDelayMs}ms` }}
      >
        {gradientLine}
      </span>
    </h1>
  );
}
