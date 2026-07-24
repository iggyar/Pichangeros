import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const str = timeStr.trim().toUpperCase();
  
  const isPM = str.includes("PM");
  const isAM = str.includes("AM");
  
  const cleanStr = str.replace(/(AM|PM)/gi, "").trim();
  const parts = cleanStr.split(":");
  let h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  
  if (isPM && h < 12) {
    h += 12;
  } else if (isAM && h === 12) {
    h = 0;
  }
  
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
  for (let current = startMins; current + 30 <= endMins; current += 30) {
    const slotStart = minutesToTime(current);
    const slotEnd = minutesToTime(current + 30);
    slots.push(`${slotStart} - ${slotEnd}`);
  }
  return slots;
}

export function generate30MinTimeOptions(): string[] {
  const options: string[] = [];
  for (let mins = 0; mins < 24 * 60; mins += 30) {
    options.push(minutesToTime(mins));
  }
  return options;
}

export function getSlotsInRange(startTime: string, endTime: string): string[] {
  const startMins = timeToMinutes(startTime);
  let endMins = timeToMinutes(endTime);
  if (endMins <= startMins) endMins += 24 * 60;

  const slots: string[] = [];
  for (let current = startMins; current + 30 <= endMins; current += 30) {
    const slotStart = minutesToTime(current);
    const slotEnd = minutesToTime(current + 30);
    slots.push(`${slotStart} - ${slotEnd}`);
  }
  return slots;
}

export function isSlotOverlappingBooking(slotStr: string, bookingTimeStr: string): boolean {
  if (!slotStr || !bookingTimeStr) return false;
  if (bookingTimeStr.includes(slotStr)) return true;

  const [sStartStr, sEndStr] = slotStr.split(" - ");
  if (!sStartStr || !sEndStr) return false;

  const sStart = timeToMinutes(sStartStr);
  let sEnd = timeToMinutes(sEndStr);
  if (sEnd <= sStart) sEnd += 24 * 60;

  // Check comma-separated items or single range
  const parts = bookingTimeStr.split(",");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed === slotStr) return true;

    if (trimmed.includes(" - ")) {
      const [bStartStr, bEndStr] = trimmed.split(" - ");
      if (bStartStr && bEndStr) {
        const bStart = timeToMinutes(bStartStr);
        let bEnd = timeToMinutes(bEndStr);
        if (bEnd <= bStart) bEnd += 24 * 60;

        if (sStart < bEnd && sEnd > bStart) {
          return true;
        }
      }
    }
  }

  return false;
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
