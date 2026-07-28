import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "e8n8 Survey — Food & Fitness Research",
  description: "Help us understand how people approach food and fitness goals",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
