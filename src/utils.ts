import { Block, ConnectionType } from './types';

/**
 * Определяет тип связи между двумя блоками на основе их расположения
 */
export function getConnectionType(block1: Block, block2: Block): ConnectionType {
  const dx = Math.abs(block1.x - block2.x);
  const dy = Math.abs(block1.y - block2.y);

  // Последовательное соединение: блоки на одном уровне Y
  if (dy === 0 && dx > 0) {
    return 'sequential';
  }

  // Параллельное соединение: через 1 клетку по Y и на одном уровне X
  if (dy === 1 && dx === 0) {
    return 'parallel';
  }

  // Резервное соединение: через 2 клетки по Y и на одном уровне X
  if (dy === 2 && dx === 0) {
    return 'reserve';
  }

  return null;
}

/**
 * Находит все связи между блоками
 */
export function findConnections(blocks: Block[]) {
  const connections: Array<{ from: Block; to: Block; type: ConnectionType }> = [];

  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const type = getConnectionType(blocks[i], blocks[j]);
      if (type) {
        connections.push({
          from: blocks[i],
          to: blocks[j],
          type,
        });
      }
    }
  }

  return connections;
}

/**
 * Проверяет валидность значения надежности и возвращает нормализованное значение
 */
export function normalizeReliability(value: string | number): number {
  if (typeof value === 'string') {
    // Удаляем все нецифровые символы кроме точки
    const cleaned = value.replace(/[^\d.]/g, '');
    
    if (cleaned === '' || cleaned === '.') {
      return 0;
    }
    
    const num = parseFloat(cleaned);
    
    if (isNaN(num)) {
      return 0;
    }
    
    // Ограничиваем диапазон [0, 1]
    return Math.max(0, Math.min(1, num));
  }
  
  return Math.max(0, Math.min(1, value));
}
