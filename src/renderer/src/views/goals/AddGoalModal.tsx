import React, { useEffect, useState, useRef } from 'react'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import TimePicker from '@/components/ui/TimePicker'
import Button from '@/components/ui/Button'
import ImageCropper from '@/components/image/ImageCropper'
import type { Program, CreateGoalDTO, CropData } from '@/types'
import { api } from '@/api/bridge'
import { toFileUrl } from '@/utils/fileUrl'

interface AddGoalModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  editGoal?: {
    id: number
    name: string
    description: string | null
    goal_type?: 'achievement' | 'restriction'
    daily_limit_seconds: number
    remind_time: string | null
    program_id: number | null
    card_image_path: string | null
  }
}

export const AddGoalModal: React.FC<AddGoalModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  editGoal
}) => {
  const [name, setName] = useState(editGoal?.name ?? '')
  const [description, setDescription] = useState(editGoal?.description ?? '')
  const [goalType, setGoalType] = useState<'achievement' | 'restriction'>(
    editGoal?.goal_type ?? 'achievement'
  )
  const [hours, setHours] = useState(
    editGoal ? Math.floor(editGoal.daily_limit_seconds / 3600).toString() : '1'
  )
  const [minutes, setMinutes] = useState(
    editGoal
      ? Math.floor((editGoal.daily_limit_seconds % 3600) / 60).toString()
      : '0'
  )
  const [remindTime, setRemindTime] = useState(editGoal?.remind_time ?? '')
  const [selectedProgramId, setSelectedProgramId] = useState(
    editGoal?.program_id?.toString() ?? ''
  )
  const [cardSrc, setCardSrc] = useState<string | null>(editGoal?.card_image_path ?? null)
  const [programs, setPrograms] = useState<Program[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [cropImageSrc, setCropImageSrc] = useState('')
  const [cropping, setCropping] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset form state when modal opens or editGoal changes
  useEffect(() => {
    setName(editGoal?.name ?? '')
    setDescription(editGoal?.description ?? '')
    setGoalType(editGoal?.goal_type ?? 'achievement')
    setHours(editGoal ? Math.floor(editGoal.daily_limit_seconds / 3600).toString() : '1')
    setMinutes(editGoal ? Math.floor((editGoal.daily_limit_seconds % 3600) / 60).toString() : '0')
    setRemindTime(editGoal?.remind_time ?? '')
    setSelectedProgramId(editGoal?.program_id?.toString() ?? '')
    setCardSrc(editGoal?.card_image_path ?? null)
    setError('')
  }, [editGoal, isOpen])

  // Fetch latest programs every time the modal opens
  useEffect(() => {
    if (!isOpen) return
    const loadPrograms = async () => {
      try {
        const list = await api.getPrograms()
        setPrograms(list)
      } catch (err) {
        console.error('Failed to load programs:', err)
      }
    }
    loadPrograms()
  }, [isOpen])

  const handleUploadCard = () => {
    setCropping(true)
    fileInputRef.current?.click()
  }

  const handleCropComplete = async (_cropData: CropData) => {
    try {
      const path = await api.saveImage(cropImageSrc, 'cards', `card_${Date.now()}.png`)
      setCardSrc(path)
    } catch (err) {
      console.error('Failed to save image:', err)
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError('请输入目标名称')
      return
    }

    const totalSeconds = (parseInt(hours) || 0) * 3600 + (parseInt(minutes) || 0) * 60
    if (totalSeconds <= 0) {
      setError('请设置有效的每日时长')
      return
    }

    setSaving(true)
    setError('')

    try {
      const data: CreateGoalDTO = {
        name: name.trim(),
        description: description.trim() || null,
        daily_limit_seconds: totalSeconds,
        goal_type: goalType,
        remind_time: remindTime || null,
        remind_enabled: remindTime ? 1 : 0,
        program_id: selectedProgramId ? parseInt(selectedProgramId) : null,
        card_image_path: cardSrc
      }

      if (editGoal) {
        await api.updateGoal(editGoal.id, data)
      } else {
        await api.addGoal(data)
      }
      onSaved()
      onClose()
    } catch (err) {
      console.error('Failed to save goal:', err)
      setError('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const programOptions = [
    { value: '', label: '不关联' },
    ...programs.map((p) => ({ value: p.id.toString(), label: p.name }))
  ]

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={editGoal ? '编辑目标' : '添加目标'}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <Input
            label="目标名称"
            value={name}
            onChange={setName}
            placeholder="例如: 减少游戏时间"
          />

          <Input
            label="描述"
            value={description}
            onChange={setDescription}
            placeholder="目标描述（可选）"
          />

          {/* Goal Type Selector */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">
              目标类型
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setGoalType('achievement')}
                className={`
                  flex-1 px-4 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-200
                  ${goalType === 'achievement'
                    ? 'bg-primary/20 text-primary border border-primary/40'
                    : 'bg-white/5 text-text-secondary border border-white/10 hover:border-white/20'
                  }
                `}
              >
                要求时长
              </button>
              <button
                type="button"
                onClick={() => setGoalType('restriction')}
                className={`
                  flex-1 px-4 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-200
                  ${goalType === 'restriction'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-white/5 text-text-secondary border border-white/10 hover:border-white/20'
                  }
                `}
              >
                限制时长
              </button>
            </div>
            <p className="text-xs text-text-secondary/70">
              {goalType === 'achievement'
                ? '每日至少使用达到设定时长，完成获得爱心'
                : '每日使用不能超过设定时长，超限将收到警告'
              }
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">
              每日时长
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="number"
                  min="0"
                  max="24"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="小时"
                  className="
                    w-full px-4 py-2.5 rounded-xl text-sm text-white
                    bg-white/5 border border-white/10
                    placeholder:text-text-secondary/50
                    focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50
                    transition-all duration-200
                  "
                />
                <span className="text-xs text-text-secondary mt-1 block">小时</span>
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  placeholder="分钟"
                  className="
                    w-full px-4 py-2.5 rounded-xl text-sm text-white
                    bg-white/5 border border-white/10
                    placeholder:text-text-secondary/50
                    focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50
                    transition-all duration-200
                  "
                />
                <span className="text-xs text-text-secondary mt-1 block">分钟</span>
              </div>
            </div>
          </div>

          {/* Card Image Upload */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">
              卡片背景
            </label>
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={handleUploadCard}>
                选择文件
              </Button>
              {cardSrc && (
                <div className="flex items-center gap-2">
                  <img
                    src={toFileUrl(cardSrc) || ''}
                    alt="卡片预览"
                    className="w-16 h-9 rounded-lg object-cover border border-white/10"
                  />
                  <span className="text-xs text-emerald-400">已选择</span>
                </div>
              )}
            </div>
          </div>

          <Select
            label="关联程序"
            value={selectedProgramId}
            onChange={setSelectedProgramId}
            options={programOptions}
          />

          <TimePicker
            label="提醒时刻"
            value={remindTime}
            onChange={setRemindTime}
          />

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={onClose}>
              取消
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editGoal ? '保存' : '添加'}
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
            setCropping(false)
            setCropImageSrc('')
          }}
          imageSrc={cropImageSrc}
          aspectRatio={16 / 9}
          onCropComplete={handleCropComplete}
        />
      )}
    </>
  )
}

export default AddGoalModal
