import React, { useMemo } from "react";
import { Block, Connection } from "../types";
import { normalizeReliability } from "../utils";
import {
  calculateSystemReliability,
  generateReliabilityFormula,
} from "../calculations";

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

  // Рассчитываем надежность системы
  const systemStats = useMemo(() => {
    if (blocks.length === 0) {
      return null;
    }
    return calculateSystemReliability(blocks, connections);
  }, [blocks, connections]);

  // Генерируем формулы
  const formulas = useMemo(() => {
    if (blocks.length === 0) {
      return null;
    }
    return generateReliabilityFormula(blocks, connections);
  }, [blocks, connections]);

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
            <span className="info-label">G_np:</span>
            <span className="info-value">
              {systemStats ? systemStats.systemReliability.toFixed(6) : "-"}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">E_np:</span>
            <span className="info-value">
              {systemStats && blocks.length > 0
                ? (systemStats.systemReliability / blocks.length).toFixed(6)
                : "-"}
            </span>
          </div>
          <div className="info-item" style={{ gridColumn: "1 / -1" }}>
            <span className="info-label">Надежность системы:</span>
            <span
              className="info-value"
              style={{ fontSize: "18px", color: "#4ec9b0" }}
            >
              {systemStats
                ? (systemStats.systemReliability * 100).toFixed(2) + "%"
                : "-"}
            </span>
          </div>
        </div>

        {/* Детали расчетов */}
        {systemStats && formulas && (
          <div style={{ marginTop: "15px" }}>
            <h3
              style={{
                fontSize: "14px",
                marginBottom: "10px",
                color: "#cccccc",
              }}
            >
              Детали расчетов:
            </h3>

            {/* Формулы */}
            <div
              className="formula-block"
              style={{
                backgroundColor: "#2d2d2d",
                padding: "12px",
                borderRadius: "4px",
                marginBottom: "10px",
                border: "1px solid #3e3e42",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  color: "#858585",
                  marginBottom: "6px",
                }}
              >
                Общая формула:
              </div>
              <div
                style={{
                  fontSize: "14px",
                  color: "#d4d4d4",
                  fontFamily: "Arial, sans-serif",
                  overflowX: "auto",
                }}
                dangerouslySetInnerHTML={{ __html: formulas.general }}
              />
            </div>

            <div
              className="formula-block"
              style={{
                backgroundColor: "#2d2d2d",
                padding: "12px",
                borderRadius: "4px",
                border: "1px solid #3e3e42",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  color: "#858585",
                  marginBottom: "6px",
                }}
              >
                С подставленными значениями:
              </div>
              <div
                style={{
                  fontSize: "14px",
                  color: "#d4d4d4",
                  fontFamily: "Arial, sans-serif",
                  overflowX: "auto",
                }}
                dangerouslySetInnerHTML={{ __html: formulas.withValues }}
              />
            </div>
          </div>
        )}
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
          <div
            className="property-input"
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
          >
            <input
              type="checkbox"
              id="reserve-checkbox"
              checked={selectedBlock.isReserve || false}
              onChange={(e) => {
                const isReserve = e.target.checked;
                onUpdateBlock(selectedBlock.id, { isReserve });

                // Если блок становится резервным - удаляем все его связи
                if (isReserve) {
                  connections
                    .filter(
                      (conn) =>
                        conn.fromBlockId === selectedBlock.id ||
                        conn.toBlockId === selectedBlock.id,
                    )
                    .forEach((conn) => onDeleteConnection(conn.id));
                }
              }}
              style={{ width: "auto", margin: 0 }}
            />
            <label
              htmlFor="reserve-checkbox"
              style={{ margin: 0, cursor: "pointer" }}
            >
              Резервный блок
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeftPanel;
