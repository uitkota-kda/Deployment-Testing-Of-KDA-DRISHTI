export const formatDate = (date) => {
  if (!date) return 'PENDING';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'PENDING';
  return d.toLocaleDateString('en-GB');
};

export const formatDateForInput = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split('T')[0];
};

export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '0.00';
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(amount);
};
export const normalizeDate = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
};
