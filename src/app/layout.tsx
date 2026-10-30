import "~/styles/globals.css";

import { type Metadata } from "next";
import localFont from "next/font/local";

// Runs before first paint so a stored theme never flashes the OS default. It
// also records whether the viewport is desktop-wide, so the next /stash render
// on the server picks the right layout instead of painting the narrow one and
// swapping after hydration (stash/page.tsx reads it).
const noFlash = `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;}catch(e){}document.cookie='wide='+(matchMedia('(min-width: 64rem)').matches?1:0)+';path=/;max-age=31536000;samesite=lax';`;

const description =
  "A quiet, typographic place to save things and find them again.";

export const metadata: Metadata = {
  title: { default: "Stash", template: "%s · Stash" },
  description,
  icons: [
    // ponytail: SVG-only favicon; add a generated .ico if pre-16.4 Safari matters.
    { rel: "icon", url: "/favicon.svg", type: "image/svg+xml" },
    { rel: "apple-touch-icon", url: "/stash-icon-1024.png" },
  ],
  openGraph: {
    title: "Stash",
    description,
    images: ["/preview.png"],
  },
};

// Fonts live in the repo (src/fonts, from Fontsource, each with its OFL license)
// so a build never depends on Google Fonts. next/font/local only takes literals,
// which is why the ranges repeat.
const plexSans = localFont({
  src: "../fonts/ibm-plex-sans-latin-wght-normal.woff2",
  weight: "100 700",
  variable: "--font-ibm-plex-sans",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
    },
  ],
});
// Mono and Thai are below the fold or content-dependent, so they load when a
// glyph first needs them (unicode-range) rather than competing with the faces
// every page paints first.
const geistMono = localFont({
  src: "../fonts/geist-mono-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-geist-mono",
  preload: false,
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
    },
  ],
});
const sourceSerif = localFont({
  src: "../fonts/source-serif-4-latin-wght-normal.woff2",
  weight: "200 900",
  variable: "--font-source-serif",
  adjustFontFallback: "Times New Roman",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
    },
  ],
});
const notoSerifThai = localFont({
  src: [
    { path: "../fonts/noto-serif-thai-thai-400-normal.woff2", weight: "400" },
    { path: "../fonts/noto-serif-thai-thai-600-normal.woff2", weight: "600" },
  ],
  variable: "--font-noto-serif-thai",
  preload: false,
  adjustFontFallback: "Times New Roman",
  declarations: [
    {
      prop: "unicode-range",
      value: "U+02D7,U+0303,U+0331,U+0E01-0E5B,U+200C-200D,U+25CC",
    },
  ],
});
// Plex Sans's own Thai, behind it as Noto Serif Thai sits behind the serif.
// Static face: 500 is the rail headings, 600 the section headings and toast actions.
const plexSansThai = localFont({
  src: [
    {
      path: "../fonts/ibm-plex-sans-thai-thai-400-normal.woff2",
      weight: "400",
    },
    {
      path: "../fonts/ibm-plex-sans-thai-thai-500-normal.woff2",
      weight: "500",
    },
    {
      path: "../fonts/ibm-plex-sans-thai-thai-600-normal.woff2",
      weight: "600",
    },
  ],
  variable: "--font-ibm-plex-sans-thai",
  preload: false,
  declarations: [
    {
      prop: "unicode-range",
      value: "U+02D7,U+0303,U+0331,U+0E01-0E5B,U+200C-200D,U+25CC",
    },
  ],
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plexSans.variable} ${geistMono.variable} ${sourceSerif.variable} ${notoSerifThai.variable} ${plexSansThai.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlash }} />
      </head>
      <body className="bg-bg text-ink font-sans antialiased">{children}</body>
    </html>
  );
}
