import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Treat data as fresh for 30s: going back to a page shows it instantly, no refetch
      staleTime: 30_000,
      // Retry network blips and 5xx once; never retry 4xx (404, 401, 422 won't fix themselves)
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status < 500) && failureCount < 1,
    },
  },
});
