/**
 * Utility function to check if the application is running in development mode
 * 
 * @returns true if in development mode, false otherwise
 */
export function isDevelopment(): boolean {
  return import.meta.env.DEV
}