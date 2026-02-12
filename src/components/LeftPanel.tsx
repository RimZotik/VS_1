import React from "react";
import { Block } from "../types";
import { normalizeReliability, getConnectionType } from "../utils";

interface LeftPanelProps {
  blocks: Block[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onUpdateBlock: (id: string, updates: Partial<Block>) => void;
}

const LeftPanel: React.FC<LeftPanelProps> = ({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onUpdateBlock,
}) => {
  const selectedBlock = blocks.find((b) => b.id === selectedBlockId);

  const handleReliabilityChange = (blockId: string, value: string) => {
    const normalized = normalizeReliability(value);
    onUpdateBlock(blockId, { reliability: normalized });
  };

  const getBlockConnections = (block: Block) => {
    const connections = blocks
      .filter(b => b.id !== block.id)
      .map(b => ({
        block: b,
        type: getConnectionType(block, b)
      }))
      .filter(c => c.type !== null);
    
    return connections;
  };

  return (
    <div className="left-panel">
      <div className="panel-section">
        <h2>Блоки процессоров</h2>
        {blocks.length === 0 ? (
          <p style={{ color: "#858585", fontSize: "13px" }}>
            Нет блоков. Используйте кнопку "Добавить блок" справа.
          </p>
        ) : (
          <div className="block-list">
            {blocks.map((block) => {
              const connections = getBlockConnections(block);
              return (
                <div
                  key={block.id}
                  className={`block-item ${selectedBlockId === block.id ? "selected" : ""}`}
                  onClick={() => onSelectBlock(block.id)}
                >
                  <div className="block-item-header">
                    <span className="block-id">
                      Блок #{block.id.split('-')[1].substring(0, 4)}
                    </span>
                  </div>
                  <div className="block-details">
                    <div>Надежность: {block.reliability.toFixed(2)}</div>
                    <div>Позиция: ({block.x}, {block.y})</div>
                    {connections.length > 0 && (
                      <div style={{ marginTop: '4px', fontSize: '11px', color: '#4ec9b0' }}>
                        {connections.length} связ{connections.length === 1 ? 'ь' : 'и'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedBlock && (
        <div className="panel-section">
          <h2>Свойства блока</h2>
          <div className="property-input">
            <label>Надежность процессора (0-1):</label>
            <input
              type="text"
              value={selectedBlock.reliability}
              onChange={(e) => handleReliabilityChange(selectedBlock.id, e.target.value)}
              onBlur={(e) => {
                // При потере фокуса нормализуем значение
                const normalized = normalizeReliability(e.target.value);
                onUpdateBlock(selectedBlock.id, { reliability: normalized });
              }}
              placeholder="0.95"
            />
          </div>

          <div className="property-input">
            <label>Связи с другими блоками:</label>
            <div style={{ fontSize: '13px', color: '#cccccc' }}>
              {getBlockConnections(selectedBlock).map((conn, idx) => {
                const typeLabel = 
                  conn.type === 'sequential' ? 'Последовательно' :
                  conn.type === 'parallel' ? 'Параллельно' :
                  conn.type === 'reserve' ? 'Резерв' : '';
                return (
                  <div key={idx} style={{ 
                    padding: '6px 8px', 
                    background: '#2d2d30', 
                    borderRadius: '4px', 
                    marginBottom: '6px' 
                  }}>
                    {typeLabel} → Блок #{conn.block.id.split('-')[1].substring(0, 4)}
                  </div>
                );
              })}
              {getBlockConnections(selectedBlock).length === 0 && (
                <div style={{ color: '#858585', fontStyle: 'italic' }}>
                  Нет связей
                </div>
              )}
            </div>
            <div style={{ 
              marginTop: '12px', 
              padding: '10px', 
              background: '#2d2d30', 
              borderRadius: '4px',
              fontSize: '12px',
              color: '#858585'
            }}>
              <strong>Правила связей:</strong>
              <ul style={{ marginTop: '6px', marginLeft: '16px' }}>
                <li>Последовательно: на одном Y</li>
                <li>Параллельно: через 1 клетку по Y</li>
                <li>Резерв: через 2 клетки по Y</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="panel-section calculations-section">
        <h2>Расчеты системы</h2>
        <p style={{ color: "#858585", fontSize: "13px", marginBottom: "15px" }}>
          Оценка для каждого количества процессоров от 1 до 6
        </p>

        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div key={n} className="calculation-row">
            <strong>N = {n}</strong>
            <div
              style={{
                marginTop: "6px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              <div>P_np: - </div>
              <div>G_np: - </div>
              <div>E_np: - </div>
              <div>Память: - </div>
              <div>УВВ: - </div>
              <div>G_вс: - </div>
              <div>E_вс: - </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LeftPanel;
