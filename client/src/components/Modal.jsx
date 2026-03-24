import { useState, useEffect, useCallback } from 'react';
import { fetchPreview, fetchImage, toggleFavorite, fetchPhotoTags, addPhotoTag, removePhotoTag, fetchTags } from '../services/api';
import TagPicker from './TagPicker';

export default function Modal({ media, mediaList, onClose, onNavigate }) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [tags, setTags] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [loading, setLoading] = useState(true);

  const normalizedPath = media.path.replace(/\/+/g, '/');

  useEffect(() => {
    loadData();
  }, [media.path]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [favRes, tagRes, allTagsRes] = await Promise.all([
        fetch(`/api/favorites/check?path=${encodeURIComponent(normalizedPath)}`).then(r => r.json()),
        fetchPhotoTags(normalizedPath),
        fetchTags(),
      ]);
      setIsFavorite(favRes.isFavorite);
      setTags(Array.isArray(tagRes) ? tagRes : []);
      setAllTags(Array.isArray(allTagsRes) ? allTagsRes : []);
    } catch (err) {
      console.error('加载数据失败:', err);
    }
    setLoading(false);
  };

  const handleToggleFavorite = async () => {
    const action = isFavorite ? 'remove' : 'add';
    await toggleFavorite(normalizedPath, action);
    setIsFavorite(!isFavorite);
  };

  const handleAddTag = async (tagId) => {
    await addPhotoTag(normalizedPath, tagId);
    await loadData();
  };

  const handleRemoveTag = async (tagId) => {
    await removePhotoTag(normalizedPath, tagId);
    await loadData();
  };

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft') onNavigate(-1);
    if (e.key === 'ArrowRight') onNavigate(1);
  }, [onClose, onNavigate]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    let touchStartX = 0;
    const handleTouchStart = (e) => {
      touchStartX = e.changedTouches[0].screenX;
    };
    const handleTouchEnd = (e) => {
      const diff = touchStartX - e.changedTouches[0].screenX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) onNavigate(1);
        else onNavigate(-1);
      }
    };
    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchend', handleTouchEnd);
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onNavigate]);

  const currentIndex = mediaList.findIndex((m) => m.path === media.path);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < mediaList.length - 1;

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black/95 flex flex-col items-center justify-center p-5"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-1.5 rounded-full text-sm z-10">
        {currentIndex + 1} / {mediaList.length}
      </div>

      <button
        onClick={() => onNavigate(-1)}
        disabled={!hasPrev}
        className="absolute left-2 top-1/2 -translate-y-1/2 w-12 h-24 bg-black/50 border-none text-white text-3xl cursor-pointer hover:bg-primary/50 disabled:opacity-20 disabled:cursor-not-allowed rounded-lg transition-all z-10"
      >
        ‹
      </button>

      <button
        onClick={() => onNavigate(1)}
        disabled={!hasNext}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-24 bg-black/50 border-none text-white text-3xl cursor-pointer hover:bg-primary/50 disabled:opacity-20 disabled:cursor-not-allowed rounded-lg transition-all z-10"
      >
        ›
      </button>

      <div className="flex-1 flex items-center justify-center max-h-[75vh]">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          </div>
        ) : media.isVideo ? (
          <video
            src={fetchImage(media.path)}
            controls
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        ) : (
          <img
            src={fetchPreview(media.path)}
            alt={media.name}
            className="max-w-full max-h-full object-contain rounded-lg opacity-0 transition-opacity duration-300"
            onLoad={(e) => e.target.classList.remove('opacity-0')}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-2 mt-5 justify-center max-w-[80%] z-10">
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="px-3 py-1.5 rounded-xl text-sm font-medium text-white flex items-center gap-1.5"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            <button
              onClick={() => handleRemoveTag(tag.id)}
              className="ml-1 opacity-70 hover:opacity-100"
            >
              ×
            </button>
          </span>
        ))}
        <button
          onClick={() => setShowTagPicker(true)}
          className="px-3 py-1.5 rounded-xl text-sm font-medium bg-white/15 border-2 border-dashed border-white/40 text-white hover:bg-white/25 flex items-center gap-1"
        >
          + 添加标签
        </button>
      </div>

      <div className="flex gap-3 mt-4 flex-wrap justify-center z-10">
        <button
          onClick={handleToggleFavorite}
          className={`px-6 py-3 rounded-full font-medium transition-all flex items-center gap-2 ${
            isFavorite
              ? 'bg-gradient-to-r from-yellow-500 to-orange-400 text-dark-300 shadow-lg shadow-yellow-500/40'
              : 'bg-dark-400/50 border border-dark-400/50 text-gray-200 hover:bg-dark-400/70'
          }`}
        >
          <span>{isFavorite ? '★' : '☆'}</span>
          <span>{isFavorite ? '已收藏' : '收藏'}</span>
        </button>
        <button
          onClick={onClose}
          className="px-6 py-3 rounded-full bg-white/10 border border-white/20 text-white font-medium hover:bg-white/20 transition-all"
        >
          关闭
        </button>
      </div>

      <div className="mt-3 text-gray-500 text-xs font-mono max-w-[90%] text-center truncate z-10">
        {media.path}
      </div>

      {showTagPicker && (
        <TagPicker
          allTags={allTags}
          currentTags={tags}
          onAdd={handleAddTag}
          onClose={() => setShowTagPicker(false)}
          onRefresh={loadData}
        />
      )}
    </div>
  );
}
