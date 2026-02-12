import React, { useState, useRef } from "react";
import { Block } from "../types";
import { findConnections } from "../utils";

interface GridCanvasProps {
  blocks: Block[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onUpdateBlock: (id: string, updates: Partial<Block>) => void;
  onAddBlock: () => void;
  onDeleteBlock: () => void;
}

const CELL_SIZE = 40; // размер одной клетки
const BLOCK_SIZE = 2; // блок занимает 2x2 клетки

const GridCanvas: React.FC<GridCanvasProps> = ({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onUpdateBlock,
  onAddBlock,
  onDeleteBlock,
}) => {
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const gridRef = useRef<HTMLDivElement>(null);

  const connections = findConnections(blocks);

  const handleMouseDown = (e: React.MouseEvent, blockId: string) => {
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
    }
  };

  // Функция для отрисовки линии между двумя блоками
  const renderConnection = (from: Block, to: Block, type: string) => {
    // Центр блока = позиция + половина размера блока
    const fromCenterX = (from.x + BLOCK_SIZE / 2) * CELL_SIZE;
    const fromCenterY = (from.y + BLOCK_SIZE / 2) * CELL_SIZE;
    const toCenterX = (to.x + BLOCK_SIZE / 2) * CELL_SIZE;
    const toCenterY = (to.y + BLOCK_SIZE / 2) * CELL_SIZE;

    const color = 
      type === 'sequential' ? '#4ec9b0' :
      type === 'parallel' ? '#9b59b6' :
      type === 'reserve' ? '#f39c12' : '#666';

    const strokeWidth = type === 'sequential' ? 3 : 2;
    const dashArray = 
      type === 'parallel' ? '5,5' :
      type === 'reserve' ? '2,4' : 'none';

    return (
      <line
        x1={fromCenterX}
        y1={fromCenterY}
        x2={toCenterX}
        y2={toCenterY}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={dashArray}
        opacity={0.8}
      />
    );
  };

  return (
    <div className="grid-canvas">
      <div className="canvas-controls">
        <button className="control-button" onClick={onAddBlock}>
          ➕ Добавить блок
        </button>
        <button
          className="control-button delete"
          onClick={onDeleteBlock}
          disabled={!selectedBlockId}
        >
          🗑️ Удалить
        </button>
      </div>

      <div className="grid-viewport">
        <div
          ref={gridRef}
          className="grid-container"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleCanvasClick}
        >
          {/* SVG слой для линий связи */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            {connections.map((conn, idx) => (
              <g key={idx}>
                {renderConnection(conn.from, conn.to, conn.type!)}
              </g>
            ))}
          </svg>

          {/* Блоки */}
          {blocks.map((block) => (
            <div
              key={block.id}
              className={`grid-block ${selectedBlockId === block.id ? "selected" : ""} ${
                draggingBlockId === block.id ? "dragging" : ""
              }`}
              style={{
                left: block.x * CELL_SIZE,
                top: block.y * CELL_SIZE,
                width: BLOCK_SIZE * CELL_SIZE,
                height: BLOCK_SIZE * CELL_SIZE,
                backgroundColor: '#0e639c',
                zIndex: 10,
              }}
              onMouseDown={(e) => handleMouseDown(e, block.id)}
            >
              <span className="block-label">
                Блок #{block.id.split('-')[1].substring(0, 4)}
              </span>
              <span className="block-info">
                R: {block.reliability.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GridCanvas;
