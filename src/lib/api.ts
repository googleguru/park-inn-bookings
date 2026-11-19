/**
 * Client for the Google Apps Script backend (google-apps-script/Code.gs).
 * The web-app URL comes from VITE_BOOKING_API_URL at build time.
 */

export const API_URL = (import.meta.env.VITE_BOOKING_API_URL ?? "").trim();
export const isApiConfigured = API_URL.length > 0;

export class ApiError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
  }
}

/** Errors that mean the stored session can no longer be used. */
export const SESSION_ENDED_CODES = ["AUTH", "SUPERSEDED", "IDLE"];

export async function callApi<T>(
  url: string,
  action: string,
  payload: Record<string, unknown> = {},
  token?: string | null,
): Promise<T> {
  let res: Response;
  try {
    // text/plain keeps this a "simple" request: Apps Script can't answer CORS preflights.
    res = await fetch(url, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...payload, action, ...(token ? { token } : {}) }),
    });
  } catch {
    throw new ApiError("Could not reach the booking system. Please check your internet connection.", "NETWORK");
  }
  let body: { ok: boolean; data?: T; error?: string; code?: string };
  try {
    body = await res.json();
  } catch {
    throw new ApiError("The booking system sent an unexpected reply. Please try again.", "SERVER");
  }
  if (!body.ok) throw new ApiError(body.error ?? "Something went wrong.", body.code ?? "SERVER");
  return body.data as T;
}

export function api<T>(action: string, payload: Record<string, unknown> = {}, token?: string | null) {
  if (!isApiConfigured) {
    return Promise.reject(new ApiError("Online booking is not set up yet.", "NOT_CONFIGURED"));
  }
  return callApi<T>(API_URL, action, payload, token);
}

/* ---------- Shapes returned by the backend ---------- */

export type BookingStatus = "pending" | "confirmed" | "rejected" | "cancelled";
export type AccessStatus = "none" | "pending" | "approved" | "rejected" | "blocked";
export type AdminRole = "super_admin" | "admin";
export type MoneyType = "income" | "expense";

export interface SystemStatus {
  version: number;
  configured: boolean;
  bookingEnabled: boolean;
  venueName: string;
}

export interface CustomerProfile {
  email: string;
  name: string;
  mobile: string;
  access: AccessStatus;
}

export interface CustomerBooking {
  id: string;
  date: string;
  slot: string;
  eventType: string;
  guests: number | "";
  name: string;
  mobile: string;
  notes: string;
  status: BookingStatus;
  createdAt: string;
}

export interface Booking extends CustomerBooking {
  email: string;
  locked: boolean;
  lockedBy: string;
  amount: number | "";
  adminNote: string;
  eventId: string;
  updatedAt: string;
  updatedBy: string;
  source: string;
}

export interface Customer {
  email: string;
  name: string;
  mobile: string;
  status: Exclude<AccessStatus, "none">;
  requestedAt: string;
  decidedBy: string;
  decidedAt: string;
  note: string;
}

export interface MoneyEntry {
  id: string;
  date: string;
  type: MoneyType;
  category: string;
  amount: number;
  bookingId: string;
  description: string;
  recordedBy: string;
  recordedAt: string;
}

export interface AdminAccount {
  email: string;
  role: AdminRole;
  addedBy: string;
  addedAt: string;
}

export interface ActivityEntry {
  time: string;
  who: string;
  action: string;
  details: string;
}

export interface AdminData {
  me: { email: string; role: AdminRole };
  automation?: { calendarScheduled: boolean; reportsScheduled: boolean; lastSync: string; lastReport: string; reportsFolder: string };
  settings: { venueName: string; bookingEnabled: boolean; notifyEmail: string; ownerEmail: string };
  links: { sheet: string; calendar: string };
  bookings: Booking[];
  customers: Customer[];
  money: MoneyEntry[];
  admins: AdminAccount[];
  activity: ActivityEntry[];
}
