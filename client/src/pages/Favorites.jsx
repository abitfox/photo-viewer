import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { fetchFavorites, fetchTagsBatch } from '../services/api';
import Grid from '../components/Grid';
import Modal from '../components/Modal';

const VIDEO_EXTS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.wmv'];

export default function Favorites() {
  const { loadFavorites, favorites } = useApp();
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [tagsMap, setTagsMap] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    await loadFavorites();
    setLoading(false);
  };

  useEffect(() => {
    if (favorites.length > 0) {
      const paths = favorites.map((f) => encodeURIComponent(f.path.replace(/\/+/g, '/')));
      fetchTagsBatch(paths).then(setTagsMap);
    }
  }, [favorites]);

  const handleOpenImage = (path) => {
    const isVideo = VIDEO_EXTS.some((ext) => path.toLowerCase().endsWith(ext));
    setSelectedMedia({
      path,
      name: path.split('/').pop(),
      isVideo,
    });
  };

  const handleCloseModal = () => {
    setSelectedMedia(null);
  };

  const handleNavigate = (direction) => {
    if (!selectedMedia) return;
    const currentIndex = favorites.findIndex((f) => f.path === selectedMedia.path);
    const newIndex = currentIndex + direction;
    if (newIndex >= 0 && newIndex < favorites.length) {
      const fav = favorites[newIndex];
      const isVideo = VIDEO_EXTS.some((ext) => fav.path.toLowerCase().endsWith(ext));
      setSelectedMedia({
        path: fav.path,
        name: fav.name,
        isVideo,
      });
    }
  };

  const items = favorites.map((fav) => ({
    path: fav.path,
    name: fav.name,
    isDir: false,
    isVideo: VIDEO_EXTS.some((ext) => fav.path.toLowerCase().endsWith(ext)),
  }));

  return (
    <div>
      <h2 className="text-gray-400 text-sm mb-4">⭐ 收藏的照片 ({favorites.length})</h2>

      {loading && (
        <div className="text-center py-10">
          <div className="inline-block w-9 h-9 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        </div>
      )}

      {!loading && favorites.length === 0 && (
        <div className="text-center py-10 text-gray-500 text-sm">暂无收藏的照片</div>
      )}

      {!loading && favorites.length > 0 && (
        <Grid
          items={items}
          onOpenImage={handleOpenImage}
          onOpenFolder={() => {}}
          favorites={favorites}
          tagsMap={tagsMap}
        />
      )}

      {selectedMedia && (
        <Modal
          media={selectedMedia}
          mediaList={favorites.map((fav) => ({
            path: fav.path,
            name: fav.name,
            isVideo: VIDEO_EXTS.some((ext) => fav.path.toLowerCase().endsWith(ext)),
          }))}
          onClose={handleCloseModal}
          onNavigate={handleNavigate}
        />
      )}
    </div>
  );
}
