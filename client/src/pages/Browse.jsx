import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { fetchList, fetchTagsBatch, fetchFavorites } from '../services/api';
import PathBar from '../components/PathBar';
import Breadcrumb from '../components/Breadcrumb';
import Grid from '../components/Grid';
import Modal from '../components/Modal';

const VIDEO_EXTS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.wmv'];

export default function Browse() {
  const { currentPath, setCurrentPath, navigateTo, loadFavorites: loadAppFavorites, favorites } = useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [tagsMap, setTagsMap] = useState({});

  const loadPath = useCallback(async (path, shouldNavigate = true) => {
    if (!path) return;
    setLoading(true);
    setError(null);

    try {
      const data = await fetchList(path);
      if (data.error) {
        setError(data.error);
        return;
      }

      setItems(data.items);
      setCurrentPath(data.path);
      localStorage.setItem('photoViewerLastPath', data.path);
      if (shouldNavigate) {
        navigateTo(data.path);
      }

      const mediaItems = data.items.filter((i) => !i.isDir);
      if (mediaItems.length > 0) {
        const paths = mediaItems.map((i) => i.path.replace(/\/+/g, '/'));
        const tags = await fetchTagsBatch(paths);
        setTagsMap(tags || {});
      }

      await loadAppFavorites();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, [setCurrentPath, navigateTo, loadAppFavorites]);

  useEffect(() => {
    const lastPath = localStorage.getItem('photoViewerLastPath');
    if (lastPath) {
      loadPath(lastPath);
    } else {
      loadPath('/Users/jack/Pictures');
    }
  }, []);

  const handleOpenImage = (path, isVideo = false) => {
    const media = {
      path,
      name: path.split('/').pop(),
      isVideo: VIDEO_EXTS.some((ext) => path.toLowerCase().endsWith(ext)),
    };
    setSelectedMedia(media);
  };

  const handleOpenFolder = (path) => {
    loadPath(path);
  };

  const handleCloseModal = () => {
    setSelectedMedia(null);
  };

  const handleNavigate = (direction) => {
    if (!selectedMedia) return;
    const mediaList = items.filter((i) => !i.isDir);
    const currentIndex = mediaList.findIndex((m) => m.path === selectedMedia.path);
    const newIndex = currentIndex + direction;
    if (newIndex >= 0 && newIndex < mediaList.length) {
      const newMedia = mediaList[newIndex];
      setSelectedMedia({
        path: newMedia.path,
        name: newMedia.name,
        isVideo: newMedia.isVideo,
      });
    }
  };

  const mediaList = items.filter((i) => !i.isDir).map((i) => ({
    path: i.path,
    name: i.name,
    isVideo: i.isVideo,
  }));

  return (
    <div>
      <PathBar onLoadPath={loadPath} />
      <Breadcrumb path={currentPath} onNavigate={handleOpenFolder} />

      {loading && (
        <div className="mt-6 text-center py-10">
          <div className="inline-block w-9 h-9 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        </div>
      )}

      {error && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 mt-6 text-red-400 text-sm">
          错误：{error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="mt-6 text-center py-10 text-gray-500 text-sm">此目录为空</div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="mt-8">
        <Grid
          items={items}
          onOpenImage={handleOpenImage}
          onOpenFolder={handleOpenFolder}
          favorites={favorites}
          tagsMap={tagsMap}
        />
        </div>
      )}

      {selectedMedia && (
        <Modal
          media={selectedMedia}
          mediaList={mediaList}
          onClose={handleCloseModal}
          onNavigate={handleNavigate}
        />
      )}
    </div>
  );
}
