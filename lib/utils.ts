import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format time for display (HH:mm to 12-hour format)
 * @param time - Time string in HH:mm format
 * @returns Formatted time string (e.g., "9:00 am", "2:30 pm")
 */
export function formatTimeForDisplay(time: string): string {
  if (!time) return "Select time"
  const [hours, minutes] = time.split(":")
  const hour = parseInt(hours, 10)
  const ampm = hour >= 12 ? "pm" : "am"
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes} ${ampm}`
}

/**
 * Get initials from first name, last name, and email
 */
export function getUserInitials(firstName?: string | null, lastName?: string | null, email?: string | null): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase()
  }
  if (firstName && firstName.length > 0) {
    return firstName.substring(0, Math.min(firstName.length, 2)).toUpperCase()
  }
  if (lastName && lastName.length > 0) {
    return lastName.substring(0, Math.min(lastName.length, 2)).toUpperCase()
  }
  if (email && email.length > 0) {
    return email.substring(0, Math.min(email.length, 2)).toUpperCase()
  }
  return "??"
}

/**
 * Get initials from a full name and email
 */
export function getInitialsFromName(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    if (name.length > 0) {
      return name.substring(0, Math.min(name.length, 2)).toUpperCase()
    }
  }
  if (email && email.length > 0) {
    return email.substring(0, Math.min(email.length, 2)).toUpperCase()
  }
  return "??"
}
