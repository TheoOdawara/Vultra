import type { Metadata } from "next";
import { ThemeProvider } from "@/shared/ui/theme-provider";
import { ThemeScript } from "@/shared/ui/theme-script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vultra",
  description: "Chamada por reconhecimento facial",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
