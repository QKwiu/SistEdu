import { useQuery } from "@tanstack/react-query";
import { healthCheck, getHealthCheckQueryKey } from "@workspace/api-client-react";

// Wrap the generated hook to provide a consistent interface or add extra frontend logic if needed.
// The generated useHealthCheck hook from @workspace/api-client-react can also be used directly.
export function useAppHealth() {
  return useQuery({
    queryKey: getHealthCheckQueryKey(),
    queryFn: async ({ signal }) => {
      // Use the generated fetcher
      return healthCheck({ signal });
    },
  });
}
