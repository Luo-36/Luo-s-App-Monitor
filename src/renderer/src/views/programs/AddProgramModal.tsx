import React, { useState, useRef } from 'react'
import { FolderOpen } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import ImageCropper from '@/components/image/ImageCropper'
import { api } from '@/api/bridge'
import { toFileUrl } from '@/utils/fileUrl'
import type { CropData } from '@/types'

interface AddProgramModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  editProgram?: {
    id: number
    name: string
    process_name: string
    icon_path: string | null
    card_image_path: string | null
  }
}

export const AddProgramModal: React.FC<AddProgramModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  editProgram
}) => {
  const [name, setName] = useState(editProgram?.name ?? '')
  const [processName, setProcessName] = useState(editProgram?.process_name ?? '')
  const [iconSrc, setIconSrc] = useState<string | null>(editProgram?.icon_path ?? null)
  const [cardSrc, setCardSrc] = useState<string | null>(editProgram?.card_image_path ?? null)
  const [cropping, setCropping] = useState<'icon' | 'card' | null>(null)
  const [cropImageSrc, setCropImageSrc] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSelectProcess = async () => {
    const result = await api.openFileDialog([
      { name: '可执行文件', extensions: ['exe'] }
    ])
    if (result) {
      // Extract full process name (including .exe) from path
      const parts = result.replace(/\\/g, '/').split('/')
      const exeName = parts[parts.length - 1] ?? ''
      setProcessName(exeName)

      // Auto-extract icon from exe
      try {
        const iconPath = await api.extractExeIcon(result)
        if (iconPath) {
          setIconSrc(iconPath)
        }
      } catch (err) {
        console.error('Failed to extract icon:', err)
      }
    }
  }

  const handleUploadIcon = () => {
    setCropping('icon')
    openImagePicker('icon')
  }

  const handleUploadCard = () => {
    setCropping('card')
    openImagePicker('card')
  }

  const openImagePicker = (_type: 'icon' | 'card') => {
    // Trigger the hidden file input which produces a data URL via FileReader.
    // This avoids file:// CORS issues that occur with fetch('file:///...').
    fileInputRef.current?.click()
  }

  const handleCropComplete = async (_cropData: CropData) => {
    try {
      // cropImageSrc is always a data URL from the FileReader (no file:// conversion needed)
      if (cropping === 'icon') {
        const path = await api.saveImage(cropImageSrc, 'icons', `icon_${Date.now()}.png`)
        setIconSrc(path)
      } else if (cropping === 'card') {
        const path = await api.saveImage(cropImageSrc, 'cards', `card_${Date.now()}.png`)
        setCardSrc(path)
      }
    } catch (err) {
      console.error('Failed to save image:', err)
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError('请输入程序名称')
      return
    }
    if (!processName.trim()) {
      setError('请输入进程名')
      return
    }

    setSaving(true)
    setError('')

    try {
      if (editProgram) {
        await api.updateProgram(editProgram.id, {
          name: name.trim(),
          process_name: processName.trim(),
          icon_path: iconSrc,
          card_image_path: cardSrc
        })
      } else {
        await api.addProgram({
          name: name.trim(),
          process_name: processName.trim(),
          icon_path: iconSrc,
          card_image_path: cardSrc
        })
      }
      onSaved()
      onClose()
    } catch (err) {
      console.error('Failed to save program:', err)
      setError('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={editProgram ? '编辑程序' : '添加程序'}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <Input
            label="程序名称"
            value={name}
            onChange={setName}
            placeholder="例如: Google Chrome"
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">
              进程名
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={processName}
                onChange={(e) => setProcessName(e.target.value)}
                placeholder="例如: chrome.exe"
                className="
                  flex-1 px-4 py-2.5 rounded-xl text-sm text-white
                  bg-white/5 border border-white/10
                  placeholder:text-text-secondary/50
                  focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50
                  transition-all duration-200
                "
              />
              <Button variant="secondary" onClick={handleSelectProcess}>
                <FolderOpen className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">
              上传图标
            </label>
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={handleUploadIcon}>
                选择文件
              </Button>
              {iconSrc && (
                <div className="flex items-center gap-2">
                  <img
                    src={toFileUrl(iconSrc) || ''}
                    alt="图标预览"
                    className="w-8 h-8 rounded-md object-contain border border-white/10"
                  />
                  <span className="text-xs text-emerald-400">已选择</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">
              上传卡片
            </label>
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={handleUploadCard}>
                选择文件
              </Button>
              {cardSrc && (
                <span className="text-xs text-emerald-400">已选择</span>
              )}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={onClose}>
              取消
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editProgram ? '保存' : '添加'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Hidden file input for image uploading — uses FileReader for data URLs, avoiding file:// CORS issues */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            const reader = new FileReader()
            reader.onload = () => {
              setCropImageSrc(reader.result as string)
            }
            reader.readAsDataURL(file)
          }
        }}
      />

      {cropImageSrc && cropping && (
        <ImageCropper
          isOpen={!!cropping}
          onClose={() => {
            setCropping(null)
            setCropImageSrc('')
          }}
          imageSrc={cropImageSrc}
          aspectRatio={cropping === 'icon' ? 1 : 16 / 9}
          onCropComplete={handleCropComplete}
        />
      )}
    </>
  )
}

export default AddProgramModal
