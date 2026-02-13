import { Block, Connection } from "./types";

const DECIMAL_PLACES = 6;

function roundTo(value: number, decimals = DECIMAL_PLACES): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function formatTo(value: number, decimals = DECIMAL_PLACES): string {
  const rounded = roundTo(value, decimals);
  return rounded.toFixed(decimals).replace(/\.?0+$/, "");
}

/**
 * Биномиальный коэффициент C(n, k) = n! / (k! * (n-k)!)
 */
function binomialCoefficient(n: number, k: number): number {
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;

  let result = 1;
  for (let i = 1; i <= k; i++) {
    result *= (n - i + 1) / i;
  }
  return result;
}

/**
 * Формула Бернулли: P(k,n) = C(n,k) * p^k * q^(n-k)
 * Вероятность того, что ровно k из n элементов работают
 */
function bernoulliProbability(n: number, k: number, p: number): number {
  const q = 1 - p;
  const c = binomialCoefficient(n, k);
  return c * Math.pow(p, k) * Math.pow(q, n - k);
}

/**
 * Граф для анализа связей
 */
interface ConnectionGraph {
  adjacency: Map<string, Array<{ toId: string; connection: Connection }>>;
  blocks: Map<string, Block>;
}

/**
 * Проверяет, является ли связь валидной (выход -> вход)
 */
function isValidConnection(conn: Connection): boolean {
  return (
    (conn.fromSide === "right" && conn.toSide === "left") ||
    (conn.fromSide === "left" && conn.toSide === "right")
  );
}

/**
 * Строим граф связей (только из валидных связей)
 */
function buildGraph(
  blocks: Block[],
  connections: Connection[],
): ConnectionGraph {
  const graph: ConnectionGraph = {
    adjacency: new Map(),
    blocks: new Map(),
  };

  // Добавляем блоки
  blocks.forEach((block) => {
    graph.blocks.set(block.id, block);
    graph.adjacency.set(block.id, []);
  });

  // Добавляем только ВАЛИДНЫЕ связи (выход->вход)
  const validConnections = connections.filter(isValidConnection);

  validConnections.forEach((conn) => {
    // Определяем направление: от выхода к входу
    if (conn.fromSide === "right" && conn.toSide === "left") {
      graph.adjacency.get(conn.fromBlockId)?.push({
        toId: conn.toBlockId,
        connection: conn,
      });
    } else if (conn.fromSide === "left" && conn.toSide === "right") {
      graph.adjacency.get(conn.toBlockId)?.push({
        toId: conn.fromBlockId,
        connection: conn,
      });
    }
  });

  return graph;
}

/**
 * Рассчитываем надежность параллельной группы
 */
function calculateParallelReliability(
  blockIds: string[],
  graph: ConnectionGraph,
): number {
  let unreliability = 1;
  blockIds.forEach((id) => {
    const block = graph.blocks.get(id);
    if (block) {
      unreliability *= 1 - block.reliability;
    }
  });
  return roundTo(1 - unreliability);
}

/**
 * Вероятности ровно k успешных элементов для набора разных p_i (Poisson Binomial)
 * result[k] = P(ровно k из n работают)
 */
function calculateExactKProbabilities(probabilities: number[]): number[] {
  const n = probabilities.length;
  const dp = new Array(n + 1).fill(0);
  dp[0] = 1;

  probabilities.forEach((p) => {
    for (let k = n; k >= 0; k--) {
      const stayFail = dp[k] * (1 - p);
      const becomeSuccess = k > 0 ? dp[k - 1] * p : 0;
      dp[k] = stayFail + becomeSuccess;
    }
  });

  return dp.map((v) => roundTo(v));
}

function hasLeftToLeftConnection(
  aId: string,
  bId: string,
  connections: Connection[],
): boolean {
  return connections.some(
    (c) =>
      ((c.fromBlockId === aId && c.toBlockId === bId) ||
        (c.fromBlockId === bId && c.toBlockId === aId)) &&
      c.fromSide === "left" &&
      c.toSide === "left",
  );
}

function hasRightToRightConnection(
  aId: string,
  bId: string,
  connections: Connection[],
): boolean {
  return connections.some(
    (c) =>
      ((c.fromBlockId === aId && c.toBlockId === bId) ||
        (c.fromBlockId === bId && c.toBlockId === aId)) &&
      c.fromSide === "right" &&
      c.toSide === "right",
  );
}

function analyzeComponent(
  component: string[],
  graph: ConnectionGraph,
  connections: Connection[],
): {
  groups: string[][];
  orderedGroups: string[][];
  reliability: number;
} {
  // 1) Находим параллельные группы:
  // два блока принадлежат одной группе, если между ними есть И left-to-left, И right-to-right связь.
  const parallelAdj = new Map<string, Set<string>>();
  component.forEach((id) => parallelAdj.set(id, new Set()));

  for (let i = 0; i < component.length; i++) {
    for (let j = i + 1; j < component.length; j++) {
      const aId = component[i];
      const bId = component[j];
      const isParallel =
        hasLeftToLeftConnection(aId, bId, connections) &&
        hasRightToRightConnection(aId, bId, connections);

      if (isParallel) {
        parallelAdj.get(aId)?.add(bId);
        parallelAdj.get(bId)?.add(aId);
      }
    }
  }

  const visited = new Set<string>();
  const groups: string[][] = [];

  const dfsGroup = (startId: string, group: string[]) => {
    if (visited.has(startId)) return;
    visited.add(startId);
    group.push(startId);

    const neighbors = parallelAdj.get(startId);
    if (!neighbors) return;
    neighbors.forEach((nextId) => {
      if (!visited.has(nextId)) {
        dfsGroup(nextId, group);
      }
    });
  };

  component.forEach((id) => {
    if (!visited.has(id)) {
      const group: string[] = [];
      dfsGroup(id, group);
      group.sort((a, b) => {
        const blockA = graph.blocks.get(a);
        const blockB = graph.blocks.get(b);
        return (blockA?.number || 0) - (blockB?.number || 0);
      });
      groups.push(group);
    }
  });

  // 2) Строим связи между группами по валидным направленным связям (выход->вход).
  const groupIndexByBlockId = new Map<string, number>();
  groups.forEach((group, idx) => {
    group.forEach((blockId) => groupIndexByBlockId.set(blockId, idx));
  });

  const groupEdges = new Map<number, Set<number>>();
  const indegree = new Map<number, number>();
  for (let i = 0; i < groups.length; i++) {
    groupEdges.set(i, new Set());
    indegree.set(i, 0);
  }

  component.forEach((fromId) => {
    const fromGroup = groupIndexByBlockId.get(fromId);
    if (fromGroup === undefined) return;

    const out = graph.adjacency.get(fromId) || [];
    out.forEach(({ toId }) => {
      if (!component.includes(toId)) return;
      const toGroup = groupIndexByBlockId.get(toId);
      if (toGroup === undefined || toGroup === fromGroup) return;

      const edges = groupEdges.get(fromGroup);
      if (!edges?.has(toGroup)) {
        edges?.add(toGroup);
        indegree.set(toGroup, (indegree.get(toGroup) || 0) + 1);
      }
    });
  });

  // 3) Топологический порядок групп (для красивой формулы). Если есть цикл — fallback по номеру блока.
  const queue: number[] = [];
  indegree.forEach((deg, idx) => {
    if (deg === 0) queue.push(idx);
  });

  const orderedIdx: number[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    orderedIdx.push(current);

    const nextSet = groupEdges.get(current) || new Set<number>();
    nextSet.forEach((next) => {
      const nextDeg = (indegree.get(next) || 0) - 1;
      indegree.set(next, nextDeg);
      if (nextDeg === 0) queue.push(next);
    });
  }

  const orderedGroups =
    orderedIdx.length === groups.length
      ? orderedIdx.map((idx) => groups[idx])
      : [...groups].sort((a, b) => {
          const firstA = graph.blocks.get(a[0])?.number || 0;
          const firstB = graph.blocks.get(b[0])?.number || 0;
          return firstA - firstB;
        });

  // 4) Надежность компонента: последовательное произведение надежностей групп,
  // где группа > 1 блока считается параллельно.
  const reliability = orderedGroups.reduce((acc, group) => {
    if (group.length === 1) {
      const block = graph.blocks.get(group[0]);
      return acc * (block?.reliability || 0);
    }
    return acc * calculateParallelReliability(group, graph);
  }, 1);

  return {
    groups,
    orderedGroups,
    reliability: roundTo(reliability),
  };
}

/**
 * Рассчитываем надежность системы с резервированием по формуле Бернулли
 */
function calculateSystemWithReserve(
  mainChain: string[],
  reserveBlocks: string[],
  graph: ConnectionGraph,
): {
  reliability: number;
  minRequired: number;
  total: number;
  exactKProbabilities: number[];
} {
  const allBlocks = [...mainChain, ...reserveBlocks];
  const n = allBlocks.length; // Общее количество блоков
  const minRequired = mainChain.length; // Минимум нужно столько, сколько в основной цепи

  // Универсально считаем для разных p_i: сначала P(k,n), потом суммируем k >= minRequired
  const probabilities = allBlocks
    .map((id) => graph.blocks.get(id)?.reliability)
    .filter((p): p is number => typeof p === "number");

  const exactKProbabilities = calculateExactKProbabilities(probabilities);

  // G_np = P(minRequired, n) + P(minRequired+1, n) + ... + P(n, n)
  let totalReliability = 0;
  for (let k = minRequired; k <= n; k++) {
    totalReliability += exactKProbabilities[k] || 0;
  }

  return {
    reliability: roundTo(totalReliability),
    minRequired,
    total: n,
    exactKProbabilities: exactKProbabilities.map((v) => roundTo(v)),
  };
}

/**
 * Получает ВАЛИДНЫЕ входные соседи (те, кто подключил свой ВЫХОД к моему ВХОДУ)
 */
function getValidInputs(blockId: string, connections: Connection[]): string[] {
  const inputs: string[] = [];

  connections.forEach((conn) => {
    // Ищем связи где чей-то выход (right) подключен к моему входу (left)
    if (
      conn.toBlockId === blockId &&
      conn.toSide === "left" &&
      conn.fromSide === "right"
    ) {
      inputs.push(conn.fromBlockId);
    }
    if (
      conn.fromBlockId === blockId &&
      conn.fromSide === "left" &&
      conn.toSide === "right"
    ) {
      inputs.push(conn.toBlockId);
    }
  });

  return [...new Set(inputs)];
}

/**
 * Проверяет, подключен ли блок (является частью рабочей схемы)
 */
export function isBlockConnected(
  blockId: string,
  blocks: Block[],
  connections: Connection[],
  isReserve: boolean,
): boolean {
  // 1. Резервный блок всегда активен
  if (isReserve) return true;

  const nonReserveBlocks = blocks.filter((b) => !b.isReserve);

  // 2. Если это единственный нерезервный блок - он активен
  if (nonReserveBlocks.length === 1) {
    return nonReserveBlocks[0].id === blockId;
  }

  // 3. Блок с минимальным номером (первый добавленный) активен если:
  //    - Нет связей (только что добавили второй блок) - первый остается активным
  //    - Есть хотя бы одна связь
  const minNumber = Math.min(...nonReserveBlocks.map((b) => b.number));
  const thisBlock = blocks.find((b) => b.id === blockId);

  if (thisBlock && thisBlock.number === minNumber) {
    // Первый блок всегда активен (он начало любой цепи)
    return true;
  }

  // 4. Для остальных блоков проверяем несколько вариантов активации
  const validInputs = getValidInputs(blockId, connections);

  // 4.1. Если есть валидный вход - блок активен (последовательное соединение)
  if (validInputs.length > 0) {
    return true;
  }

  // 4.2. Проверяем параллельное соединение
  // Блок параллелен, если он соединен left-to-left с активным блоком
  // И имеет любое right-соединение (параллельная ветка)
  const leftConnections = connections.filter(
    (c) =>
      ((c.fromBlockId === blockId && c.fromSide === "left") ||
        (c.toBlockId === blockId && c.toSide === "left")) &&
      c.fromSide === "left" &&
      c.toSide === "left",
  );

  const rightConnections = connections.filter(
    (c) =>
      ((c.fromBlockId === blockId && c.fromSide === "right") ||
        (c.toBlockId === blockId && c.toSide === "right")) &&
      c.fromSide === "right" &&
      c.toSide === "right",
  );

  // Если есть left-to-left И right-to-right соединения
  if (leftConnections.length > 0 && rightConnections.length > 0) {
    // Проверяем, соединен ли с активным блоком
    for (const leftConn of leftConnections) {
      const neighborId =
        leftConn.fromBlockId === blockId
          ? leftConn.toBlockId
          : leftConn.fromBlockId;
      const neighborBlock = blocks.find((b) => b.id === neighborId);

      // Если сосед активен (рекурсивная проверка с защитой от бесконечной рекурсии)
      if (neighborBlock && !neighborBlock.isReserve) {
        // Проверяем, является ли сосед первым блоком или имеет валидный вход
        const neighborValidInputs = getValidInputs(neighborId, connections);
        const isFirstBlock = neighborBlock.number === minNumber;

        if (isFirstBlock || neighborValidInputs.length > 0) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Генерирует формулу для расчета надежности в HTML формате
 */
export function generateReliabilityFormula(
  blocks: Block[],
  connections: Connection[],
): { general: string; withValues: string } {
  if (blocks.length === 0) {
    return { general: "G = 0", withValues: "G = 0" };
  }

  const mainBlocks = blocks.filter((b) => !b.isReserve);
  const reserveBlocks = blocks.filter((b) => b.isReserve === true);

  if (mainBlocks.length === 0) {
    return { general: "G = 0", withValues: "G = 0" };
  }

  const graph = buildGraph(blocks, connections);

  // Отдельная формула для системы с резервированием: G_np = Σ P(k,n), k=minRequired..n
  if (reserveBlocks.length > 0) {
    const mainIds = mainBlocks.map((b) => b.id);
    const reserveIds = reserveBlocks.map((b) => b.id);
    const reserveResult = calculateSystemWithReserve(
      mainIds,
      reserveIds,
      graph,
    );
    const { minRequired, total, exactKProbabilities } = reserveResult;

    const kValues: number[] = [];
    for (let k = minRequired; k <= total; k++) {
      kValues.push(k);
    }

    const general = `G<sub>np</sub> = ${kValues
      .map((k) => `P<sub>${k},${total}</sub>`)
      .join(" + ")}`;

    const probs = [...mainBlocks, ...reserveBlocks].map((b) => b.reliability);
    const allEqual = probs.every((p) => Math.abs(p - probs[0]) < 1e-12);

    if (allEqual) {
      const p = probs[0];
      const q = 1 - p;
      const expandedLines = kValues
        .map((k) => {
          const value = bernoulliProbability(total, k, p);
          return `P<sub>${k},${total}</sub> = C<sub>${total}</sub><sup>${k}</sup> × ${formatTo(p)}<sup>${k}</sup> × ${formatTo(q)}<sup>${total - k}</sup> = ${formatTo(value)}`;
        })
        .join("<br/>");

      const sumLine = `G<sub>np</sub> = ${kValues
        .map((k) => `P<sub>${k},${total}</sub>`)
        .join(" + ")} = ${kValues
        .map((k) => formatTo(exactKProbabilities[k] || 0))
        .join(" + ")} = ${formatTo(reserveResult.reliability)}`;

      return {
        general,
        withValues: `${expandedLines}<br/>${sumLine}`,
      };
    }

    const lines = kValues
      .map(
        (k) =>
          `P<sub>${k},${total}</sub> = ${formatTo(exactKProbabilities[k] || 0)}`,
      )
      .join("<br/>");

    const sumLine = `G<sub>np</sub> = ${kValues
      .map((k) => `P<sub>${k},${total}</sub>`)
      .join(" + ")} = ${kValues
      .map((k) => formatTo(exactKProbabilities[k] || 0))
      .join(" + ")} = ${formatTo(reserveResult.reliability)}`;

    return {
      general,
      withValues: `${lines}<br/>${sumLine}`,
    };
  }

  const visited = new Set<string>();
  const components: string[][] = [];

  function dfs(blockId: string, component: string[]) {
    if (visited.has(blockId)) return;
    const block = graph.blocks.get(blockId);
    if (!block || block.isReserve) return;

    visited.add(blockId);
    component.push(blockId);

    // Ищем ВСЕ связанные блоки
    connections.forEach((conn) => {
      let neighborId: string | null = null;
      if (conn.fromBlockId === blockId) {
        neighborId = conn.toBlockId;
      } else if (conn.toBlockId === blockId) {
        neighborId = conn.fromBlockId;
      }

      if (neighborId && !visited.has(neighborId)) {
        const neighborBlock = graph.blocks.get(neighborId);
        if (neighborBlock && !neighborBlock.isReserve) {
          dfs(neighborId, component);
        }
      }
    });
  }

  mainBlocks.forEach((block) => {
    if (!visited.has(block.id)) {
      const component: string[] = [];
      dfs(block.id, component);
      if (component.length > 0) {
        components.push(component);
      }
    }
  });

  // Анализируем все компоненты и собираем общую формулу
  if (components.length > 0) {
    const componentFormulas = components.map((component) => {
      const analysis = analyzeComponent(component, graph, connections);

      const generalPart = analysis.orderedGroups
        .map((group) => {
          if (group.length === 1) {
            const block = graph.blocks.get(group[0])!;
            return `p<sub>${block.number}</sub>`;
          }

          const parallelTerms = group
            .map((id) => {
              const block = graph.blocks.get(id)!;
              return `(1 - p<sub>${block.number}</sub>)`;
            })
            .join(" × ");

          return `[1 - ${parallelTerms}]`;
        })
        .join(" × ");

      const valuesPart = analysis.orderedGroups
        .map((group) => {
          if (group.length === 1) {
            const block = graph.blocks.get(group[0])!;
            return `${formatTo(block.reliability)}`;
          }

          const parallelTerms = group
            .map((id) => {
              const block = graph.blocks.get(id)!;
              return `(1 - ${formatTo(block.reliability)})`;
            })
            .join(" × ");

          return `[1 - ${parallelTerms}]`;
        })
        .join(" × ");

      return { generalPart, valuesPart };
    });

    return {
      general: `G = ${componentFormulas.map((f) => f.generalPart).join(" × ")}`,
      withValues: `G = ${componentFormulas.map((f) => f.valuesPart).join(" × ")}`,
    };
  }

  return { general: "G = 0", withValues: "G = 0" };
}

/**
 * Основная функция расчета надежности системы
 */
export function calculateSystemReliability(
  blocks: Block[],
  connections: Connection[],
): {
  systemReliability: number;
  details: {
    chains: Array<{
      blocks: string[];
      reliability: number;
      reserves: string[];
      withReserveReliability: number;
    }>;
    parallelGroups: Array<{
      blocks: string[];
      reliability: number;
    }>;
  };
} {
  if (blocks.length === 0) {
    return {
      systemReliability: 0,
      details: { chains: [], parallelGroups: [] },
    };
  }

  // Фильтруем только подключенные блоки (с хотя бы 1 связью, единственные или резервные)
  const connectedBlocks = blocks.filter((b) =>
    isBlockConnected(b.id, blocks, connections, b.isReserve || false),
  );

  if (connectedBlocks.length === 0) {
    return {
      systemReliability: 0,
      details: { chains: [], parallelGroups: [] },
    };
  }

  // Разделяем блоки на основные и резервные
  const reserveBlocks = connectedBlocks.filter((b) => b.isReserve === true);
  const mainBlocks = connectedBlocks.filter((b) => !b.isReserve);

  if (mainBlocks.length === 0) {
    return {
      systemReliability: 0,
      details: { chains: [], parallelGroups: [] },
    };
  }

  const graph = buildGraph(blocks, connections);

  // Находим все связанные компоненты среди основных блоков
  // Используем ВСЕ связи (включая параллельные) для определения компонентов
  const visited = new Set<string>();
  const components: string[][] = [];

  function dfs(blockId: string, component: string[]) {
    if (visited.has(blockId)) return;
    const block = graph.blocks.get(blockId);
    if (!block || block.isReserve) return;

    visited.add(blockId);
    component.push(blockId);

    // Ищем ВСЕ связанные блоки (не только по валидным связям)
    connections.forEach((conn) => {
      let neighborId: string | null = null;

      if (conn.fromBlockId === blockId) {
        neighborId = conn.toBlockId;
      } else if (conn.toBlockId === blockId) {
        neighborId = conn.fromBlockId;
      }

      if (neighborId && !visited.has(neighborId)) {
        const neighborBlock = graph.blocks.get(neighborId);
        if (neighborBlock && !neighborBlock.isReserve) {
          dfs(neighborId, component);
        }
      }
    });
  }

  // Для каждого основного блока находим его компонент связности
  mainBlocks.forEach((block) => {
    if (!visited.has(block.id)) {
      const component: string[] = [];
      dfs(block.id, component);
      if (component.length > 0) {
        components.push(component);
      }
    }
  });

  const componentAnalyses = components.map((component) =>
    analyzeComponent(component, graph, connections),
  );
  const componentReliabilities = componentAnalyses.map(
    (analysis) => analysis.reliability,
  );

  // Если есть резервные блоки, применяем формулу Бернулли
  let systemReliability = 0;
  if (reserveBlocks.length > 0) {
    // Берем основную систему (все основные блоки)
    const allMainIds = mainBlocks.map((b) => b.id);
    const allReserveIds = reserveBlocks.map((b) => b.id);
    const result = calculateSystemWithReserve(allMainIds, allReserveIds, graph);
    systemReliability = roundTo(result.reliability);
  } else {
    // Без резерва - берем минимальную надежность среди компонентов
    // (система работает только если работают ВСЕ компоненты)
    if (componentReliabilities.length > 0) {
      if (components.length === 1) {
        systemReliability = roundTo(componentReliabilities[0]);
      } else {
        // Последовательное соединение компонентов
        systemReliability = roundTo(
          componentReliabilities.reduce((acc, r) => acc * r, 1),
        );
      }
    }
  }

  // Формируем детали для отображения
  const chainDetails = components.map((component, idx) => {
    const chainReliability = componentReliabilities[idx];
    const reserves = reserveBlocks.map((b) => b.id);
    const withReserve =
      reserves.length > 0
        ? calculateSystemWithReserve(component, reserves, graph)
        : {
            reliability: chainReliability,
            minRequired: 0,
            total: 0,
            exactKProbabilities: [],
          };

    return {
      blocks: component,
      reliability: roundTo(chainReliability),
      reserves,
      withReserveReliability: roundTo(withReserve.reliability),
    };
  });

  return {
    systemReliability: roundTo(systemReliability),
    details: {
      chains: chainDetails,
      parallelGroups: componentAnalyses.flatMap((analysis) =>
        analysis.groups
          .filter((group) => group.length > 1)
          .map((group) => ({
            blocks: group,
            reliability: roundTo(calculateParallelReliability(group, graph)),
          })),
      ),
    },
  };
}
