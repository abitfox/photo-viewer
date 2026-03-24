import { useState } from 'react';
import { useApp } from '../context/AppContext';

export default function PathBar({ onLoadPath }) {
  const { currentPath, goBack, goForward, backHistory, forwardHistory, loadFavorites } = useApp();
  const [inputValue, setInputValue] = useState(currentPath || '');
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState(() => {
    return JSON.parse(localStorage.getItem('photoViewerHistory') || '[]');
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onLoadPath(inputValue.trim());
      saveToHistory(inputValue.trim());
    }
  };

  const saveToHistory = (path) => {
    const history = historyList.filter((p) => p !== path);
    history.unshift(path);
    const trimmed = history.slice(0, 20);
    setHistoryList(trimmed);
    localStorage.setItem('photoViewerHistory', JSON.stringify(trimmed));
  };

  const handleBack = () => {
    const path = goBack();
    if (path) {
      setInputValue(path);
      onLoadPath(path, false);
    }
  };

  const handleForward = () => {
    const path = goForward();
    if (path) {
      setInputValue(path);
      onLoadPath(path, false);
    }
  };

  const selectHistory = (path) => {
    setInputValue(path);
    onLoadPath(path);
    setShowHistory(false);
  };

  const clearHistory = () => {
    setHistoryList([]);
    localStorage.removeItem('photoViewerHistory');
    setShowHistory(false);
  };

  return (
    <div className="mt-3">
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          onClick={handleBack}
          disabled={backHistory.length === 0}
          className="w-9 h-9 rounded-full bg-dark-400/50 border border-dark-400/50 text-gray-300 flex items-center justify-center hover:bg-dark-400/70 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          ←
        </button>
        <button
          type="button"
          onClick={handleForward}
          disabled={forwardHistory.length === 0}
          className="w-9 h-9 rounded-full bg-dark-400/50 border border-dark-400/50 text-gray-300 flex items-center justify-center hover:bg-dark-400/70 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          →
        </button>

        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="输入目录路径"
          className="flex-1 min-w-[150px] px-4 py-2.5 rounded-full bg-dark-100/80 border border-dark-400/50 text-gray-200 text-sm placeholder:text-gray-500 focus:outline-none focus:border-primary focus:shadow-[0_0_15px_rgba(233,69,96,0.2)] transition-all"
        />

        <button
          type="submit"
          className="px-5 py-2.5 rounded-full bg-gradient-to-r from-primary to-secondary text-white text-sm font-medium hover:shadow-lg hover:shadow-primary/30 transition-all"
        >
          浏览
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="px-4 py-2.5 rounded-full bg-dark-400/50 border border-dark-400/50 text-gray-300 text-sm hover:bg-dark-400/70 transition-all"
          >
            🕐 历史
          </button>

          {showHistory && (
            <div className="absolute top-full right-0 mt-2 w-72 max-h-60 overflow-y-auto bg-dark-200/98 rounded-xl border border-dark-400/50 shadow-xl z-50">
              {historyList.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">暂无历史记录</div>
              ) : (
                <>
                  {historyList.map((p, i) => (
                    <div
                      key={i}
                      onClick={() => selectHistory(p)}
                      className="px-4 py-2.5 text-xs text-gray-300 cursor-pointer hover:bg-dark-400/50 border-b border-dark-400/30 truncate"
                    >
                      {p}
                    </div>
                  ))}
                  <button
                    onClick={clearHistory}
                    className="w-full p-2.5 text-xs text-primary bg-primary/10 hover:bg-primary/20 border-t border-primary/30"
                  >
                    清空历史
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
