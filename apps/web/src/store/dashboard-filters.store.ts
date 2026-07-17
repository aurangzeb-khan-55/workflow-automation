import { create } from "zustand";

/**
 * Client-only UI state for the staff Intake Status Dashboard (search/filter
 * selections). Server data itself is owned by TanStack Query, not this
 * store — this only holds the current filter inputs.
 */
interface DashboardFiltersState {
  search: string;
  providerId: string | null;
  status: string | null;
  appointmentDate: string | null;
  setSearch: (search: string) => void;
  setProviderId: (providerId: string | null) => void;
  setStatus: (status: string | null) => void;
  setAppointmentDate: (date: string | null) => void;
  reset: () => void;
}

const initialFilters = {
  search: "",
  providerId: null,
  status: null,
  appointmentDate: null,
};

export const useDashboardFiltersStore = create<DashboardFiltersState>((set) => ({
  ...initialFilters,
  setSearch: (search) => set({ search }),
  setProviderId: (providerId) => set({ providerId }),
  setStatus: (status) => set({ status }),
  setAppointmentDate: (appointmentDate) => set({ appointmentDate }),
  reset: () => set(initialFilters),
}));
