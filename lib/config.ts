/**
 * App identity, defined once and used everywhere:
 * manifest, page titles, the app shell and (later) emails.
 */
export const APP_NAME = "Career Desk" as const;
export const APP_SHORT_NAME = "Career Desk" as const;
export const APP_DESCRIPTION =
  "A private workspace for your remote job search: track jobs, tailor applications from your verified career record, and build the skills that get you interviews." as const;
export const APP_VERSION = "0.1.0" as const;

/** Single accent colour for the whole app (PWA theme colour too). */
export const APP_THEME_COLOR = "#4f46e5" as const;
export const APP_BACKGROUND_COLOR = "#f7f7f5" as const;
