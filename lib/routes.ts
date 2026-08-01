/** Central route map — mirrors Next.js App Router folder structure. */
export const ROUTES = {
  home: "/",
  login: "/login",
  contact: "/contact",
  studio: "/studio",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

/** Links rendered inside the slide-in site menu. */
export const MENU_LINKS: ReadonlyArray<{ label: string; to: AppRoute }> = [
  { label: "Login / Signup", to: ROUTES.login },
  { label: "Contact Admin", to: ROUTES.contact },
  { label: "Studio", to: ROUTES.studio },
];
