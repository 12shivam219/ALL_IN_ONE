import { create } from 'zustand';

interface SettingsState {
  theme: 'light' | 'dark';
  pointsPerCycle: number;
  deduplicationEnabled: boolean;
  toggleTheme: () => void;
  setPointsPerCycle: (points: number) => void;
  setDeduplicationEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => {
  // Read initial values from localStorage
  const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
  const initialTheme = savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  
  if (initialTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  return {
    theme: initialTheme,
    pointsPerCycle: Number(localStorage.getItem('pointsPerCycle')) || 2,
    deduplicationEnabled: localStorage.getItem('deduplicationEnabled') === 'true',
    
    toggleTheme: () => set((state) => {
      const nextTheme = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', nextTheme);
      
      if (nextTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return { theme: nextTheme };
    }),
    
    setPointsPerCycle: (points) => set(() => {
      localStorage.setItem('pointsPerCycle', String(points));
      return { pointsPerCycle: points };
    }),
    
    setDeduplicationEnabled: (enabled) => set(() => {
      localStorage.setItem('deduplicationEnabled', String(enabled));
      return { deduplicationEnabled: enabled };
    }),
  };
});
