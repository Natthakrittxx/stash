import "~/styles/globals.css";

import { type Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Noto_Serif_Thai,
  Source_Serif_4,
} from "next/font/google";

// Runs before first paint so a stored theme never flashes the OS default.
const noFlash = `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;}catch(e){}`;

const description =
  "A quiet, typographic place to save things and find them again.";

export const metadata: Metadata = {
  title: "Stash",
  description,
  icons: [
    { rel: "icon", url: "/favicon.ico", sizes: "48x48" },
    { rel: "icon", url: "/favicon.svg", type: "image/svg+xml" },
    { rel: "apple-touch-icon", url: "/stash-icon-1024.png" },
  ],
  openGraph: {
    title: "Stash",
    description,
    images: ["/preview.png"],
  },
};

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
});
const notoSerifThai = Noto_Serif_Thai({
  subsets: ["thai"],
  weight: ["400", "600"],
  variable: "--font-noto-serif-thai",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geist.variable} ${geistMono.variable} ${sourceSerif.variable} ${notoSerifThai.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlash }} />
      </head>
      <body className="bg-bg text-ink font-sans">{children}</body>
    </html>
  );
}
