"use client"

import dynamic from "next/dynamic"

// These dashboard widgets include DnD + Radix primitives and can generate IDs that differ
// between SSR and the first client render in dev, producing hydration warnings.
// Rendering them client-only avoids SSR/client attribute mismatches.
const DataTable = dynamic(
  () => import("@/components/data-table").then((m) => m.DataTable),
  {
    ssr: false,
    loading: () => (
      <div className="text-muted-foreground px-4 py-6 lg:px-6">
        Loading table...
      </div>
    ),
  }
)

export function DashboardWidgets({ data }: { data: unknown }) {
  return <DataTable data={data as never} />
}


