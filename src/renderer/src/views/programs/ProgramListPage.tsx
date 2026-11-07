import React, { useEffect, useState } from 'react'
import { Plus, ScanLine } from 'lucide-react'
import type { Program, UsageEntry } from '@/types'
import { api } from '@/api/bridge'
import { useTrackingStore } from '@/store/useTrackingStore'
import ProgramCard from '@/components/cards/ProgramCard'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import AddProgramModal from './AddProgramModal'

export const ProgramListPage: React.FC = () => {
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingProgram, setEditingProgram] = useState<Program | null>(null)
  const [autoAddProcess, setAutoAddProcess] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [capturedProcess, setCapturedProcess] = useState<string | null>(null)
  const { todayUsage, updateFromTick, currentProgram } = useTrackingStore()

  const loadPrograms = async () => {
    try {
      setLoading(true)
      const [progList, usage] = await Promise.all([
        api.getPrograms(),
        api.getTodayUsage()
      ])
      setPrograms(progList)
      useTrackingStore.getState().setTodayUsage(usage)
    } catch (err) {
      console.error('Failed to load programs:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPrograms()

    const unsubTick = api.onTrackingTick((data) => {
      updateFromTick(data)
    })

    const unsubCapture = api.onCaptureDetected((processName) => {
      setCapturing(false)
      setCapturedProcess(processName)
    })

    return () => {
      unsubTick()
      unsubCapture()
    }
  }, [])

  const getUsageForProgram = (programId: number): number => {
    const entry = todayUsage.find((u: UsageEntry) => u.program_id === programId)
    let seconds = entry?.total_seconds ?? 0
    // Add live elapsed time if this program is currently active
    if (currentProgram && currentProgram.programId === programId) {
      seconds += currentProgram.elapsedSeconds
    }
    return seconds
  }

  const handleEdit = (program: Program) => {
    setEditingProgram(program)
    setShowAddModal(true)
  }

  const handleDelete = async (program: Program) => {
    if (window.confirm(`确定要删除程序「${program.name}」吗？`)) {
      try {
        await api.deleteProgram(program.id)
        loadPrograms()
      } catch (err) {
        console.error('Failed to delete program:', err)
      }
    }
  }

  const handleCloseModal = () => {
    setShowAddModal(false)
    setEditingProgram(null)
    setAutoAddProcess(null)
  }

  const handleSaved = () => {
    loadPrograms()
    setEditingProgram(null)
    setAutoAddProcess(null)
  }

  const handleStartCapture = async () => {
    setCapturing(true)
    setCapturedProcess(null)
    try {
      await api.startCapture()
    } catch (err) {
      console.error('Failed to start capture:', err)
      setCapturing(false)
    }
  }

  const handleCancelCapture = async () => {
    setCapturing(false)
    setCapturedProcess(null)
    try {
      await api.stopCapture()
    } catch {}
  }

  const handleConfirmAdd = () => {
    if (capturedProcess) {
      setAutoAddProcess(capturedProcess)
      setCapturedProcess(null)
      setShowAddModal(true)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-32">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">我的程序</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleStartCapture}>
            <ScanLine className="w-4 h-4" />
            自动添加
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4" />
            添加程序
          </Button>
        </div>
      </div>

      {/* Program Grid */}
      {programs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
            <Plus className="w-8 h-8 text-text-secondary" />
          </div>
          <p className="text-text-secondary text-sm mb-2">还没有添加程序</p>
          <p className="text-text-secondary/60 text-xs mb-6">
            点击上方按钮添加你要监控的程序
          </p>
          <Button variant="secondary" onClick={() => setShowAddModal(true)}>
            添加第一个程序
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {programs.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              usageSeconds={getUsageForProgram(program.id)}
              onEdit={() => handleEdit(program)}
              onDelete={() => handleDelete(program)}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Program Modal */}
      <AddProgramModal
        isOpen={showAddModal}
        onClose={handleCloseModal}
        onSaved={handleSaved}
        editProgram={editingProgram ?? undefined}
        initialProcessName={autoAddProcess ?? undefined}
      />

      {/* Auto-add capture modal */}
      <Modal
        isOpen={capturing || capturedProcess !== null}
        onClose={handleCancelCapture}
        title="自动添加程序"
        maxWidth="max-w-sm"
      >
        {capturing ? (
          <div className="space-y-3 py-2">
            <p className="text-sm text-text-secondary">
              请切换到你想添加的程序窗口，并保持聚焦 3 秒…
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={handleCancelCapture}>
                取消
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <p className="text-sm text-text-secondary">检测到进程：</p>
            <p className="text-lg font-mono font-semibold text-white">
              {capturedProcess}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={handleCancelCapture}>
                取消
              </Button>
              <Button onClick={handleConfirmAdd}>添加</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default ProgramListPage
