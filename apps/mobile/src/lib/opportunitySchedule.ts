export function dateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function timeInput(value: Date) {
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

export function parseEventDateTime(date: string, time: string) {
  const dateParts = date.split("-").map(Number);
  const timeParts = time.split(":").map(Number);
  if (dateParts.length !== 3 || timeParts.length !== 2) return null;
  const [year, month, day] = dateParts;
  const [hour, minute] = timeParts;
  if (![year, month, day, hour, minute].every(Number.isInteger)) return null;
  const result = new Date(year!, month! - 1, day!, hour!, minute!);
  if (
    result.getFullYear() !== year || result.getMonth() !== month! - 1 || result.getDate() !== day ||
    result.getHours() !== hour || result.getMinutes() !== minute
  ) return null;
  return result;
}

export function scheduleError(date: string, startTime: string, endTime: string, requireFuture = true, now = new Date()) {
  const starts = parseEventDateTime(date, startTime);
  const ends = parseEventDateTime(date, endTime);
  if (!starts || !ends) return "Enter a valid event date and time.";
  if (ends <= starts) return "End time must be after the start time.";
  if (requireFuture && starts <= now) return "Choose a start time in the future.";
  return null;
}
