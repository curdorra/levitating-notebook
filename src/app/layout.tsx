import type { Metadata, Viewport } from "next";
import { getCurrentUser } from "@/lib/session";
import { Ambience } from "@/components/Ambience";
import { ScrollCalm } from "@/components/ScrollCalm";
import { resolveTheme } from "@/lib/themes";
import { VaultProvider } from "@/components/Vault";
import { fontVariables } from "./fonts";
import "./globals.css";
import "./themes.css";

export const metadata: Metadata = {
  title: { default: "Levitating Notebook", template: "%s · Levitating Notebook" },
  description: "A private notebook that floats. Three themes: Linen, Specimen and Reverie.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="en" data-theme={resolveTheme(user?.theme)} className={fontVariables} data-scroll-behavior="smooth">
      <body>
        <Ambience />
        <ScrollCalm />
        <div className="app">
          {user ? (
            <VaultProvider username={user.username} encVersion={user.encVersion} wrappedKey={user.wrappedKey}>
              {children}
            </VaultProvider>
          ) : (
            children
          )}
        </div>
      </body>
    </html>
  );
}
