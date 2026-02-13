import React, { useState, useRef } from "react";
import { Block, Connection } from "../types";
import { isBlockConnected } from "../calculations";

interface GridCanvasProps {
  blocks: Block[];
  connections: Connection[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onUpdateBlock: (id: string, updates: Partial<Block>) => void;
  onAddBlock: () => void;
  onDeleteBlock: () => void;
  onAddConnection: (connection: Connection) => void;
  onDeleteConnection: (id: string) => void;
}

const CELL_SIZE = 40; // размер одной клетки
const BLOCK_SIZE = 2; // блок занимает 2x2 клетки

interface ConnectionPoint {
  blockId: string;
  side: "left" | "right";
}

const GridCanvas: React.FC<GridCanvasProps> = ({
  blocks,
  connections,
  selectedBlockId,
  onSelectBlock,
  onUpdateBlock,
  onAddBlock,
  onDeleteBlock,
  onAddConnection,
  onDeleteConnection,
}) => {
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState<ConnectionPoint | null>(
    null,
  );
  const [selectedConnectionId, setSelectedConnectionId] = useState<
    string | null
  >(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const gridRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent, blockId: string) => {
    // Проверяем, не клик ли по точке соединения
    const target = e.target as HTMLElement;
    if (target.classList.contains("connection-point")) {
      return; // Не начинаем перетаскивание, если кликнули по точке
    }

    e.stopPropagation();
    onSelectBlock(blockId);
    setDraggingBlockId(blockId);

    const block = blocks.find((b) => b.id === blockId);
    if (block && gridRef.current) {
      const rect = gridRef.current.getBoundingClientRect();
      const blockPixelX = block.x * CELL_SIZE;
      const blockPixelY = block.y * CELL_SIZE;
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      setDragOffset({
        x: mouseX - blockPixelX,
        y: mouseY - blockPixelY,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (gridRef.current) {
      const rect = gridRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      setMousePos({ x: mouseX, y: mouseY });
    }

    if (draggingBlockId && gridRef.current) {
      const rect = gridRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left - dragOffset.x;
      const mouseY = e.clientY - rect.top - dragOffset.y;

      // Привязка к сетке
      const gridX = Math.max(0, Math.round(mouseX / CELL_SIZE));
      const gridY = Math.max(0, Math.round(mouseY / CELL_SIZE));

      onUpdateBlock(draggingBlockId, { x: gridX, y: gridY });
    }
  };

  const handleMouseUp = () => {
    setDraggingBlockId(null);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onSelectBlock(null);
      setSelectedConnectionId(null);
      // Сброс создания связи при клике в пустое место
      if (connectingFrom) {
        setConnectingFrom(null);
      }
    }
  };

  const handleConnectionPointClick = (
    e: React.MouseEvent,
    blockId: string,
    side: "left" | "right",
  ) => {
    e.stopPropagation();

    if (!connectingFrom) {
      // Начинаем создание связи
      setConnectingFrom({ blockId, side });
    } else {
      // Проверяем, не та же ли это точка или точка того же блока
      if (connectingFrom.blockId === blockId) {
        // Нельзя соединять блок с самим собой
        setConnectingFrom(null);
        return;
      }

      // Проверяем, не существует ли уже такая связь
      const existingConnection = connections.find(
        (conn) =>
          (conn.fromBlockId === connectingFrom.blockId &&
            conn.toBlockId === blockId &&
            conn.fromSide === connectingFrom.side &&
            conn.toSide === side) ||
          (conn.fromBlockId === blockId &&
            conn.toBlockId === connectingFrom.blockId &&
            conn.fromSide === side &&
            conn.toSide === connectingFrom.side),
      );

      if (existingConnection) {
        setConnectingFrom(null);
        return;
      }

      // Создаем новую связь
      const newConnection: Connection = {
        id: `conn-${Date.now()}`,
        fromBlockId: connectingFrom.blockId,
        toBlockId: blockId,
        fromSide: connectingFrom.side,
        toSide: side,
      };

      onAddConnection(newConnection);
      setConnectingFrom(null);
    }
  };

  // Функция для отрисовки линии между точками
  const renderConnection = (conn: Connection) => {
    const fromBlock = blocks.find((b) => b.id === conn.fromBlockId);
    const toBlock = blocks.find((b) => b.id === conn.toBlockId);

    if (!fromBlock || !toBlock) return null;

    // Вычисляем координаты на границах блоков (не точек)
    const fromEdgeX = getBlockEdgeX(fromBlock, conn.fromSide);
    const fromEdgeY = getConnectionPointY(fromBlock);
    const toEdgeX = getBlockEdgeX(toBlock, conn.toSide);
    const toEdgeY = getConnectionPointY(toBlock);

    // Отступ 1 клетка в сторону от границы блока
    const fromOffsetX =
      conn.fromSide === "left" ? fromEdgeX - CELL_SIZE : fromEdgeX + CELL_SIZE;
    const toOffsetX =
      conn.toSide === "left" ? toEdgeX - CELL_SIZE : toEdgeX + CELL_SIZE;

    // Ломаная линия: от границы блока -> 1 клетка в бок -> вертикально -> 1 клетка в бок -> до границы блока
    const pathData = `M ${fromEdgeX} ${fromEdgeY} L ${fromOffsetX} ${fromEdgeY} L ${fromOffsetX} ${toEdgeY} L ${toOffsetX} ${toEdgeY} L ${toEdgeX} ${toEdgeY}`;

    const isSelected = selectedConnectionId === conn.id;

    return (
      <g key={conn.id}>
        {/* Невидимая толстая линия для клика */}
        <path
          d={pathData}
          stroke="transparent"
          strokeWidth={10}
          fill="none"
          style={{ cursor: "pointer", pointerEvents: "all" }}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedConnectionId(conn.id);
          }}
        />
        {/* Видимая линия */}
        <path
          d={pathData}
          stroke={isSelected ? "#ffa500" : "#4ec9b0"}
          strokeWidth={isSelected ? 3 : 2}
          fill="none"
          style={{ pointerEvents: "none" }}
        />
      </g>
    );
  };

  const formatReliability = (value: number): string => {
    return value.toFixed(6).replace(/\.?0+$/, "");
  };

  // Функция для отрисовки временной линии во время создания связи
  const renderTemporaryConnection = () => {
    if (!connectingFrom) return null;

    const fromBlock = blocks.find((b) => b.id === connectingFrom.blockId);
    if (!fromBlock) return null;

    const fromEdgeX = getBlockEdgeX(fromBlock, connectingFrom.side);
    const fromEdgeY = getConnectionPointY(fromBlock);
    const fromOffsetX =
      connectingFrom.side === "left"
        ? fromEdgeX - CELL_SIZE
        : fromEdgeX + CELL_SIZE;
    const pathData = `M ${fromEdgeX} ${fromEdgeY} L ${fromOffsetX} ${fromEdgeY} L ${fromOffsetX} ${mousePos.y} L ${mousePos.x} ${mousePos.y}`;

    return (
      <path
        d={pathData}
        stroke="#4ec9b0"
        strokeWidth={2}
        strokeDasharray="5,5"
        opacity={0.6}
        fill="none"
      />
    );
  };

  // Получить X координату точки соединения (для отображения точки)
  const getConnectionPointX = (block: Block, side: "left" | "right") => {
    if (side === "left") {
      // Левая точка: минимум 1 клетка от границы блока
      return (block.x - 1) * CELL_SIZE;
    } else {
      // Правая точка: минимум 1 клетка от границы блока
      return (block.x + BLOCK_SIZE + 1) * CELL_SIZE;
    }
  };

  // Получить X координату границы блока (для линий)
  const getBlockEdgeX = (block: Block, side: "left" | "right") => {
    if (side === "left") {
      // Левая граница блока
      return block.x * CELL_SIZE;
    } else {
      // Правая граница блока
      return (block.x + BLOCK_SIZE) * CELL_SIZE;
    }
  };

  // Получить Y координату точки соединения (вертикальный центр блока)
  const getConnectionPointY = (block: Block) => {
    return (block.y + BLOCK_SIZE / 2) * CELL_SIZE;
  };

  // Рендерим сетку линий
  const renderGrid = () => {
    const lines = [];
    const gridWidth = 1200;
    const gridHeight = 800;

    for (let x = 0; x <= gridWidth; x += CELL_SIZE) {
      lines.push(
        <line
          key={`v${x}`}
          x1={x}
          y1={0}
          x2={x}
          y2={gridHeight}
          stroke="#3e3e42"
          strokeWidth={1}
        />,
      );
    }

    for (let y = 0; y <= gridHeight; y += CELL_SIZE) {
      lines.push(
        <line
          key={`h${y}`}
          x1={0}
          y1={y}
          x2={gridWidth}
          y2={y}
          stroke="#3e3e42"
          strokeWidth={1}
        />,
      );
    }

    return lines;
  };

  return (
    <div className="canvas-container">
      <div className="canvas-toolbar">
        <button onClick={onAddBlock}>Добавить блок (A)</button>
        <button onClick={onDeleteBlock} disabled={!selectedBlockId}>
          Удалить блок (Delete)
        </button>
        <button
          onClick={() => {
            if (selectedConnectionId) {
              onDeleteConnection(selectedConnectionId);
              setSelectedConnectionId(null);
            }
          }}
          disabled={!selectedConnectionId}
          style={{ marginLeft: "auto" }}
        >
          Удалить связь
        </button>
      </div>
      <div
        ref={gridRef}
        className="grid-canvas"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleCanvasClick}
      >
        <svg
          width="1200"
          height="800"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",
          }}
        >
          {renderGrid()}
          {connections.map((conn) => renderConnection(conn))}
          {renderTemporaryConnection()}
        </svg>
        {blocks.map((block) => {
          const pixelX = block.x * CELL_SIZE;
          const pixelY = block.y * CELL_SIZE;
          const pixelSize = BLOCK_SIZE * CELL_SIZE;

          const leftPointX = getConnectionPointX(block, "left");
          const leftPointY = getConnectionPointY(block);
          const rightPointX = getConnectionPointX(block, "right");
          const rightPointY = getConnectionPointY(block);

          const isConnected = isBlockConnected(
            block.id,
            blocks,
            connections,
            block.isReserve || false,
          );
          const blockClass = `grid-block ${selectedBlockId === block.id ? "selected" : ""} ${block.isReserve ? "reserve" : ""} ${!isConnected ? "disconnected" : ""}`;

          return (
            <div key={block.id}>
              <div
                className={blockClass}
                style={{
                  left: `${pixelX}px`,
                  top: `${pixelY}px`,
                  width: `${pixelSize}px`,
                  height: `${pixelSize}px`,
                }}
                onMouseDown={(e) => handleMouseDown(e, block.id)}
              >
                <div className="block-number">#{block.number}</div>
                <div className="block-reliability">
                  {formatReliability(block.reliability)}
                </div>
              </div>
              {/* Левая точка соединения */}
              <div
                className={`connection-point ${connectingFrom?.blockId === block.id && connectingFrom?.side === "left" ? "active" : ""}`}
                style={{
                  left: `${leftPointX - 6}px`,
                  top: `${leftPointY - 6}px`,
                }}
                onClick={(e) => handleConnectionPointClick(e, block.id, "left")}
              />
              {/* Правая точка соединения */}
              <div
                className={`connection-point ${connectingFrom?.blockId === block.id && connectingFrom?.side === "right" ? "active" : ""}`}
                style={{
                  left: `${rightPointX - 6}px`,
                  top: `${rightPointY - 6}px`,
                }}
                onClick={(e) =>
                  handleConnectionPointClick(e, block.id, "right")
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GridCanvas;
