import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CursorGrid } from "@/components/CursorGrid";
import "./globals.css";

export const metadata: Metadata = {
  title: "RealDoor — Housing paperwork, made clear",
  description: "A calm application-readiness assistant for affordable housing paperwork.",
  icons: { icon: "/logo.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CursorGrid />
        {children}
      </body>
    </html>
  );
}
