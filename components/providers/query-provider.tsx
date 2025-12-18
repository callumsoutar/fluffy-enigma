"use client"

import * as React from "react"
import {
  QueryClient,
  QueryClientProvider,
  type DefaultOptions,
} from "@tanstack/react-query"

const defaultOptions: DefaultOptions = {
  queries: {
    // Avoid refetching just because the tab regains focus
    refetchOnWindowFocus: false,
    // Avoid refetch loops due to reconnects during dev
    refetchOnReconnect: false,
    retry: 1,
  },
}

function makeQueryClient() {
  return new QueryClient({ defaultOptions })
}

let browserQueryClient: QueryClient | undefined

function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient()
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient()
  }
  return browserQueryClient
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
