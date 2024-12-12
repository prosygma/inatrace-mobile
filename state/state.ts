import { create } from 'zustand';
import { Farmer } from '@/types/farmer';

interface SelectedFarmerState {
  selectedFarmer: Farmer | null;
  setSelectedFarmer: (selectedFarmer: Farmer | null) => void;
}

export const useSelectedFarmerState = create<SelectedFarmerState>((set) => ({
  selectedFarmer: null,
  setSelectedFarmer: (selectedFarmer: Farmer | null) =>
    set(() => ({ selectedFarmer })),
}));
