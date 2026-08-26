import type { Metadata } from "next";
import "./globals.css";
import { OfflineStatus } from "../components/OfflineStatus";
import { Sidebar } from "../components/Sidebar";

export const metadata: Metadata = {
  title: "WCHU Invoice Tracker",
  description: "Private invoice and receipt tracker for WCHU"
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
      </body>
    </html>
  );
}
