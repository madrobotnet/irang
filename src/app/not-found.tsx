import { StatusScreen } from "@/components/shell/StatusScreen";

/** Unmatched URLs and notFound() calls without a closer not-found.tsx. Next sends the 404 status. */
export default function NotFound() {
  return <StatusScreen kind="notFound" />;
}
