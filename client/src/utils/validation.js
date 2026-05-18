export const sanitizeMobile = (val) => val.replace(/\D/g, '').slice(0, 10);
export const sanitizeName = (val) => val.replace(/[^a-zA-Z\s\.\-]/g, '');

export const validateMobile = (mobile, fieldName) => {
  if (!mobile) return true;
  if (!/^\d{10}$/.test(mobile)) {
    window.alert(`${fieldName} must contain exactly 10 digits.`);
    return false;
  }
  return true;
};

export const validateProjectText = (text, fieldName) => {
  if (!text) return true;
  const allowedPattern = /^[A-Za-z0-9\s\-\/\,\.\(\)\&]*$/;
  if (!allowedPattern.test(text)) {
    window.alert(`Validation Error: Special characters like @, #, $, % are not allowed in "${fieldName}".\n\nAllowed: A-Z, 0-9, Space, Hyphen(-), Slash(/), Comma(,), Period(.), Parentheses(), and Ampersand(&).`);
    return false;
  }
  return true;
};

export const sanitizeProjectInput = (val) => {
  return val.replace(/[^A-Za-z0-9\s\-\/\,\.\(\)\&]/g, '');
};

export const blockInvalidNumberKeys = (e) => {
  if (['e', 'E', '+', '-'].includes(e.key)) {
    e.preventDefault();
  }
};

export const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = error => reject(error);
});
