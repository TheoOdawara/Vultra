"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useActiveOrganization } from "@/lib/auth-client";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const qc = useQueryClient();
  const { data: activeOrg } = useActiveOrganization();

  // Invalidate all tenant-scoped queries when the active organization changes
  useEffect(() => {
    void qc.invalidateQueries();
  }, [activeOrg?.id, qc]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
