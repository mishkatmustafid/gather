import { useEffect } from "react";

/** Sets the browser tab title, e.g. "Board games night · Gather". */
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · Gather` : "Gather";
  }, [title]);
}
