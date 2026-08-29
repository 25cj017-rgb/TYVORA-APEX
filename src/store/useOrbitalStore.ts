import { create } from "zustand";
import { ValidatedSatellite, ValidatedSpaceDebris } from "../lib/schemas";
import { ConjunctionEvent, Satellite } from "../types";

export type ViewportTab = "globe" | "telemetry" | "network" | "assistant";
export type FilterLayer = "ALL" | "LEO" | "GEO" | "CRITICAL";
export type CameraMode = "free" | "locked" | "cinematic";

interface OrbitalStoreState {
  selectedObject: ValidatedSatellite | ValidatedSpaceDebris | null;
  activeTab: ViewportTab;
  filterLayer: FilterLayer;
  simulationSpeed: number;
  cameraMode: CameraMode;
  searchQuery: string;
  conjunctions: ConjunctionEvent[];
  selectedConjunction: ConjunctionEvent | null;
  showAllOrbits: boolean;
  activeSatellites: Satellite[];
  selectedSatellite: Satellite | null;

  // Actions
  setSelectedObject: (obj: ValidatedSatellite | ValidatedSpaceDebris | null) => void;
  setActiveTab: (tab: ViewportTab) => void;
  setFilterLayer: (layer: FilterLayer) => void;
  setSimulationSpeed: (speed: number) => void;
  setCameraMode: (mode: CameraMode) => void;
  setSearchQuery: (query: string) => void;
  setConjunctions: (conjs: ConjunctionEvent[]) => void;
  setSelectedConjunction: (conj: ConjunctionEvent | null) => void;
  setShowAllOrbits: (show: boolean) => void;
  setActiveSatellites: (sats: Satellite[]) => void;
  setSelectedSatellite: (sat: Satellite | null) => void;
}

export const useOrbitalStore = create<OrbitalStoreState>((set) => ({
  selectedObject: null,
  activeTab: "globe",
  filterLayer: "ALL",
  simulationSpeed: 1,
  cameraMode: "free",
  searchQuery: "",
  conjunctions: [],
  selectedConjunction: null,
  showAllOrbits: true,
  activeSatellites: [],
  selectedSatellite: null,

  setSelectedObject: (obj) => set({ selectedObject: obj }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setFilterLayer: (layer) => set({ filterLayer: layer }),
  setSimulationSpeed: (speed) => set({ simulationSpeed: speed }),
  setCameraMode: (mode) => set({ cameraMode: mode }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setConjunctions: (conjs) => set({ conjunctions: conjs }),
  setSelectedConjunction: (conj) => set({ selectedConjunction: conj }),
  setShowAllOrbits: (show) => set({ showAllOrbits: show }),
  setActiveSatellites: (sats) => set({ activeSatellites: sats }),
  setSelectedSatellite: (sat) => set({ selectedSatellite: sat }),
}));


