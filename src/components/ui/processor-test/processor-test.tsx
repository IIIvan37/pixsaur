import { useImageProcessors } from '@/hooks/use-image-processors'
import { useEffect, useState } from 'react'

export function ProcessorTestComponent() {
  const { 
    imageProcessor, 
    paletteProcessor, 
    isInitialized, 
    isHardwareAccelerated 
  } = useImageProcessors()
  
  const [status, setStatus] = useState<string>('Initializing...')
  
  useEffect(() => {
    if (isInitialized) {
      setStatus(`Ready! Using ${isHardwareAccelerated ? 'GPU (WebGL)' : 'CPU'} acceleration`)
    } else {
      setStatus('Initializing processors...')
    }
  }, [isInitialized, isHardwareAccelerated])
  
  const testProcessors = async () => {
    if (!imageProcessor) return
    
    // Créer une image de test simple 2x2
    const testImageData = new ImageData(
      new Uint8ClampedArray([
        255, 0, 0, 255,    // Rouge
        0, 255, 0, 255,    // Vert
        0, 0, 255, 255,    // Bleu
        255, 255, 255, 255 // Blanc
      ]),
      2, 2
    )
    
    try {
      setStatus('Testing adjustments...')
      
      const result = await imageProcessor.applyAdjustments(testImageData, {
        rgb: { r: 1.0, g: 1.0, b: 1.0 },
        brightness: 1.2,
        contrast: 1.1,
        saturation: 1.0,
        posterization: 256
      })
      
      setStatus(`✅ Test completed! Result: ${result.width}x${result.height} image processed`)
      
      // Log du résultat pour debug
      console.log('Test result:', {
        original: Array.from(testImageData.data.slice(0, 16)),
        processed: Array.from(result.data.slice(0, 16))
      })
      
    } catch (error) {
      setStatus(`❌ Test failed: ${error}`)
      console.error('Processor test error:', error)
    }
  }
  
  return (
    <div style={{ 
      padding: '1rem', 
      border: '2px solid #ccc', 
      borderRadius: '8px',
      margin: '1rem',
      backgroundColor: isHardwareAccelerated ? '#e8f5e8' : '#fff8dc'
    }}>
      <h3>🔧 Image Processor Status</h3>
      <div style={{ marginBottom: '1rem' }}>
        <div><strong>Status:</strong> {status}</div>
        <div><strong>Image Processor:</strong> {imageProcessor?.isHardwareAccelerated ? 'WebGL (GPU)' : 'CPU'}</div>
        <div><strong>Palette Processor:</strong> {paletteProcessor?.isHardwareAccelerated ? 'WebGL (GPU)' : 'CPU'}</div>
        <div><strong>Initialized:</strong> {isInitialized ? '✅' : '⏳'}</div>
      </div>
      
      <button 
        type="button"
        onClick={testProcessors}
        disabled={!isInitialized}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: isInitialized ? '#4CAF50' : '#ccc',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: isInitialized ? 'pointer' : 'not-allowed'
        }}
      >
        🧪 Test Processors
      </button>
    </div>
  )
}