import { useState } from 'react';
import LeftPanel from './components/LeftPanel';
import GridCanvas from './components/GridCanvas';
import { Block } from './types';

function App() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  const addBlock = () => {
    const newBlock: Block = {
      id: `block-${Date.now()}`,
      x: 0,
      y: 0,
      reliability: 0.95,
    };
    setBlocks([...blocks, newBlock]);
  };

  const deleteSelectedBlock = () => {
    if (selectedBlockId) {
      setBlocks(blocks.filter(block => block.id !== selectedBlockId));
      setSelectedBlockId(null);
    }
  };

  const updateBlock = (id: string, updates: Partial<Block>) => {
    setBlocks(blocks.map(block => 
      block.id === id ? { ...block, ...updates } : block
    ));
  };

  return (
    <div className="app">
      <LeftPanel
        blocks={blocks}
        selectedBlockId={selectedBlockId}
        onSelectBlock={setSelectedBlockId}
        onUpdateBlock={updateBlock}
      />
      <GridCanvas
        blocks={blocks}
        selectedBlockId={selectedBlockId}
        onSelectBlock={setSelectedBlockId}
        onUpdateBlock={updateBlock}
        onAddBlock={addBlock}
        onDeleteBlock={deleteSelectedBlock}
      />
    </div>
  );
}

export default App;
