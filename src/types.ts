// Типы данных для приложения

export interface Block {
  id: string;
  x: number;
  y: number;
  mode: "sequential" | "parallel" | "reserve";
  reliability: number;
  readiness: number;
}

export interface SystemCalculations {
  processorCount: number;
  processorReadiness: number; // P_np
  systemReadiness: number; // G_np
  systemEfficiency: number; // E_np = G/N
  memory: number;
  uvv: number; // УВВ
  computationalSystemReadiness: number; // G_вс
  computationalSystemEfficiency: number; // E_вс
}

export interface CalculationResults {
  configurations: SystemCalculations[];
  bestConfiguration: SystemCalculations | null;
}
