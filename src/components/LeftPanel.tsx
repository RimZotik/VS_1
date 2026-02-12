import React from "react";
import { Block } from "../types";

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

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case "sequential":
        return "Последовательно";
      case "parallel":
        return "Параллельно";
      case "reserve":
        return "Резерв";
      default:
        return mode;
    }
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
            {blocks.map((block) => (
              <div
                key={block.id}
                className={`block-item ${selectedBlockId === block.id ? "selected" : ""}`}
                onClick={() => onSelectBlock(block.id)}
              >
                <div className="block-item-header">
                  <span className="block-id">
                    {block.id.replace("block-", "Блок #")}
                  </span>
                  <span className="block-mode">{getModeLabel(block.mode)}</span>
                </div>
                <div className="block-details">
                  <div>Надежность: {block.reliability}</div>
                  <div>Готовность: {block.readiness}</div>
                  <div>
                    Позиция: ({block.x}, {block.y})
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedBlock && (
        <div className="panel-section">
          <h2>Свойства блока</h2>
          <div className="property-input">
            <label>Режим работы:</label>
            <select
              value={selectedBlock.mode}
              onChange={(e) =>
                onUpdateBlock(selectedBlock.id, {
                  mode: e.target.value as Block["mode"],
                })
              }
            >
              <option value="sequential">
                Последовательно (связан с левым и правым)
              </option>
              <option value="parallel">
                Параллельно (параллельно верхнему)
              </option>
              <option value="reserve">В резерве</option>
            </select>
          </div>

          <div className="property-input">
            <label>Надежность процессора:</label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={selectedBlock.reliability}
              onChange={(e) =>
                onUpdateBlock(selectedBlock.id, {
                  reliability: parseFloat(e.target.value),
                })
              }
            />
          </div>

          <div className="property-input">
            <label>Готовность процессора (P_np):</label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={selectedBlock.readiness}
              onChange={(e) =>
                onUpdateBlock(selectedBlock.id, {
                  readiness: parseFloat(e.target.value),
                })
              }
            />
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
