/**
 * Advanced Export Panel Component
 *
 * Provides advanced export options using Netlify Functions:
 * - DSK disk image creation
 * - SNA snapshot creation
 * - Assembly code generation
 */

import { useState } from 'react'
import { pixsaurApi } from '@/libs/api-client'

export function AdvancedExportPanel() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreateDsk = async () => {
    setLoading(true)
    setError(null)

    try {
      // Get actual image data from Pixsaur state
      const imageData = '' // base64 encoded SCR file

      const result = await pixsaurApi.createDsk({
        files: [
          {
            name: 'IMAGE.SCR',
            data: imageData,
            type: 'binary',
            loadAddress: 0xc000
          }
        ],
        format: 'DATA',
        diskName: 'PIXSAUR'
      })

      if (result.success && result.data) {
        pixsaurApi.downloadFile(
          result.data,
          'pixsaur-image.dsk',
          'application/octet-stream'
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create DSK')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSna = async () => {
    setLoading(true)
    setError(null)

    try {
      // Get actual image data from Pixsaur state
      const imageData = '' // base64 encoded binary

      const result = await pixsaurApi.createSna({
        binary: imageData,
        loadAddress: 0xc000,
        startAddress: 0xc000,
        cpcType: '6128'
      })

      if (result.success && result.data) {
        pixsaurApi.downloadFile(
          result.data,
          'pixsaur-image.sna',
          'application/octet-stream'
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create SNA')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='advanced-export-panel'>
      <h3>Advanced Export</h3>

      {error && <div className='error-message'>{error}</div>}

      <div className='export-options'>
        <button
          type='button'
          onClick={handleCreateDsk}
          disabled={loading}
          className='export-button'
        >
          {loading ? 'Creating...' : 'Export as DSK'}
        </button>

        <button
          type='button'
          onClick={handleCreateSna}
          disabled={loading}
          className='export-button'
        >
          {loading ? 'Creating...' : 'Export as SNA'}
        </button>
      </div>

      <div className='info-section'>
        <p>
          <strong>DSK:</strong> Disk image for use with real Amstrad CPC or
          emulators
        </p>
        <p>
          <strong>SNA:</strong> Snapshot file for instant loading in emulators
        </p>
      </div>
    </div>
  )
}
