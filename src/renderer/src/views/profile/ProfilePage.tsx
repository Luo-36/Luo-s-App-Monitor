import React, { useEffect, useState, useRef } from 'react'
import { Camera, Heart, Save } from 'lucide-react'
import type { UserProfile, CropData } from '@/types'
import { api } from '@/api/bridge'
import { toFileUrl } from '@/utils/fileUrl'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import ImageCropper from '@/components/image/ImageCropper'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export const ProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [nickname, setNickname] = useState('')
  const [bio, setBio] = useState('')
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null)
  const [cropping, setCropping] = useState(false)
  const [cropImageSrc, setCropImageSrc] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const p = await api.getProfile()
        setProfile(p)
        setNickname(p.nickname)
        setBio(p.bio)
      } catch (err) {
        console.error('Failed to load profile:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      setCropImageSrc(reader.result as string)
      setCropping(true)
    }
    reader.readAsDataURL(file)

    // Reset input
    e.target.value = ''
  }

  const handleCropComplete = async (cropData: CropData) => {
    try {
      // Crop the original image using canvas
      const image = new Image()
      image.src = cropImageSrc
      await new Promise((resolve) => { image.onload = resolve })

      const canvas = document.createElement('canvas')
      canvas.width = cropData.width
      canvas.height = cropData.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Failed to get canvas context')

      ctx.drawImage(
        image,
        cropData.x, cropData.y, cropData.width, cropData.height, // source rect
        0, 0, cropData.width, cropData.height                    // dest rect
      )

      const croppedDataUrl = canvas.toDataURL('image/png')

      // Save cropped avatar
      const path = await api.saveImage(croppedDataUrl, 'avatars', `avatar_${Date.now()}.png`)
      setAvatarSrc(path)
    } catch (err) {
      console.error('Failed to save avatar:', err)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const updates: Partial<UserProfile> = {
        nickname: nickname.trim() || '用户',
        bio: bio.trim()
      }
      if (avatarSrc) {
        updates.avatar_path = avatarSrc
      }
      await api.updateProfile(updates)
      const updated = await api.getProfile()
      setProfile(updated)
    } catch (err) {
      console.error('Failed to save profile:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center h-full py-32">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[600px] mx-auto">
      {/* Header */}
      <h1 className="text-2xl font-bold text-white mb-6">用户</h1>

      {/* Avatar Section */}
      <Card className="p-8 mb-6">
        <div className="flex flex-col items-center">
          {/* Avatar */}
          <div
            onClick={handleAvatarClick}
            className="
              relative w-24 h-24 rounded-full overflow-hidden
              bg-slate-700/50 border-2 border-white/10
              cursor-pointer group
              hover:border-primary/50 transition-all duration-200
            "
          >
            {profile.avatar_path || avatarSrc ? (
              <img
                src={toFileUrl(avatarSrc || profile.avatar_path) || ''}
                alt="avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-3xl font-bold text-text-secondary">
                  {profile.nickname.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
              <Camera className="w-6 h-6 text-white" />
            </div>
          </div>

          {/* Hearts Count */}
          <div className="flex items-center gap-1.5 mt-4">
            <Heart className="w-5 h-5 text-pink-400 fill-pink-400" />
            <span className="text-xl font-bold text-white">
              {profile.hearts_count}
            </span>
            <span className="text-sm text-text-secondary">(完成目标次数)</span>
          </div>
        </div>
      </Card>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Profile Form */}
      <Card className="p-6 mb-6 space-y-5">
        <Input
          label="昵称"
          value={nickname}
          onChange={setNickname}
          placeholder="输入你的昵称"
        />

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-text-secondary">
            个人简介
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="介绍一下自己..."
            rows={4}
            className="
              w-full px-4 py-2.5 rounded-xl text-sm text-white
              bg-white/5 border border-white/10
              placeholder:text-text-secondary/50
              focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50
              transition-all duration-200
              resize-none
            "
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} loading={saving}>
            <Save className="w-4 h-4" />
            保存
          </Button>
        </div>
      </Card>

      {/* Image Cropper */}
      {cropImageSrc && (
        <ImageCropper
          isOpen={cropping}
          onClose={() => {
            setCropping(false)
            setCropImageSrc('')
          }}
          imageSrc={cropImageSrc}
          aspectRatio={1}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  )
}

export default ProfilePage
