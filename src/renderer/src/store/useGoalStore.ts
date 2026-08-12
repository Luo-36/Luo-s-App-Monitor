import { create } from 'zustand'
import type { Goal } from '../types/index'

interface GoalState {
  goals: Goal[]
  setGoals: (goals: Goal[]) => void
  addGoal: (goal: Goal) => void
  updateGoal: (id: number, data: Partial<Goal>) => void
  removeGoal: (id: number) => void
}

export const useGoalStore = create<GoalState>((set) => ({
  goals: [],

  setGoals: (goals: Goal[]) => set({ goals }),

  addGoal: (goal: Goal) =>
    set((state) => ({ goals: [...state.goals, goal] })),

  updateGoal: (id: number, data: Partial<Goal>) =>
    set((state) => ({
      goals: state.goals.map((g) => (g.id === id ? { ...g, ...data } : g)),
    })),

  removeGoal: (id: number) =>
    set((state) => ({
      goals: state.goals.filter((g) => g.id !== id),
    })),
}))
