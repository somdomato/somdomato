// Sistema de bits para horários
export const TIME_SLOTS = {
  NENHUM: 0, // 0000 - Somente por pedido
  MADRUGADA: 1, // 0001 - 0h-6h
  MANHA: 2, // 0010 - 6h-12h
  TARDE: 4, // 0100 - 12h-18h
  NOITE: 8, // 1000 - 18h-24h
} as const;

// Todas as combinações possíveis
export const TIME_SLOT_COMBINATIONS = {
  0: "Nenhum (Somente por pedido)",
  1: "Madrugada (0h-6h)",
  2: "Manhã (6h-12h)",
  3: "Madrugada/Manhã (0h-12h)",
  4: "Tarde (12h-18h)",
  5: "Madrugada/Tarde (0h-6h, 12h-18h)",
  6: "Manhã/Tarde (6h-18h)",
  7: "Madrugada/Manhã/Tarde (0h-18h)",
  8: "Noite (18h-24h)",
  9: "Madrugada/Noite (0h-6h, 18h-24h)",
  10: "Manhã/Noite (6h-12h, 18h-24h)",
  11: "Madrugada/Manhã/Noite (0h-12h, 18h-24h)",
  12: "Tarde/Noite (12h-24h)",
  13: "Madrugada/Tarde/Noite (0h-6h, 12h-24h)",
  14: "Manhã/Tarde/Noite (6h-24h)",
  15: "Todos os horários (0h-24h)",
} as const;

// Labels curtas para exibição na tabela
export const TIME_SLOT_SHORT_LABELS = {
  0: "Nenhum",
  1: "Mad",
  2: "Man",
  3: "Mad/Man",
  4: "Tar",
  5: "Mad/Tar",
  6: "Man/Tar",
  7: "Mad/Man/Tar",
  8: "Noi",
  9: "Mad/Noi",
  10: "Man/Noi",
  11: "Mad/Man/Noi",
  12: "Tar/Noi",
  13: "Mad/Tar/Noi",
  14: "Man/Tar/Noi",
  15: "Todos",
} as const;

// Função para obter o slot de horário atual
export function getCurrentTimeSlot(): number {
  const currentHour = new Date().getHours();

  if (currentHour >= 0 && currentHour < 6) {
    return TIME_SLOTS.MADRUGADA;
  } else if (currentHour >= 6 && currentHour < 12) {
    return TIME_SLOTS.MANHA;
  } else if (currentHour >= 12 && currentHour < 18) {
    return TIME_SLOTS.TARDE;
  } else if (currentHour >= 18 && currentHour < 24) {
    return TIME_SLOTS.NOITE;
  }

  return TIME_SLOTS.NENHUM;
}

// Função para verificar se pode tocar no horário atual
export function canPlayAtCurrentTime(timeSlots: number): boolean {
  if (timeSlots === TIME_SLOTS.NENHUM) return false;

  const currentSlot = getCurrentTimeSlot();

  // Verifica se o horário atual está habilitado usando operação bitwise
  return (timeSlots & currentSlot) !== 0;
}

// Função para obter o nome do horário
export function getTimeSlotName(timeSlots: number): string {
  return (
    TIME_SLOT_COMBINATIONS[timeSlots as keyof typeof TIME_SLOT_COMBINATIONS] ||
    "Desconhecido"
  );
}

// Função para obter o label curto
export function getTimeSlotShortLabel(timeSlots: number): string {
  return (
    TIME_SLOT_SHORT_LABELS[timeSlots as keyof typeof TIME_SLOT_SHORT_LABELS] ||
    "?"
  );
}
