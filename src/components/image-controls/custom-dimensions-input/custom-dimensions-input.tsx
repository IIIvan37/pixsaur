import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  customDimensionsAtom,
  pixelModeAtom,
  setCustomDimensionsAtom
} from '@/app/store/config/config'
import type { CustomDimensions } from '@/app/store/config/types'
import { getPixelsPerByte, getWidthStepForMode } from '@/utils/cpc-calculations'
import { validateCustomDimensions } from '@/utils/validate-custom-dimensions'
import { CustomDimensionsInputView } from './custom-dimensions-input-view'

// Debounce hook with ref
function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  return useCallback(
    ((...args: any[]) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args)
      }, delay)
    }) as T,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
}

export function CustomDimensionsInput() {
  const pixelMode = useAtomValue(pixelModeAtom)
  const customDimensions = useAtomValue(customDimensionsAtom)
  const setCustomDimensions = useSetAtom(setCustomDimensionsAtom)

  // Local state for immediate slider feedback
  const [localWidth, setLocalWidth] = useState(customDimensions.width)
  const [localHeight, setLocalHeight] = useState(customDimensions.height)

  // Sync local state when atom changes externally (e.g., mode change)
  useEffect(() => {
    setLocalWidth(customDimensions.width)
    setLocalHeight(customDimensions.height)
  }, [customDimensions.width, customDimensions.height])

  // Debounced setter that updates the atom (triggers pipeline)
  const debouncedSetDimensions = useDebouncedCallback(
    (newDimensions: CustomDimensions) => {
      setCustomDimensions(newDimensions)
    },
    150
  )

  const handleWidthChange = (value: number) => {
    setLocalWidth(value) // Immediate UI update
    const newDimensions: CustomDimensions = {
      ...customDimensions,
      width: value
    }
    debouncedSetDimensions(newDimensions) // Debounced pipeline trigger
  }

  const handleHeightChange = (value: number) => {
    setLocalHeight(value) // Immediate UI update
    const newDimensions: CustomDimensions = {
      ...customDimensions,
      height: value
    }
    debouncedSetDimensions(newDimensions) // Debounced pipeline trigger
  }

  const validation = validateCustomDimensions(
    customDimensions.width,
    customDimensions.height,
    pixelMode
  )

  const widthStep = getWidthStepForMode(pixelMode)

  // Calculate max values based on 64KB limit
  // For a given height, what's the maximum width that fits in 64KB?
  const pixelsPerByte = getPixelsPerByte(pixelMode)
  const maxBytes = 65536

  // Max width for current height
  const maxBytesForHeight = Math.floor(maxBytes / localHeight)
  const maxWidthForHeight = maxBytesForHeight * pixelsPerByte
  // Round down to nearest valid step
  const maxWidth = Math.floor(maxWidthForHeight / widthStep) * widthStep

  // Max height for current width
  const bytesPerLine = localWidth / pixelsPerByte
  const maxHeightForWidth = Math.floor(maxBytes / bytesPerLine)
  // Round down to nearest 8
  const maxHeight = Math.floor(maxHeightForWidth / 8) * 8

  return (
    <CustomDimensionsInputView
      localWidth={localWidth}
      localHeight={localHeight}
      maxWidth={maxWidth}
      maxHeight={maxHeight}
      widthStep={widthStep}
      bytesPerLine={bytesPerLine}
      validation={validation}
      onWidthChange={handleWidthChange}
      onHeightChange={handleHeightChange}
    />
  )
}
