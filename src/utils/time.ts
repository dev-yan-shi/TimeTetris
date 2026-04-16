// Convert slot number (0-47) to display time "HH:MM"
export function slotToTime(slot: number): string {
  const hours = Math.floor(slot / 2);
  const minutes = (slot % 2) * 30;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Convert "HH:MM" to slot number (0-47)
export function timeToSlot(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 2 + (minutes >= 30 ? 1 : 0);
}

// Get current slot based on current time
export function getCurrentSlot(): number {
  const now = new Date();
  return now.getHours() * 2 + (now.getMinutes() >= 30 ? 1 : 0);
}

// Format today's date as "YYYY-MM-DD"
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Format date for display "Mon, Apr 14"
export function formatDateDisplay(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// Get duration text from slot count
export function slotsToDuration(slots: number): string {
  const hours = Math.floor(slots / 2);
  const minutes = (slots % 2) * 30;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

// Get current time as "HH:MM"
export function getCurrentTime(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}
