/**
 * Generiert eine eindeutige ID
 * Verwendet zwei random strings für mehr Eindeutigkeit
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
