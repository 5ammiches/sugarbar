import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ConvexReactClient,
  ConvexProvider as ConvexReactProvider,
} from "convex/react";
import { ReactNode } from "react";

const convexUrl =
  (typeof process !== "undefined" && process.env?.VITE_CONVEX_URL) ||
  import.meta.env.VITE_CONVEX_URL;

if (!convexUrl || !/^https?:\/\//.test(convexUrl)) {
  throw new Error("VITE_CONVEX_URL must be an absolute URL");
}

const convex = new ConvexReactClient(convexUrl);
const convexQueryClient = new ConvexQueryClient(convex);
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryKeyHashFn: convexQueryClient.hashFn(),
      queryFn: convexQueryClient.queryFn(),
    },
  },
});
convexQueryClient.connect(queryClient);

interface ConvexProviderProps {
  children: ReactNode;
}

export function ConvexProvider({ children }: ConvexProviderProps) {
  return (
    <ConvexReactProvider client={convex}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ConvexReactProvider>
  );
}
