/**
 * Système de logging conditionnel pour Pixsaur
 * - En development: tous les logs sont activés
 * - En production: seuls les erreurs critiques sont loggées
 */

interface Logger {
  debug: (message: string, ...args: unknown[]) => void
  info: (message: string, ...args: unknown[]) => void
  warn: (message: string, ...args: unknown[]) => void
  error: (message: string, ...args: unknown[]) => void
}

const isDevelopment = import.meta.env.DEV
const isTest = import.meta.env.MODE === 'test'

/**
 * Logger conditionnel - les logs ne s'affichent qu'en développement
 * En production, seuls les erreurs critiques sont conservées
 */
export const logger: Logger = {
  debug: (message: string, ...args: unknown[]) => {
    if (isDevelopment && !isTest) {
      console.log(`🔧 ${message}`, ...args)
    }
  },
  
  info: (message: string, ...args: unknown[]) => {
    if (isDevelopment && !isTest) {
      console.log(`ℹ️ ${message}`, ...args)
    }
  },
  
  warn: (message: string, ...args: unknown[]) => {
    if (isDevelopment || !isTest) {
      console.warn(`⚠️ ${message}`, ...args)
    }
  },
  
  error: (message: string, ...args: unknown[]) => {
    // Les erreurs sont toujours loggées (développement ET production)
    console.error(`❌ ${message}`, ...args)
  },
}

/**
 * Logger de performance - uniquement en développement et si activé
 */
export const perfLogger = {
  time: (label: string) => {
    if (isDevelopment && !isTest) {
      console.time(`⏱️ ${label}`)
    }
  },
  
  timeEnd: (label: string) => {
    if (isDevelopment && !isTest) {
      console.timeEnd(`⏱️ ${label}`)
    }
  },
  
  mark: (message: string, data?: unknown) => {
    if (isDevelopment && !isTest) {
      console.log(`🎯 ${message}`, data ?? '')
    }
  },
}

/**
 * Logger spécialisé pour les adapters (très verbose, désactivé par défaut)
 * Changer cette valeur à true pour debugging approfondi uniquement
 */
const ENABLE_ADAPTER_LOGS = false

export const adapterLogger = {
  debug: (message: string, ...args: unknown[]) => {
    if (ENABLE_ADAPTER_LOGS && isDevelopment && !isTest) {
      console.log(`🔌 [ADAPTER] ${message}`, ...args)
    }
  },
  
  info: (message: string, ...args: unknown[]) => {
    if (ENABLE_ADAPTER_LOGS && isDevelopment && !isTest) {
      console.log(`🔌 ${message}`, ...args)
    }
  },
  
  warn: (message: string, ...args: unknown[]) => {
    if (isDevelopment && !isTest) {
      console.warn(`⚠️ [ADAPTER] ${message}`, ...args)
    }
  },
  
  error: (message: string, ...args: unknown[]) => {
    console.error(`❌ [ADAPTER] ${message}`, ...args)
  },
}

export default logger