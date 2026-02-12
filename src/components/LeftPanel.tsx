import React from "react";
import { Block, Connection } from "../types";
import { normalizeReliability } from "../utils";

interface LeftPanelProps {
  blocks: Block[];
  connections: Connection[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onUpdateBlock: (id: string, updates: Partial<Block>) => void;
  onDeleteConnection: (id: string) => void;
}

const LeftPanel: React.FC<LeftPanelProps> = ({
  blocks,
  connections,
  selectedBlockId,
  onSelectBlock,
  onUpdateBlock,
  onDeleteConnection,
}) => {
  const selectedBlock = blocks.find((b) => b.id === selectedBlockId);

  const handleReliabilityChange = (blockId: string, value: string) => {
    const normalized = normalizeReliability(value);
    onUpdateBlock(blockId, { reliability: normalized });
  };

  return (
    <div className="left-panel">
      {/* Информация о системе */}
      <div className="panel-section system-info">
        <h2>Информация о системе</h2>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Блоков:</span>
            <span className="info-value">{blocks.length}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Связей:</span>
            <span className="info-value">{connections.length}</span>
          </div>
          <div className="info-item">
            <span className="info-label">P_np:</span>
            <span className="info-value">-</span>
          </div>
          <div className="info-item">
            <span className="info-label">G_np:</span>
            <span className="info-value">-</span>
          </div>
          <div className="info-item">
            <span className="info-label">E_np:</span>
            <span className="info-value">-</span>
          </div>
          <div className="info-item">
            <span className="info-label">Память:</span>
            <span className="info-value">-</span>
          </div>
          <div className="info-item">
            <span className="info-label">G_вс:</span>
            <span className="info-value">-</span>
          </div>
          <div className="info-item">
            <span className="info-label">E_вс:</span>
            <span className="info-value">-</span>
          </div>
        </div>
      </div>

      {/* Список блоков */}
      <div className="panel-section">
        <h2>Блоки</h2>
        {blocks.length === 0 ? (
          <p style={{ color: "#858585", fontSize: "13px" }}>Нет блоков</p>
        ) : (
          <div className="block-list-compact">
            {blocks.map((block) => (
              <div
                key={block.id}
                className={`block-item-compact ${selectedBlockId === block.id ? "selected" : ""}`}
                onClick={() => onSelectBlock(block.id)}
              >
                <span className="block-number-label">#{block.number}</span>
                <span className="block-reliability-value">
                  {block.reliability.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Список связей */}
      <div className="panel-section">
        <h2>Связи</h2>
        {connections.length === 0 ? (
          <p style={{ color: "#858585", fontSize: "13px" }}>
            Нет связей. Кликните на точку блока, затем на точку другого блока.
          </p>
        ) : (
          <div className="connections-list">
            {connections.map((conn) => {
              const fromBlock = blocks.find((b) => b.id === conn.fromBlockId);
              const toBlock = blocks.find((b) => b.id === conn.toBlockId);
              if (!fromBlock || !toBlock) return null;

              return (
                <div key={conn.id} className="connection-item">
                  <span>
                    #{fromBlock.number}({conn.fromSide}) → #{toBlock.number}(
                    {conn.toSide})
                  </span>
                  <button
                    className="delete-connection-btn"
                    onClick={() => onDeleteConnection(conn.id)}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Свойства выбранного блока */}
      {selectedBlock && (
        <div className="panel-section">
          <h2>Редактирование блока #{selectedBlock.number}</h2>
          <div className="property-input">
            <label>Надежность (0-1):</label>
            <input
              type="text"
              value={selectedBlock.reliability}
              onChange={(e) =>
                handleReliabilityChange(selectedBlock.id, e.target.value)
              }
              onBlur={(e) => {
                const normalized = normalizeReliability(e.target.value);
                onUpdateBlock(selectedBlock.id, { reliability: normalized });
              }}
              placeholder="0.95"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default LeftPanel;
