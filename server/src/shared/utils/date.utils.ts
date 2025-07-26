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

export const formatDateForLabel = (date: string): string => {
  const d = date.split('-');
  if (d.length !== 3) {
    throw new Error('Invalid date format. Expected format: YYYY-MM-DD');
  }
  const year = d[0];
  const month = d[1];
  const day = d[2];

  return `${day}/${month}/${year}`;
};
