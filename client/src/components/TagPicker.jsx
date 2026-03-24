import { useState } from 'react';
import { createTag } from '../services/api';

const TAG_COLORS = [
  '#e94560', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
  '#ffeaa7', '#dfe6e9', '#a29bfe', '#fd79a8', '#6c5ce7',
];

export default function TagPicker({ allTags, currentTags, onAdd, onClose, onRefresh }) {
  const [selectedColor, setSelectedColor] = useState('#e94560');
  const [newTagName, setNewTagName] = useState('');

  const currentTagIds = currentTags.map((t) => t.id);

  const handleCreate = async () => {
    if (!newTagName.trim()) return;
    await createTag(newTagName.trim(), selectedColor);
    setNewTagName('');
    onRefresh();
  };

  return (
    <div
      className="fixed inset-0 z-[3000] bg-black/70 flex items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-dark-200 rounded-2xl p-6 min-w-[320px] max-w-[90%] max-h-[80vh] overflow-y-auto border border-primary/30">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-lg font-semibold text-white">🏷️ 选择标签</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white text-2xl bg-transparent border-none cursor-pointer"
          >
            ×
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          {allTags.length === 0 ? (
            <p className="text-gray-500 text-sm w-full text-center py-4">暂无标签，创建一个吧～</p>
          ) : (
            allTags.map((tag) => {
              const isSelected = currentTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => !isSelected && onAdd(tag.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                    isSelected
                      ? 'ring-2 ring-white scale-105'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: tag.color }}
                >
                  <span className="text-white">{tag.name}</span>
                  {isSelected && <span>✓</span>}
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-dark-400/50 pt-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="输入标签名称..."
              maxLength={20}
              className="flex-1 px-4 py-2.5 rounded-full bg-dark-100/80 border border-dark-400/50 text-gray-200 text-sm placeholder:text-gray-500 focus:outline-none focus:border-primary"
              onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
            />
            <button
              onClick={handleCreate}
              className="px-5 py-2.5 rounded-full bg-gradient-to-r from-primary to-secondary text-white text-sm font-medium hover:shadow-lg hover:shadow-primary/30 transition-all"
            >
              创建
            </button>
          </div>
          <div className="flex gap-1.5 mt-3 flex-wrap">
            {TAG_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`w-6 h-6 rounded-full transition-all ${
                  selectedColor === color ? 'ring-2 ring-white scale-110' : ''
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
