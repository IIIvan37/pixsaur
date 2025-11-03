/**
 * Shared types for Netlify Functions API
 */

export interface AssembleRequest {
  code: string
  options?: {
    org?: number
    output?: 'binary' | 'symbols' | 'both'
  }
}

export interface AssembleResponse {
  success: boolean
  message?: string
  binary?: string // Base64 encoded
  symbols?: Record<string, number>
  errors?: string[]
}

export interface DskFile {
  name: string // 8.3 format (e.g., "IMAGE.SCR")
  data: string // Base64 encoded
  type: 'binary' | 'ascii' | 'basic'
  loadAddress?: number
  entryAddress?: number
}

export interface CreateDskRequest {
  files: DskFile[]
  format?: 'DATA' | 'EXTENDED'
  diskName?: string
}

export interface CreateDskResponse {
  success: boolean
  message?: string
  data?: string // Base64 encoded DSK file
}

export interface CreateSnaRequest {
  binary: string // Base64 encoded binary
  loadAddress?: number // Default: 0x4000
  startAddress?: number // Default: same as loadAddress
  cpcType?: '464' | '664' | '6128' // Default: "6128"
}

export interface CreateSnaResponse {
  success: boolean
  message?: string
  data?: string // Base64 encoded SNA file
  loadAddress?: number
  startAddress?: number
}

export interface ApiError {
  error: string
  details?: string
}
