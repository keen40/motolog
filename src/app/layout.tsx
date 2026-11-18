import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/Header";
import { getI18n } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n/client";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin", "latin-ext"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MotoLog",
  description: "Track every service, modification and plan for your motorcycle.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { lang, t } = await getI18n();
  return (
    <html lang={lang} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <I18nProvider value={{ lang, t }}>
          <Header />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        </I18nProvider>
      </body>
    </html>
  );
}
