import type { BookingStatus, MoneyType } from "@/lib/api";

// Keys must match SLOTS / EVENT_TYPES / MONEY_CATEGORIES in google-apps-script/Code.gs.
export const TIME_SLOTS = [
  ["morning", "Morning (9 AM – 12 PM)"],
  ["afternoon", "Afternoon (12 PM – 4 PM)"],
  ["evening", "Evening (4 PM – 8 PM)"],
  ["night", "Night (8 PM – 12 AM)"],
  ["fullday", "Full day"],
] as const;

export const EVENT_TYPES = [
  ["wedding", "Wedding"],
  ["reception", "Reception"],
  ["birthday", "Birthday Party"],
  ["corporate", "Corporate Meet"],
  ["anniversary", "Anniversary"],
  ["other", "Other"],
] as const;

export const MONEY_CATEGORIES: Record<MoneyType, readonly string[]> = {
  income: ["Booking payment", "Catering commission", "Other income"],
  expense: ["Electricity (current) bill", "Cleaning bill", "Other expense"],
};

export const BOOKING_STATUS: Record<BookingStatus, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  confirmed: { label: "Confirmed", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  rejected: { label: "Rejected", cls: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
  cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground" },
};

const lookup = (options: readonly (readonly [string, string])[], value: string) =>
  options.find(([k]) => k === value)?.[1] ?? value;

export const slotLabel = (slot: string) => lookup(TIME_SLOTS, slot);
export const eventTypeLabel = (type: string) => lookup(EVENT_TYPES, type);
