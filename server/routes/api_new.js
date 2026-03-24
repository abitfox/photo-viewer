import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { spawn, execSync } from 'child_process';
import sharp from 'sharp';
import { getDb, saveDatabase } from '../db/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

const router = express.Router();

const ALLOWED_ROOTS = [
  '/Users/jack/Pictures',
  '/Users/jack/Desktop',
  '/Users/jack/Downloads',
  '/Users/jack/.openclaw/workspace',
];

const CACHE_DIR = path.join(projectRoot, 'thumbnail_cache');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'];
const VIDEO_EXTS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.wmv'];

const FAVORITES_FILE = path.join(projectRoot, 'favorites.json');

function getCachePath(filePath) {
  const stat = fs.statSync(filePath);
  const key = crypto.createHash('md5').update(filePath + stat.mtimeMs).digest('hex');
  const cachePath = path.join(CACHE_DIR, `${key}.jpg`);
  console.log('[DEBUG getCachePath] 文件:', filePath);
  console.log('[DEBUG getCachePath] mtime:', stat.mtimeMs);
  console.log('[DEBUG getCachePath] MD5 key:', key);
  console.log('[DEBUG getCachePath] 缓存路径:', cachePath);
  return cachePath;
}

function getCachedThumbnail(filePath) {
  const cachePath = getCachePath(filePath);
  const exists = fs.existsSync(cachePath);
  console.log('[DEBUG getCachedThumbnail] 缓存存在:', exists, exists ? cachePath : '');
  return exists ? cachePath : null;
}

function saveToCache(filePath, tempPath) {
  const cachePath = getCachePath(filePath);
  console.log('[DEBUG saveToCache] 从临时文件复制到缓存:', tempPath, '->', cachePath);
  fs.copyFileSync(tempPath, cachePath);
  console.log('[DEBUG saveToCache] ✅ 缓存保存成功');
}

function loadFavorites() {
  try {
    if (fs.existsSync(FAVORITES_FILE)) {
      return JSON.parse(fs.readFileSync(FAVORITES_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('加载收藏失败:', err.message);
  }
  return [];
}

function saveFavorites(favorites) {
  try {
    fs.writeFileSync(FAVORITES_FILE, JSON.stringify(favorites, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('保存收藏失败:', err.message);
    return false;
  }
}

router.get('/list', (req, res) => {
  const dirPath = req.query.path || '';
  console.log('[DEBUG /api/list] 请求路径:', dirPath);
  const resolved = path.resolve(dirPath);
  console.log('[DEBUG /api/list] 解析后路径:', resolved);

  const isAllowed = ALLOWED_ROOTS.some(root => resolved.startsWith(root));
  if (!isAllowed) {
    console.log('[DEBUG /api/list] ❌ 路径不在允许列表中');
    return res.status(403).json({ error: '目录不在允许列表中' });
  }

  if (!fs.existsSync(resolved)) {
    console.log('[DEBUG /api/list] ❌ 目录不存在:', resolved);
    return res.status(404).json({ error: '目录不存在' });
  }

  try {
    const items = fs.readdirSync(resolved, { withFileTypes: true });
    console.log('[DEBUG /api/list] 共读取到', items.length, '个条目');
    const result = items
      .filter(item => {
        if (item.isDirectory()) return true;
        if (item.isFile()) {
          const ext = path.extname(item.name).toLowerCase();
          return IMAGE_EXTS.includes(ext) || VIDEO_EXTS.includes(ext);
        }
        return false;
      })
      .map(item => {
        const fullPath = path.join(resolved, item.name);
        const ext = path.extname(item.name).toLowerCase();
        const isVideo = VIDEO_EXTS.includes(ext);
        return {
          name: item.name,
          path: fullPath,
          isDir: item.isDirectory(),
          isVideo: isVideo,
          size: item.isFile() ? fs.statSync(fullPath).size : null,
        };
      })
      .sort((a, b) => {
        if (a.isDir && !b.isDir) return -1;
        if (!a.isDir && b.isDir) return 1;
        if (a.isDir !== b.isDir) return 0;
        if (a.isVideo !== b.isVideo) return a.isVideo ? 1 : -1;
        return a.name.localeCompare(b.name);
      });

    console.log('[DEBUG /api/list] ✅ 过滤后媒体文件数:', result.filter(i => !i.isDir).length);
    res.json({ path: resolved, items: result });
  } catch (err) {
    console.error('[DEBUG /api/list] ❌ 错误:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/thumbnail', async (req, res) => {
  const imgPath = req.query.path || '';
  console.log('[DEBUG /api/thumbnail] 请求路径:', imgPath);
  const resolved = path.resolve(imgPath);
  console.log('[DEBUG /api/thumbnail] 解析后路径:', resolved);

  const isAllowed = ALLOWED_ROOTS.some(root => resolved.startsWith(root));
  if (!isAllowed) {
    console.log('[DEBUG /api/thumbnail] ❌ 路径不在允许列表中');
    return res.status(403).send('禁止访问');
  }

  if (!fs.existsSync(resolved)) {
    console.log('[DEBUG /api/thumbnail] ❌ 文件不存在:', resolved);
    return res.status(404).send('文件不存在');
  }

  const cachedPath = getCachedThumbnail(resolved);
  if (cachedPath) {
    console.log('[DEBUG /api/thumbnail] ✅ 使用缓存:', cachedPath);
    res.setHeader('Content-Type', 'image/jpeg');
    return fs.createReadStream(cachedPath).pipe(res);
  }

  const ext = path.extname(resolved).toLowerCase();
  const isVideo = VIDEO_EXTS.includes(ext);
  console.log('[DEBUG /api/thumbnail] 文件类型:', ext, isVideo ? '(视频)' : '(图片)');

  if (isVideo) {
    console.log('[DEBUG /api/thumbnail] 🔄 正在生成视频缩略图...');
    return handleVideoThumbnail(resolved, res);
  }

  if (['.heic', '.heif'].includes(ext)) {
    console.log('[DEBUG /api/thumbnail] 🔄 正在转换 HEIC...');
    return handleHeicThumbnail(resolved, res);
  }

  console.log('[DEBUG /api/thumbnail] 🔄 正在生成图片缩略图 (sharp)...');
  return handleImageThumbnail(resolved, res);
});

async function handleVideoThumbnail(filePath, res) {
  const tmpDir = os.tmpdir();
  const outputPath = path.join(tmpDir, `thumb_${Date.now()}.jpg`);
  console.log('[DEBUG handleVideoThumbnail] 临时文件:', outputPath);
  const timePoints = ['00:00:01', '00:00:00.5', '00:00:00.1', '00:00:00'];
  let tryIndex = 0;

  const tryExtract = () => {
    if (tryIndex >= timePoints.length) {
      console.log('[DEBUG handleVideoThumbnail] ❌ 所有时间点尝试失败');
      return res.status(500).send('视频缩略图生成失败');
    }

    const timePoint = timePoints[tryIndex++];
    console.log(`[DEBUG handleVideoThumbnail] 尝试时间点 ${tryIndex}: ${timePoint}`);
    const ffmpeg = spawn('ffmpeg', ['-i', filePath, '-ss', timePoint, '-vframes', '1', '-vf', 'scale=300:-2', '-y', outputPath]);

    ffmpeg.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        console.log('[DEBUG handleVideoThumbnail] ✅ ffmpeg 成功，保存缓存');
        saveToCache(filePath, outputPath);
        res.setHeader('Content-Type', 'image/jpeg');
        const stream = fs.createReadStream(outputPath);
        stream.on('close', () => fs.unlink(outputPath, () => {}));
        return stream.pipe(res);
      }
      console.log(`[DEBUG handleVideoThumbnail] ❌ ffmpeg 失败，code=${code}`);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      tryExtract();
    });

    ffmpeg.on('error', (err) => {
      console.error('[DEBUG handleVideoThumbnail] ❌ ffmpeg 错误:', err.message);
      tryExtract();
    });
  };

  tryExtract();
}

function handleHeicThumbnail(filePath, res) {
  const tmpDir = os.tmpdir();
  const outputPath = path.join(tmpDir, `heic_thumb_${Date.now()}.jpg`);
  console.log('[DEBUG handleHeicThumbnail] 临时文件:', outputPath);

  try {
    console.log('[DEBUG handleHeicThumbnail] 🔄 执行 sips 转换...');
    execSync(`sips -s format jpeg "${filePath}" --out "${outputPath}"`, { stdio: 'pipe' });
    if (fs.existsSync(outputPath)) {
      const size = fs.statSync(outputPath).size;
      console.log(`[DEBUG handleHeicThumbnail] ✅ 转换成功，文件大小: ${size} bytes`);
      saveToCache(filePath, outputPath);
      res.setHeader('Content-Type', 'image/jpeg');
      const stream = fs.createReadStream(outputPath);
      stream.on('close', () => fs.unlink(outputPath, () => {}));
      return stream.pipe(res);
    }
  } catch (err) {
    console.error('[DEBUG handleHeicThumbnail] ❌ sips 转换失败:', err.message);
  }
  return res.status(500).send('HEIC 转换失败');
}

async function handleImageThumbnail(filePath, res) {
  const tmpDir = os.tmpdir();
  const outputPath = path.join(tmpDir, `thumb_${Date.now()}.jpg`);
  console.log('[DEBUG handleImageThumbnail] 临时文件:', outputPath);

  try {
    console.log('[DEBUG handleImageThumbnail] 🔄 正在使用 sharp 处理...');
    const buffer = await sharp(filePath)
      .resize(300, 300, { fit: 'cover', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    console.log(`[DEBUG handleImageThumbnail] ✅ sharp 处理成功，buffer 大小: ${buffer.length} bytes`);

    fs.writeFile(outputPath, buffer, (err) => {
      if (!err) {
        console.log('[DEBUG handleImageThumbnail] ✅ 临时文件已写入');
        saveToCache(filePath, outputPath);
        console.log('[DEBUG handleImageThumbnail] ✅ 缓存已保存');
      } else {
        console.error('[DEBUG handleImageThumbnail] ❌ 写入临时文件失败:', err.message);
      }
    });

    res.setHeader('Content-Type', 'image/jpeg');
    return res.send(buffer);
  } catch (err) {
    console.error('[DEBUG handleImageThumbnail] ❌ sharp 处理失败:', err.message);
    return res.sendFile(filePath);
  }

router.get('/preview', async (req, res) => {
  const imgPath = req.query.path || '';
  console.log('[DEBUG /api/preview] 请求路径:', imgPath);
  const resolved = path.resolve(imgPath);
  console.log('[DEBUG /api/preview] 解析后路径:', resolved);

  const isAllowed = ALLOWED_ROOTS.some(root => resolved.startsWith(root));
  if (!isAllowed) {
    return res.status(403).send('禁止访问');
  }

  if (!fs.existsSync(resolved)) {
    return res.status(404).send('文件不存在');
  }

  const ext = path.extname(resolved).toLowerCase();
  const isVideo = VIDEO_EXTS.includes(ext);

  if (isVideo) {
    return handleVideoPreview(resolved, res);
  }

  if (['.heic', '.heif'].includes(ext)) {
    return handleHeicPreview(resolved, res);
  }

  try {
    res.setHeader('Content-Type', 'image/jpeg');
    return sharp(resolved)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .pipe(res);
  } catch (err) {
    return res.sendFile(resolved);
  }
});

async function handleVideoPreview(filePath, res) {
  const tmpDir = os.tmpdir();
  const outputPath = path.join(tmpDir, `preview_${Date.now()}.jpg`);
  const timePoints = ['00:00:01', '00:00:00.5', '00:00:00.1', '00:00:00'];
  let tryIndex = 0;

  const tryExtract = () => {
    if (tryIndex >= timePoints.length) {
      return res.status(500).send('生成预览失败');
    }

    const timePoint = timePoints[tryIndex++];
    const ffmpeg = spawn('ffmpeg', ['-i', filePath, '-ss', timePoint, '-vframes', '1', '-vf', 'scale=800:-2', '-y', outputPath]);

    ffmpeg.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        res.setHeader('Content-Type', 'image/jpeg');
        const stream = fs.createReadStream(outputPath);
        stream.on('close', () => fs.unlink(outputPath, () => {}));
        return stream.pipe(res);
      }
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      tryExtract();
    });

    ffmpeg.on('error', () => tryExtract());
  };

  tryExtract();
}

function handleHeicPreview(filePath, res) {
  const tmpDir = os.tmpdir();
  const outputPath = path.join(tmpDir, `heic_preview_${Date.now()}.jpg`);

  try {
    execSync(`sips -s format jpeg "${filePath}" --out "${outputPath}"`, { stdio: 'pipe' });
    if (fs.existsSync(outputPath)) {
      res.setHeader('Content-Type', 'image/jpeg');
      const stream = fs.createReadStream(outputPath);
      stream.on('close', () => fs.unlink(outputPath, () => {}));
      return stream.pipe(res);
    }
  } catch (err) {
    console.error('sips 转换失败:', err.message);
  }
  return res.status(500).send('HEIC 转换失败');
}

router.get('/image', async (req, res) => {
  const imgPath = req.query.path || '';
  const resolved = path.resolve(imgPath);

  const isAllowed = ALLOWED_ROOTS.some(root => resolved.startsWith(root));
  if (!isAllowed) {
    return res.status(403).send('禁止访问');
  }

  if (!fs.existsSync(resolved)) {
    return res.status(404).send('文件不存在');
  }

  const ext = path.extname(resolved).toLowerCase();

  if (VIDEO_EXTS.includes(ext)) {
    const videoMimes = {
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.m4v': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mkv': 'video/x-matroska',
      '.webm': 'video/webm',
      '.wmv': 'video/x-ms-wmv',
    };
    const mimeType = videoMimes[ext] || 'video/mp4';
    const stat = fs.statSync(resolved);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mimeType,
      });
      return fs.createReadStream(resolved, { start, end }).pipe(res);
    }

    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': mimeType,
      'Accept-Ranges': 'bytes',
    });
    return fs.createReadStream(resolved).pipe(res);
  }

  if (['.heic', '.heif'].includes(ext)) {
    const tmpDir = os.tmpdir();
    const outputPath = path.join(tmpDir, `heic_full_${Date.now()}.jpg`);

    try {
      execSync(`sips -s format jpeg "${resolved}" --out "${outputPath}"`, { stdio: 'pipe' });
      if (fs.existsSync(outputPath)) {
        res.setHeader('Content-Type', 'image/jpeg');
        const stream = fs.createReadStream(outputPath);
        stream.on('close', () => fs.unlink(outputPath, () => {}));
        return stream.pipe(res);
      }
    } catch (err) {
      console.error('sips 转换失败:', err.message);
    }
    return res.status(500).send('HEIC 转换失败');
  }

  res.sendFile(resolved);
});

router.get('/favorites', (req, res) => {
  res.json(loadFavorites());
});

router.post('/favorites', (req, res) => {
  const { path: imgPath, action } = req.body;

  if (!imgPath) {
    return res.status(400).json({ error: '缺少路径参数' });
  }

  const isAllowed = ALLOWED_ROOTS.some(root => imgPath.startsWith(root));
  if (!isAllowed) {
    return res.status(403).json({ error: '目录不在允许列表中' });
  }

  let favorites = loadFavorites();

  if (action === 'add') {
    const exists = favorites.some(f => f.path === imgPath);
    if (!exists) {
      favorites.push({
        path: imgPath,
        name: path.basename(imgPath),
        addedAt: new Date().toISOString(),
      });
      saveFavorites(favorites);
    }
    res.json({ success: true, isFavorite: true });
  } else if (action === 'remove') {
    favorites = favorites.filter(f => f.path !== imgPath);
    saveFavorites(favorites);
    res.json({ success: true, isFavorite: false });
  } else {
    res.status(400).json({ error: '无效的操作' });
  }
});

router.get('/favorites/check', (req, res) => {
  const imgPath = req.query.path || '';
  const favorites = loadFavorites();
  const isFavorite = favorites.some(f => f.path === imgPath || f.path === path.resolve(imgPath));
  res.json({ isFavorite });
});

router.get('/tags', (req, res) => {
  const db = getDb();
  if (!db) return res.json([]);
  try {
    const result = db.exec('SELECT * FROM tags ORDER BY created_at DESC');
    const tags = result.length > 0 ? result[0].values.map(row => ({
      id: row[0], name: row[1], color: row[2], created_at: row[3]
    })) : [];
    res.json(tags);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tags', (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: '数据库未初始化' });
  const { name, color } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: '标签名称不能为空' });
  }

  try {
    const tagColor = color || '#e94560';
    db.run('INSERT INTO tags (name, color) VALUES (?, ?)', [name.trim(), tagColor]);
    saveDatabase();
    const result = db.exec('SELECT last_insert_rowid()');
    const id = result[0].values[0][0];
    res.json({ success: true, id, name: name.trim(), color: tagColor });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: '标签已存在' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete('/tags/:id', (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: '数据库未初始化' });
  try {
    const tagId = parseInt(req.params.id);
    db.run('DELETE FROM tags WHERE id = ?', [tagId]);
    db.run('DELETE FROM photo_tags WHERE tag_id = ?', [tagId]);
    saveDatabase();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tags/photo', (req, res) => {
  const db = getDb();
  if (!db) return res.json([]);
  const photoPath = req.query.path || '';

  try {
    const result = db.exec(`
      SELECT t.id, t.name, t.color
      FROM tags t
      INNER JOIN photo_tags pt ON t.id = pt.tag_id
      WHERE pt.photo_path = '${photoPath.replace(/'/g, "''")}'
      ORDER BY t.name
    `);
    const tags = result.length > 0 ? result[0].values.map(row => ({
      id: row[0], name: row[1], color: row[2]
    })) : [];
    res.json(tags);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tags/photo', (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: '数据库未初始化' });
  const { path: photoPath, tagId } = req.body;

  if (!photoPath || !tagId) {
    return res.status(400).json({ error: '缺少参数' });
  }

  try {
    db.run('INSERT OR IGNORE INTO photo_tags (photo_path, tag_id) VALUES (?, ?)', [photoPath, tagId]);
    saveDatabase();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/tags/photo/:photoPath/:tagId', (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: '数据库未初始化' });
  try {
    const { photoPath, tagId } = req.params;
    const decodedPath = decodeURIComponent(photoPath);
    db.run('DELETE FROM photo_tags WHERE photo_path = ? AND tag_id = ?', [decodedPath, parseInt(tagId)]);
    saveDatabase();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/photos/by-tag', (req, res) => {
  const db = getDb();
  if (!db) return res.json([]);
  const tagId = req.query.tagId ? parseInt(req.query.tagId) : null;

  try {
    let result;
    if (tagId) {
      result = db.exec(`SELECT DISTINCT photo_path FROM photo_tags WHERE tag_id = ${tagId}`);
    } else {
      result = db.exec('SELECT DISTINCT photo_path FROM photo_tags');
    }
    const photos = result.length > 0 ? result[0].values.map(row => row[0]) : [];
    res.json(photos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tags/batch', (req, res) => {
  const db = getDb();
  if (!db) return res.json({});
  const paths = req.query.paths ? req.query.paths.split(',') : [];

  if (paths.length === 0) {
    return res.json({});
  }

  try {
    const placeholders = paths.map(() => '?').join(',');
    const safePaths = paths.map(p => p.replace(/'/g, "''"));
    const result = db.exec(`
      SELECT pt.photo_path, t.id, t.name, t.color
      FROM photo_tags pt
      INNER JOIN tags t ON pt.tag_id = t.id
      WHERE pt.photo_path IN ('${safePaths.join("','")}')
    `);

    const tagsMap = {};
    if (result.length > 0) {
      result[0].values.forEach(row => {
        const photoPath = row[0];
        if (!tagsMap[photoPath]) {
          tagsMap[photoPath] = [];
        }
        tagsMap[photoPath].push({ id: row[1], name: row[2], color: row[3] });
      });
    }

    res.json(tagsMap);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

