/**
 * Simple email validation utility
 */

/**
 * Validates an email address format
 * @param email - The email address to validate
 * @returns true if valid, false otherwise
 */
export const isValidEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Simple but effective email regex
  // Matches: user@domain.com, user.name@domain.co.uk, etc.
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return emailRegex.test(email.trim());
};

/**
 * Sanitizes email address by trimming and lowercasing
 * @param email - The email address to sanitize
 * @returns Sanitized email address
 */
export const sanitizeEmail = (email: string): string => {
  return email.trim().toLowerCase();
};
