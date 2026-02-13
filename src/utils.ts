/**
 * Проверяет валидность значения надежности и возвращает нормализованное значение
 */
export function normalizeReliability(value: string | number): number {
  if (typeof value === "string") {
    // Поддерживаем точку и запятую как разделитель дробной части
    const withDot = value.replace(",", ".");
    // Оставляем только цифры и точку
    const cleaned = withDot.replace(/[^\d.]/g, "");
    const parsed = parseFloat(cleaned);
    if (isNaN(parsed)) return 0.95;
    return Math.max(0, Math.min(1, parsed));
  }
  return Math.max(0, Math.min(1, value));
}
