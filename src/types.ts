// Типы данных для приложения

export interface Block {
  id: string;
  number: number;
  x: number;
  y: number;
  reliability: number;
}

export interface Connection {
  id: string;
  fromBlockId: string;
  toBlockId: string;
  fromSide: "left" | "right"; // Сторона первого блока
  toSide: "left" | "right"; // Сторона второго блока
}

export type ConnectionType = "sequential" | "parallel" | "reserve" | null;

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
