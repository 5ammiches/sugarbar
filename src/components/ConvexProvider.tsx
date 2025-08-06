import { ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const convexUrl = import.meta.env.VITE_CONVEX_URL;
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
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
} 