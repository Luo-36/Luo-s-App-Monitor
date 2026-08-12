import React, { useState, useCallback } from 'react'
import Cropper, { Area } from 'react-easy-crop'
import Modal from '@/components/ui/Modal'
import Slider from '@/components/ui/Slider'
import Button from '@/components/ui/Button'
import type { CropData } from '@/types'

interface ImageCropperProps {
  isOpen: boolean
  onClose: () => void
  imageSrc: string
  aspectRatio: number
  onCropComplete: (cropData: CropData) => void
}

export const ImageCropper: React.FC<ImageCropperProps> = ({
  isOpen,
  onClose,
  imageSrc,
  aspectRatio,
  onCropComplete
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  const onCropChange = useCallback((location: { x: number; y: number }) => {
    setCrop(location)
  }, [])

  const onZoomChange = useCallback((zoomValue: number) => {
    setZoom(zoomValue)
  }, [])

  const onCropAreaComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleConfirm = useCallback(() => {
    if (croppedAreaPixels) {
      onCropComplete({
        x: croppedAreaPixels.x,
        y: croppedAreaPixels.y,
        width: croppedAreaPixels.width,
        height: croppedAreaPixels.height
      })
      onClose()
    }
  }, [croppedAreaPixels, onCropComplete, onClose])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="裁剪图片" maxWidth="max-w-xl">
      <div className="space-y-4">
        {/* Cropper Area */}
        <div className="relative w-full h-80 rounded-xl overflow-hidden bg-black/60">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropAreaComplete}
          />
        </div>

        {/* Zoom Slider */}
        <Slider
          label="缩放"
          value={zoom}
          onChange={(val) => setZoom(val)}
          min={1}
          max={3}
          step={0.1}
        />

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleConfirm}>
            确认
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default ImageCropper
