export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface DaySchedule {
  /** Is this day open for business? */
  enabled: boolean;
  /** Opening time in 24h format "HH:mm" */
  start: string;
  /** Closing time in 24h format "HH:mm" */
  end: string;
}

export interface BusinessHoursConfig {
  /**
   * When false, system.isBusinessHours is always true (no restriction).
   * Allows admins to configure hours without enforcing them yet.
   */
  enabled: boolean;
  /** IANA timezone string, e.g. "America/Argentina/Buenos_Aires" */
  timezone: string;
  schedule: Record<DayOfWeek, DaySchedule>;
  /** Injected as system.outOfHoursMessage in flow variables */
  outOfHoursMessage?: string;
  /** Injected as system.bookingUrl in flow variables */
  bookingUrl?: string;
  updatedAt: string;
}
