import type { Metadata } from "next";
import "./globals.css";
import { OfflineStatus } from "../components/OfflineStatus";
import { PwaRegister } from "../components/PwaRegister";
import { Sidebar } from "../components/Sidebar";

export const metadata: Metadata = {
  title: "WZXU Invoice Tracker",
  description: "Private invoice and receipt tracker for WZXU",
  applicationName: "WZXU Invoice Tracker",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/wzxu-icon.svg",
    apple: "/icons/wzxu-icon.svg"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="page-shell">
          <Sidebar />
          <main className="main-content">{children}</main>
        </div>
        <OfflineStatus />
        <PwaRegister />
      </body>
    </html>
  );
}
