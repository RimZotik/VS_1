import React, { useState, useRef } from "react";
import { Block } from "../types";

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

  const getModeColor = (mode: string) => {
    switch (mode) {
      case "sequential":
        return "#0e639c";
      case "parallel":
        return "#8e44ad";
      case "reserve":
        return "#d68910";
      default:
        return "#0e639c";
    }
  };

  const getModeBadge = (mode: string) => {
    switch (mode) {
      case "sequential":
        return "ПОС";
      case "parallel":
        return "ПАР";
      case "reserve":
        return "РЕЗ";
      default:
        return "";
    }
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
                backgroundColor: getModeColor(block.mode),
              }}
              onMouseDown={(e) => handleMouseDown(e, block.id)}
            >
              <span className="mode-badge">{getModeBadge(block.mode)}</span>
              <span className="block-label">
                {block.id.replace("block-", "Блок #").substring(0, 15)}
              </span>
              <span className="block-info">
                R: {block.reliability} / P: {block.readiness}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GridCanvas;
