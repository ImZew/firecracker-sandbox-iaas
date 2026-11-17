import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context";
import { BrutalistNavbar } from "@/components/navbar";

export const metadata: Metadata = {
  title: "AURORA // FIRECRACKER MICROVM CONTROL PLANE",
  description:
    "Ephemeral Code Execution IaaS — Multi-tenant Serverless Sandbox Platform (DynamoDB Single-Table + Redis Cache-Aside + Python 3.11)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F4F4F0] text-black flex flex-col">
        <AuthProvider>
          <BrutalistNavbar />
          <main className="flex-1">{children}</main>
          <footer className="border-t-2 border-black bg-white px-6 py-4 text-xs font-mono uppercase tracking-wider flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              AURORA IAAS // FIRECRACKER MICROVM CONTROL PLANE // PYTHON 3.11 + LOCALSTACK 4.14 + REDIS 7
            </div>
            <div className="flex items-center gap-4">
              <span>SINGLE-TABLE: EPHEMERALSANDBOXTABLE</span>
              <span>AUTH: JWT HS256</span>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
