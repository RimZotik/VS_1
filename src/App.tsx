import { useState, useEffect } from "react";
import LeftPanel from "./components/LeftPanel";
import GridCanvas from "./components/GridCanvas.tsx";
import { Block, Connection } from "./types";

function App() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  // Обработка клавиш
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Не обрабатываем клавиши если фокус в input или textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }

      if (e.key === "a" || e.key === "A" || e.key === "ф" || e.key === "Ф") {
        addBlock();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedBlockId) {
          deleteSelectedBlock();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedBlockId]);

  const addBlock = () => {
    // Находим максимальный номер среди существующих блоков
    const maxNumber =
      blocks.length > 0 ? Math.max(...blocks.map((b) => b.number)) : 0;

    const newBlock: Block = {
      id: `block-${Date.now()}`,
      number: maxNumber + 1,
      x: 0,
      y: 0,
      reliability: 0.95,
    };
    setBlocks([...blocks, newBlock]);
  };

  const deleteSelectedBlock = () => {
    if (selectedBlockId) {
      setBlocks(blocks.filter((block) => block.id !== selectedBlockId));
      // Удаляем все связи с этим блоком
      setConnections(
        connections.filter(
          (conn) =>
            conn.fromBlockId !== selectedBlockId &&
            conn.toBlockId !== selectedBlockId,
        ),
      );
      setSelectedBlockId(null);
    }
  };

  const updateBlock = (id: string, updates: Partial<Block>) => {
    setBlocks(
      blocks.map((block) =>
        block.id === id ? { ...block, ...updates } : block,
      ),
    );
  };

  const addConnection = (connection: Connection) => {
    setConnections([...connections, connection]);
  };

  const deleteConnection = (id: string) => {
    setConnections(connections.filter((conn) => conn.id !== id));
  };

  return (
    <div className="app">
      <LeftPanel
        blocks={blocks}
        connections={connections}
        selectedBlockId={selectedBlockId}
        onSelectBlock={setSelectedBlockId}
        onUpdateBlock={updateBlock}
        onDeleteConnection={deleteConnection}
      />
      <GridCanvas
        blocks={blocks}
        connections={connections}
        selectedBlockId={selectedBlockId}
        onSelectBlock={setSelectedBlockId}
        onUpdateBlock={updateBlock}
        onAddBlock={addBlock}
        onDeleteBlock={deleteSelectedBlock}
        onAddConnection={addConnection}
        onDeleteConnection={deleteConnection}
      />
    </div>
  );
}

export default App;
