import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Airco Talks — two-way voice translator",
  description:
    "Real-time two-way voice translator for Indian languages. Speak your language; the other person hears theirs.",
  icons: { icon: "/airco-talks-logo.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b1020",
};

/** Applies the saved theme before hydration so there is no light/dark flash. */
const themeInitScript = `(function(){try{var d=document.documentElement;var m=localStorage.getItem("airco-talks.mode");if(m!=="light"&&m!=="dark"){m=window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";}d.dataset.mode=m;var a=localStorage.getItem("airco-talks.accent");if(["royal","indigo","emerald","violet","saffron"].indexOf(a)===-1){a="royal";}d.dataset.accent=a;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
