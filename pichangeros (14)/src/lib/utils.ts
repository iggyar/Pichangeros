import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

export function minutesToTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function generateTimeSlots(openTime?: string, closeTime?: string): string[] {
  const open = openTime || "08:00";
  const close = closeTime || "22:00";
  
  const startMins = timeToMinutes(open);
  let endMins = timeToMinutes(close);

  if (endMins <= startMins) {
    endMins += 24 * 60;
  }

  const slots: string[] = [];
  for (let current = startMins; current + 60 <= endMins; current += 60) {
    const slotStart = minutesToTime(current);
    const slotEnd = minutesToTime(current + 60);
    slots.push(`${slotStart} - ${slotEnd}`);
  }
  return slots;
}

export function formatTime12h(time24: string): string {
  if (!time24 || !time24.includes(":")) return time24;
  const parts = time24.trim().split(":");
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) || 0;
  if (isNaN(h)) return time24;
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  const minutesFormatted = m.toString().padStart(2, "0");
  return `${h}:${minutesFormatted} ${ampm}`;
}

export function formatSlot12h(slot: string): string {
  if (!slot) return "";
  if (!slot.includes(" - ")) return formatTime12h(slot);
  const [start, end] = slot.split(" - ");
  return `${formatTime12h(start)} - ${formatTime12h(end)}`;
}
