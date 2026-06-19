"use client";

import { PostHogProvider } from "@/lib/observability/posthog";
import { TRPCProvider } from "@/lib/trpc/provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TRPCProvider>
      <PostHogProvider>{children}</PostHogProvider>
    </TRPCProvider>
  );
}
