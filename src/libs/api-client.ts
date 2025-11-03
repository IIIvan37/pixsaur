/**
 * Client API for Pixsaur Netlify Functions
 *
 * Usage:
 * ```ts
 * import { pixsaurApi } from '@/libs/api-client';
 *
 * const result = await pixsaurApi.assemble("ORG &4000\nLD A,1\nRET");
 * ```
 */

import type {
  ApiError,
  AssembleRequest,
  AssembleResponse,
  CreateDskRequest,
  CreateDskResponse,
  CreateSnaRequest,
  CreateSnaResponse
} from '../../netlify/types'

const API_BASE = import.meta.env.PROD
  ? '/.netlify/functions'
  : 'http://localhost:8888/.netlify/functions'

class PixsaurApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    })

    if (!response.ok) {
      const error: ApiError = await response.json()
      throw new Error(error.error || 'API request failed')
    }

    return response.json()
  }

  /**
   * Check API health
   */
  async health(): Promise<{ message: string; timestamp: string }> {
    return this.request('/health')
  }

  /**
   * Assemble Z80 code using RASM
   */
  async assemble(request: AssembleRequest): Promise<AssembleResponse> {
    return this.request('/assemble', {
      method: 'POST',
      body: JSON.stringify(request)
    })
  }

  /**
   * Create a DSK disk image
   */
  async createDsk(request: CreateDskRequest): Promise<CreateDskResponse> {
    return this.request('/create-dsk', {
      method: 'POST',
      body: JSON.stringify(request)
    })
  }

  /**
   * Create a SNA snapshot
   */
  async createSna(request: CreateSnaRequest): Promise<CreateSnaResponse> {
    return this.request('/create-sna', {
      method: 'POST',
      body: JSON.stringify(request)
    })
  }

  /**
   * Helper: Convert Uint8Array to Base64
   */
  arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = ''
    for (const byte of buffer) {
      binary += String.fromCodePoint(byte)
    }
    return btoa(binary)
  }

  /**
   * Helper: Convert Base64 to Uint8Array
   */
  base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.codePointAt(i) ?? 0
    }
    return bytes
  }

  /**
   * Helper: Download a file from base64 data
   */
  downloadFile(base64Data: string, filename: string, mimeType: string) {
    const bytes = this.base64ToArrayBuffer(base64Data)
    // @ts-expect-error - Blob constructor accepts Uint8Array
    const blob = new Blob([bytes], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }
}

export const pixsaurApi = new PixsaurApiClient()
