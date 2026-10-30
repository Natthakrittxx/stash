import "~/styles/globals.css";

import { type Metadata } from "next";
import {
  Geist_Mono,
  IBM_Plex_Sans,
  IBM_Plex_Sans_Thai,
  Noto_Serif_Thai,
  Source_Serif_4,
} from "next/font/google";

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

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-ibm-plex-sans",
});
// Mono and Thai are below the fold or content-dependent, so they load when a
// glyph first needs them (unicode-range) rather than competing with the faces
// every page paints first.
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  preload: false,
});
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
});
const notoSerifThai = Noto_Serif_Thai({
  subsets: ["thai"],
  weight: ["400", "600"],
  variable: "--font-noto-serif-thai",
  preload: false,
});
// Plex Sans's own Thai, behind it as Noto Serif Thai sits behind the serif.
// Static face: 500 is the rail headings, 600 the section headings and toast actions.
const plexSansThai = IBM_Plex_Sans_Thai({
  subsets: ["thai"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-sans-thai",
  preload: false,
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
