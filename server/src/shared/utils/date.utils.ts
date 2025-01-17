export const formatDate = (date: Date | string): string => {
  const d = new Date(date);

  // Get year, month, and day
  const year = d.getFullYear();
  // Add 1 to month since getMonth() returns 0-11
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  // Return formatted date string
  return `${year}-${month}-${day}`;
};
