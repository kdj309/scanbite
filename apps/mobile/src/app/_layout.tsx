import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { queryClient } from "@/query/query-client";
import { SessionProvider } from "@/session/session-provider";

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <Stack />
      </SessionProvider>
    </QueryClientProvider>
  );
}
