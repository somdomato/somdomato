export function getDate18YearsAgo() {
  const currentDate = new Date();
  currentDate.setFullYear(currentDate.getFullYear() - 18);

  // Format the date to YYYY-MM-DD
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
  const day = String(currentDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}