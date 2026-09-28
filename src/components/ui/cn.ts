import { clsx, type ClassValue } from "clsx";

/** Class-name joiner shared by every primitive (clsx re-export). */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
