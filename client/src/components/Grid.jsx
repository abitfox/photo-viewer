import { useState } from 'react';
import { fetchThumbnail, fetchTagsBatch } from '../services/api';

const VIDEO_EXTS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.wmv'];

export default function Grid({ items, onOpenImage, onOpenFolder, favorites = [], tagsMap = {} }) {
  const folders = items.filter((i) => i.isDir);
  const photos = items.filter((i) => !i.isDir && !i.isVideo);
  const videos = items.filter((i) => !i.isDir && i.isVideo);

  return (
    <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-3 md:gap-4 space-y-3 md:space-y-4">
      {folders.map((item) => (
        <FolderItem key={item.path} item={item} onOpenFolder={onOpenFolder} />
      ))}

      {photos.map((item) => (
        <PhotoItem
          key={item.path}
          item={item}
          onOpenImage={onOpenImage}
          isFavorite={favorites.some((f) => f.path === item.path)}
          tags={tagsMap[item.path] || []}
        />
      ))}

      {videos.length > 0 && photos.length > 0 && (
        <div className="w-full text-center py-5 col-span-full">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-primary/20"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 py-1.5 bg-dark-300 rounded-xl text-primary text-sm font-semibold border border-primary/20">
                🎬 视频
              </span>
            </div>
          </div>
        </div>
      )}

      {videos.map((item) => (
        <VideoItem
          key={item.path}
          item={item}
          onOpenImage={onOpenImage}
          isFavorite={favorites.some((f) => f.path === item.path)}
          tags={tagsMap[item.path] || []}
        />
      ))}
    </div>
  );
}

function FolderItem({ item, onOpenFolder }) {
  return (
    <div
      className="break-inside-avoid bg-dark-200/60 rounded-xl overflow-hidden cursor-pointer border border-dark-400/30 hover:border-blue-400/40 transition-all duration-200 active:scale-[0.98]"
      onClick={() => onOpenFolder(item.path)}
    >
      <div className="flex items-center justify-center min-h-[100px] bg-gradient-to-br from-dark-400/50 to-dark-100/50 text-5xl">
        📁
      </div>
      <div className="px-3 py-2.5 text-xs text-gray-300 bg-black/20 border-t border-dark-400/20 truncate">
        {item.name}
      </div>
    </div>
  );
}

function PhotoItem({ item, onOpenImage, isFavorite, tags }) {
  const [loaded, setLoaded] = useState(false);
  const normalizedPath = item.path.replace(/\/+/g, '/');

  return (
    <div
      className="break-inside-avoid bg-dark-200/60 rounded-xl overflow-hidden cursor-pointer border border-dark-400/30 hover:border-primary/30 transition-all duration-200 active:scale-[0.98] relative"
      onClick={() => onOpenImage(item.path, false)}
    >
      <img
        src={fetchThumbnail(item.path)}
        alt={item.name}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={`w-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-50'}`}
        style={{ aspectRatio: 'auto' }}
      />
      {isFavorite && (
        <div className="absolute top-2 right-2 text-xl drop-shadow-lg z-10">⭐</div>
      )}
      {tags.length > 0 && (
        <div className="absolute bottom-10 left-1.5 right-1.5 flex flex-wrap gap-1 z-10">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="px-2 py-0.5 rounded-lg text-xs font-medium text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}
      <div className="px-3 py-2.5 text-xs text-gray-300 bg-black/20 border-t border-dark-400/20 truncate">
        {item.name}
      </div>
    </div>
  );
}

function VideoItem({ item, onOpenImage, isFavorite, tags }) {
  const [loaded, setLoaded] = useState(false);
  const normalizedPath = item.path.replace(/\/+/g, '/');

  return (
    <div
      className="break-inside-avoid bg-dark-200/60 rounded-xl overflow-hidden cursor-pointer border border-dark-400/30 hover:border-primary/30 transition-all duration-200 active:scale-[0.98] relative"
      onClick={() => onOpenImage(item.path, false)}
    >
      <img
        src={fetchThumbnail(item.path)}
        alt={item.name}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={`w-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-50'}`}
      />
      <div className="absolute bottom-10 right-2 px-2 py-0.5 bg-black/70 rounded-lg text-xs font-semibold text-white z-10">
        ▶ VIDEO
      </div>
      {isFavorite && (
        <div className="absolute top-2 right-2 text-xl drop-shadow-lg z-10">⭐</div>
      )}
      {tags.length > 0 && (
        <div className="absolute bottom-10 left-1.5 right-12 flex flex-wrap gap-1 z-10">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="px-2 py-0.5 rounded-lg text-xs font-medium text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}
      <div className="px-3 py-2.5 text-xs text-gray-300 bg-black/20 border-t border-dark-400/20 truncate">
        {item.name}
      </div>
    </div>
  );
}
