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
  mode: "groups" | "parallel-paths" | "reduced-sp";
  parallelPaths: string[][];
  reducedGeneral: string | null;
  reducedValues: string | null;
} {
  type SpEdge = {
    from: string;
    to: string;
    reliability: number;
    generalExpr: string;
    valueExpr: string;
  };

  // 0) Универсальная попытка свести компонент к series-parallel сети через шины.
  // Идея: объединяем эквипотенциальные точки (left-left, right-right, output-input),
  // затем редуцируем граф блоков правилами параллели и последовательности.
  const componentSet = new Set(component);

  const parent = new Map<string, string>();
  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x);
    const p = parent.get(x)!;
    if (p === x) return x;
    const root = find(p);
    parent.set(x, root);
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  const leftNode = (id: string) => `L:${id}`;
  const rightNode = (id: string) => `R:${id}`;

  component.forEach((id) => {
    find(leftNode(id));
    find(rightNode(id));
  });

  connections.forEach((conn) => {
    if (
      !componentSet.has(conn.fromBlockId) ||
      !componentSet.has(conn.toBlockId)
    ) {
      return;
    }

    // same-side bus connections
    if (conn.fromSide === "left" && conn.toSide === "left") {
      union(leftNode(conn.fromBlockId), leftNode(conn.toBlockId));
      return;
    }
    if (conn.fromSide === "right" && conn.toSide === "right") {
      union(rightNode(conn.fromBlockId), rightNode(conn.toBlockId));
      return;
    }

    // valid output-input connection => общая точка соединения
    if (conn.fromSide === "right" && conn.toSide === "left") {
      union(rightNode(conn.fromBlockId), leftNode(conn.toBlockId));
      return;
    }
    if (conn.fromSide === "left" && conn.toSide === "right") {
      union(rightNode(conn.toBlockId), leftNode(conn.fromBlockId));
    }
  });

  let spEdges: SpEdge[] = component
    .map((id) => {
      const block = graph.blocks.get(id)!;
      return {
        from: find(leftNode(id)),
        to: find(rightNode(id)),
        reliability: roundTo(block.reliability),
        generalExpr: `p<sub>${block.number}</sub>`,
        valueExpr: `${formatTo(block.reliability)}`,
      };
    })
    .filter((e) => e.from !== e.to);

  const reduceParallel = (
    edges: SpEdge[],
  ): { edges: SpEdge[]; changed: boolean } => {
    const buckets = new Map<string, SpEdge[]>();
    edges.forEach((e) => {
      const key = `${e.from}->${e.to}`;
      const list = buckets.get(key) || [];
      list.push(e);
      buckets.set(key, list);
    });

    let changed = false;
    const result: SpEdge[] = [];
    buckets.forEach((list) => {
      if (list.length === 1) {
        result.push(list[0]);
        return;
      }

      changed = true;
      const unreliability = list.reduce(
        (acc, e) => acc * (1 - e.reliability),
        1,
      );
      const reliability = roundTo(1 - unreliability);

      const generalExpr = `[1 - ${list
        .map((e) => `(1 - ${e.generalExpr})`)
        .join(" × ")}]`;
      const valueExpr = `[1 - ${list
        .map((e) => `(1 - ${e.valueExpr})`)
        .join(" × ")}]`;

      result.push({
        from: list[0].from,
        to: list[0].to,
        reliability,
        generalExpr,
        valueExpr,
      });
    });

    return { edges: result, changed };
  };

  const reduceSeries = (
    edges: SpEdge[],
  ): { edges: SpEdge[]; changed: boolean } => {
    const inMap = new Map<string, SpEdge[]>();
    const outMap = new Map<string, SpEdge[]>();
    const nodes = new Set<string>();

    edges.forEach((e) => {
      nodes.add(e.from);
      nodes.add(e.to);

      const inList = inMap.get(e.to) || [];
      inList.push(e);
      inMap.set(e.to, inList);

      const outList = outMap.get(e.from) || [];
      outList.push(e);
      outMap.set(e.from, outList);
    });

    const sourceNodes = [...nodes].filter(
      (n) => (inMap.get(n)?.length || 0) === 0,
    );
    const sinkNodes = [...nodes].filter(
      (n) => (outMap.get(n)?.length || 0) === 0,
    );
    const sourceSet = new Set(sourceNodes);
    const sinkSet = new Set(sinkNodes);

    for (const node of nodes) {
      if (sourceSet.has(node) || sinkSet.has(node)) continue;

      const ins = inMap.get(node) || [];
      const outs = outMap.get(node) || [];
      if (ins.length !== 1 || outs.length !== 1) continue;

      const inEdge = ins[0];
      const outEdge = outs[0];
      if (inEdge === outEdge) continue;

      const nextEdges = edges.filter((e) => e !== inEdge && e !== outEdge);
      nextEdges.push({
        from: inEdge.from,
        to: outEdge.to,
        reliability: roundTo(inEdge.reliability * outEdge.reliability),
        generalExpr: `${inEdge.generalExpr} × ${outEdge.generalExpr}`,
        valueExpr: `${inEdge.valueExpr} × ${outEdge.valueExpr}`,
      });

      return { edges: nextEdges, changed: true };
    }

    return { edges, changed: false };
  };

  if (spEdges.length > 0) {
    let changed = true;
    let safety = 0;

    while (changed && safety < 200) {
      safety += 1;
      changed = false;

      const p = reduceParallel(spEdges);
      spEdges = p.edges;
      changed = changed || p.changed;

      const s = reduceSeries(spEdges);
      spEdges = s.edges;
      changed = changed || s.changed;
    }

    if (spEdges.length === 1) {
      const e = spEdges[0];
      return {
        groups: [],
        orderedGroups: [],
        reliability: roundTo(e.reliability),
        mode: "reduced-sp",
        parallelPaths: [],
        reducedGeneral: e.generalExpr,
        reducedValues: e.valueExpr,
      };
    }
  }

  function isSameSideConnection(
    conn: Connection,
    side: "left" | "right",
  ): boolean {
    return conn.fromSide === side && conn.toSide === side;
  }

  function areBlocksBusConnected(
    ids: string[],
    side: "left" | "right",
  ): boolean {
    if (ids.length <= 1) return true;

    const set = new Set(ids);
    const adj = new Map<string, Set<string>>();
    ids.forEach((id) => adj.set(id, new Set()));

    connections.forEach((conn) => {
      if (!isSameSideConnection(conn, side)) return;
      if (!set.has(conn.fromBlockId) || !set.has(conn.toBlockId)) return;
      adj.get(conn.fromBlockId)?.add(conn.toBlockId);
      adj.get(conn.toBlockId)?.add(conn.fromBlockId);
    });

    const visitedBus = new Set<string>();
    const stack = [ids[0]];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (visitedBus.has(cur)) continue;
      visitedBus.add(cur);
      (adj.get(cur) || new Set<string>()).forEach((n) => {
        if (!visitedBus.has(n)) stack.push(n);
      });
    }

    return visitedBus.size === ids.length;
  }

  // 0) Спец-случай: несколько последовательных веток, включенных параллельно между общей левой и правой шинами.
  // Пример: (1->2) || (3->4)
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();
  const componentSetLegacy = new Set(component);
  component.forEach((id) => {
    inDegree.set(id, 0);
    outDegree.set(id, 0);
  });

  component.forEach((fromId) => {
    const out = graph.adjacency.get(fromId) || [];
    out.forEach(({ toId }) => {
      if (!componentSet.has(toId)) return;
      outDegree.set(fromId, (outDegree.get(fromId) || 0) + 1);
      inDegree.set(toId, (inDegree.get(toId) || 0) + 1);
    });
  });

  const entryBlocks = component.filter((id) => (inDegree.get(id) || 0) === 0);
  const exitBlocks = component.filter((id) => (outDegree.get(id) || 0) === 0);

  const hasEntryBus =
    entryBlocks.length > 1 && areBlocksBusConnected(entryBlocks, "left");
  const hasExitBus =
    exitBlocks.length > 1 && areBlocksBusConnected(exitBlocks, "right");

  if (hasEntryBus && hasExitBus) {
    const paths: string[][] = [];

    const dfsPath = (current: string, target: string, path: string[]) => {
      if (path.includes(current)) return;

      const nextPath = [...path, current];
      if (current === target) {
        paths.push(nextPath);
        return;
      }

      const out = graph.adjacency.get(current) || [];
      out.forEach(({ toId }) => {
        if (!componentSetLegacy.has(toId)) return;
        dfsPath(toId, target, nextPath);
      });
    };

    entryBlocks.forEach((startId) => {
      exitBlocks.forEach((endId) => {
        dfsPath(startId, endId, []);
      });
    });

    const uniquePathMap = new Map<string, string[]>();
    paths.forEach((p) => {
      uniquePathMap.set(p.join("->"), p);
    });
    const uniquePaths = [...uniquePathMap.values()];

    // Берем только пути, которые не содержат другие (защита от лишних обходов), и считаем параллелью,
    // если они попарно не пересекаются по блокам.
    const disjoint = uniquePaths.every((p, i) =>
      uniquePaths.every((q, j) => {
        if (i >= j) return true;
        return p.every((id) => !q.includes(id));
      }),
    );

    if (uniquePaths.length >= 2 && disjoint) {
      const branchReliabilities = uniquePaths.map((path) =>
        roundTo(
          path.reduce((acc, id) => {
            const block = graph.blocks.get(id);
            return acc * (block?.reliability || 0);
          }, 1),
        ),
      );

      const reliability = roundTo(
        1 -
          branchReliabilities.reduce((acc, r) => {
            return acc * (1 - r);
          }, 1),
      );

      return {
        groups: uniquePaths,
        orderedGroups: uniquePaths,
        reliability,
        mode: "parallel-paths",
        parallelPaths: uniquePaths,
        reducedGeneral: null,
        reducedValues: null,
      };
    }
  }

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
    mode: "groups",
    parallelPaths: [],
    reducedGeneral: null,
    reducedValues: null,
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

      if (analysis.mode === "reduced-sp") {
        return {
          generalPart: analysis.reducedGeneral || "0",
          valuesPart: analysis.reducedValues || "0",
        };
      }

      if (analysis.mode === "parallel-paths") {
        const branchGeneralTerms = analysis.parallelPaths
          .map((path) => {
            const seq = path
              .map((id) => {
                const block = graph.blocks.get(id)!;
                return `p<sub>${block.number}</sub>`;
              })
              .join(" × ");
            return `(1 - (${seq}))`;
          })
          .join(" × ");

        const branchValueTerms = analysis.parallelPaths
          .map((path) => {
            const seq = path
              .map((id) => {
                const block = graph.blocks.get(id)!;
                return `${formatTo(block.reliability)}`;
              })
              .join(" × ");
            return `(1 - (${seq}))`;
          })
          .join(" × ");

        return {
          generalPart: `[1 - ${branchGeneralTerms}]`,
          valuesPart: `[1 - ${branchValueTerms}]`,
        };
      }

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
        analysis.mode === "parallel-paths"
          ? []
          : analysis.groups
              .filter((group) => group.length > 1)
              .map((group) => ({
                blocks: group,
                reliability: roundTo(
                  calculateParallelReliability(group, graph),
                ),
              })),
      ),
    },
  };
}
