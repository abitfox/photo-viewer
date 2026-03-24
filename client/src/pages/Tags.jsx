import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { fetchTags, fetchPhotosByTag, fetchTagsBatch, deleteTag } from '../services/api';
import Grid from '../components/Grid';
import Modal from '../components/Modal';

const VIDEO_EXTS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.wmv'];

export default function Tags() {
  const params = useParams();
  const navigate = useNavigate();
  const { loadTags, loadFavorites, favorites } = useApp();
  const [tags, setTags] = useState([]);
  const [tagCounts, setTagCounts] = useState({});
  const [selectedTagId, setSelectedTagId] = useState(params.tagId ? parseInt(params.tagId) : null);
  const [selectedTagName, setSelectedTagName] = useState('');
  const [selectedTagColor, setSelectedTagColor] = useState('');
  const [photoPaths, setPhotoPaths] = useState([]);
  const [tagsMap, setTagsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (params.tagId) {
      const tagId = parseInt(params.tagId);
      setSelectedTagId(tagId);
      loadTagPhotos(tagId);
    } else {
      setSelectedTagId(null);
      setPhotoPaths([]);
    }
  }, [params.tagId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const tagsData = await fetchTags();
      setTags(tagsData);

      const counts = {};
      for (const tag of tagsData) {
        const photos = await fetchPhotosByTag(tag.id);
        counts[tag.id] = photos.length;
      }
      setTagCounts(counts);

      await loadTags();
      await loadFavorites();
    } catch (err) {
      console.error('加载标签失败:', err);
    }
    setLoading(false);
  };

  const loadTagPhotos = async (tagId) => {
    try {
      const photos = await fetchPhotosByTag(tagId);
      setPhotoPaths(photos);

      const tag = tags.find((t) => t.id === tagId);
      if (tag) {
        setSelectedTagName(tag.name);
        setSelectedTagColor(tag.color);
      }

      if (photos.length > 0) {
        const paths = photos.map((p) => encodeURIComponent(p.replace(/\/+/g, '/')));
        const map = await fetchTagsBatch(paths);
        setTagsMap(map);
      } else {
        setTagsMap({});
      }
    } catch (err) {
      console.error('加载标签照片失败:', err);
    }
  };

  const handleSelectTag = (tag) => {
    navigate(`/tags/${tag.id}`);
  };

  const handleBackToTags = () => {
    navigate('/tags');
  };

  const handleDeleteTag = async (tagId, e) => {
    e.stopPropagation();
    if (confirm('确定要删除这个标签吗？')) {
      await deleteTag(tagId);
      loadData();
      navigate('/tags');
    }
  };

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
    const currentIndex = photoPaths.findIndex((p) => p === selectedMedia.path);
    const newIndex = currentIndex + direction;
    if (newIndex >= 0 && newIndex < photoPaths.length) {
      const path = photoPaths[newIndex];
      const isVideo = VIDEO_EXTS.some((ext) => path.toLowerCase().endsWith(ext));
      setSelectedMedia({
        path,
        name: path.split('/').pop(),
        isVideo,
      });
    }
  };

  const items = photoPaths.map((photoPath) => ({
    path: photoPath,
    name: photoPath.split('/').pop(),
    isDir: false,
    isVideo: VIDEO_EXTS.some((ext) => photoPath.toLowerCase().endsWith(ext)),
  }));

  if (loading) {
    return (
      <div className="text-center py-10">
        <div className="inline-block w-9 h-9 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (selectedTagId) {
    return (
      <div>
        <button
          onClick={handleBackToTags}
          className="mb-4 px-4 py-2 rounded-xl bg-dark-400/50 border border-dark-400/50 text-gray-200 text-sm hover:bg-primary/30 transition-all flex items-center gap-2"
        >
          ← 返回标签列表
        </button>

        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <h2
            className="text-sm font-semibold px-4 py-2 rounded-xl text-white"
            style={{ backgroundColor: selectedTagColor }}
          >
            {selectedTagName}
          </h2>
          <span className="text-gray-500 text-xs">{photoPaths.length} 张照片</span>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-sm">暂无照片</div>
        ) : (
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
            mediaList={items}
            onClose={handleCloseModal}
            onNavigate={handleNavigate}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-gray-400 text-sm mb-4">🏷️ 标签 ({tags.length})</h2>

      {tags.length === 0 ? (
        <div className="text-center py-10 text-gray-500 text-sm">
          暂无标签，请先为照片添加标签
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {tags.map((tag) => (
            <div
              key={tag.id}
              onClick={() => handleSelectTag(tag)}
              className="p-4 rounded-2xl font-medium text-white text-center cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg flex flex-col items-center gap-1"
              style={{ backgroundColor: tag.color }}
            >
              <span className="text-base">{tag.name}</span>
              <span className="text-xs opacity-80">{tagCounts[tag.id] || 0} 张</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
