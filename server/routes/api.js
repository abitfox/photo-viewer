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

function getCachePath(filePath) {
  const stat = fs.statSync(filePath);
  const key = crypto.createHash('md5').update(filePath + stat.mtimeMs + stat.size).digest('hex');
  return path.join(CACHE_DIR, `${key}.jpg`);
}

function getCachedThumbnail(filePath) {
  try {
    const stat = fs.statSync(filePath);
    const cachedPath = getCachePath(filePath);
    if (fs.existsSync(cachedPath)) {
      const cachedStat = fs.statSync(cachedPath);
      if (cachedStat.mtimeMs >= stat.mtimeMs) return cachedPath;
      fs.unlinkSync(cachedPath);
    }
  } catch {}
  return null;
}

function saveToCache(filePath, tempPath) {
  const cachedPath = getCachePath(filePath);
  fs.copyFileSync(tempPath, cachedPath);
}

const FAVORITES_FILE = path.join(projectRoot, 'favorites.json');

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
  const resolved = path.resolve(dirPath);
  const isAllowed = ALLOWED_ROOTS.some(root => resolved.startsWith(root));
  if (!isAllowed) return res.status(403).json({ error: '目录不在允许列表中' });
  if (!fs.existsSync(resolved)) return res.status(404).json({ error: '目录不存在' });

  try {
    const items = fs.readdirSync(resolved, { withFileTypes: true });
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
        return { name: item.name, path: fullPath, isDir: item.isDirectory(), isVideo, size: item.isFile() ? fs.statSync(fullPath).size : null };
      })
      .sort((a, b) => {
        if (a.isDir && !b.isDir) return -1;
        if (!a.isDir && b.isDir) return 1;
        if (a.isVideo !== b.isVideo) return a.isVideo ? 1 : -1;
        return a.name.localeCompare(b.name);
      });
    res.json({ path: resolved, items: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/thumbnail', async (req, res) => {
  const imgPath = req.query.path || '';
  const resolved = path.resolve(imgPath);
  const isAllowed = ALLOWED_ROOTS.some(root => resolved.startsWith(root));
  if (!isAllowed) return res.status(403).send('禁止访问');
  if (!fs.existsSync(resolved)) return res.status(404).send('文件不存在');

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const cachedPath = getCachedThumbnail(resolved);
  if (cachedPath) {
    res.setHeader('Content-Type', 'image/jpeg');
    return fs.createReadStream(cachedPath).pipe(res);
  }

  const ext = path.extname(resolved).toLowerCase();
  const isVideo = VIDEO_EXTS.includes(ext);

  if (isVideo) return handleVideoThumbnail(resolved, res);
  if (['.heic', '.heif'].includes(ext)) return handleHeicThumbnail(resolved, res);
  return handleImageThumbnail(resolved, res);
});

async function handleVideoThumbnail(filePath, res) {
  const tmpDir = os.tmpdir();
  const outputPath = path.join(tmpDir, `thumb_${Date.now()}.jpg`);
  const timePoints = ['00:00:01', '00:00:00.5', '00:00:00.1', '00:00:00'];
  let tryIndex = 0;

  const tryExtract = () => {
    if (tryIndex >= timePoints.length) return res.status(500).send('视频缩略图生成失败');
    const timePoint = timePoints[tryIndex++];
    const ffmpeg = spawn('ffmpeg', ['-i', filePath, '-ss', timePoint, '-vframes', '1', '-vf', 'scale=300:-2', '-y', outputPath]);
    ffmpeg.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        saveToCache(filePath, outputPath);
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

function handleHeicThumbnail(filePath, res) {
  const tmpDir = os.tmpdir();
  const outputPath = path.join(tmpDir, `heic_thumb_${Date.now()}.jpg`);
  try {
    execSync(`sips -s format jpeg "${filePath}" --out "${outputPath}"`, { stdio: 'pipe' });
    if (fs.existsSync(outputPath)) {
      const size = fs.statSync(outputPath).size;
      saveToCache(filePath, outputPath);
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

async function handleImageThumbnail(filePath, res) {
  const tmpDir = os.tmpdir();
  const outputPath = path.join(tmpDir, `thumb_${Date.now()}.jpg`);
  try {
    const buffer = await sharp(filePath).resize(300, 300, { fit: 'cover', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
    fs.writeFile(outputPath, buffer, (err) => { if (!err) saveToCache(filePath, outputPath); });
    res.setHeader('Content-Type', 'image/jpeg');
    return res.send(buffer);
  } catch (err) {
    return res.sendFile(filePath);
  }
}

router.get('/preview', async (req, res) => {
  const imgPath = req.query.path || '';
  const resolved = path.resolve(imgPath);
  const isAllowed = ALLOWED_ROOTS.some(root => resolved.startsWith(root));
  if (!isAllowed) return res.status(403).send('禁止访问');
  if (!fs.existsSync(resolved)) return res.status(404).send('文件不存在');

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const ext = path.extname(resolved).toLowerCase();
  const isVideo = VIDEO_EXTS.includes(ext);
  if (isVideo) return handleVideoPreview(resolved, res);
  if (['.heic', '.heif'].includes(ext)) return handleHeicPreview(resolved, res);

  try {
    res.setHeader('Content-Type', 'image/jpeg');
    return sharp(resolved).resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).pipe(res);
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
    if (tryIndex >= timePoints.length) return res.status(500).send('生成预览失败');
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
  if (!isAllowed) return res.status(403).send('禁止访问');
  if (!fs.existsSync(resolved)) return res.status(404).send('文件不存在');

  const ext = path.extname(resolved).toLowerCase();
  if (VIDEO_EXTS.includes(ext)) {
    const videoMimes = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.m4v': 'video/mp4', '.avi': 'video/x-msvideo', '.mkv': 'video/x-matroska', '.webm': 'video/webm', '.wmv': 'video/x-ms-wmv' };
    const mimeType = videoMimes[ext] || 'video/mp4';
    const stat = fs.statSync(resolved);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;
      res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${fileSize}`, 'Accept-Ranges': 'bytes', 'Content-Length': chunkSize, 'Content-Type': mimeType });
      return fs.createReadStream(resolved, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'Content-Length': fileSize, 'Content-Type': mimeType, 'Accept-Ranges': 'bytes' });
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

router.get('/favorites', (req, res) => { res.json(loadFavorites()); });
router.post('/favorites', (req, res) => {
  const { path: imgPath, action } = req.body;
  if (!imgPath) return res.status(400).json({ error: '缺少路径参数' });
  const isAllowed = ALLOWED_ROOTS.some(root => imgPath.startsWith(root));
  if (!isAllowed) return res.status(403).json({ error: '目录不在允许列表中' });

  let favorites = loadFavorites();
  if (action === 'add') {
    const exists = favorites.some(f => f.path === imgPath);
    if (!exists) {
      favorites.push({ path: imgPath, name: path.basename(imgPath), addedAt: new Date().toISOString() });
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
    const tags = result.length > 0 ? result[0].values.map(row => ({ id: row[0], name: row[1], color: row[2], created_at: row[3] })) : [];
    res.json(tags);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tags', (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: '数据库未初始化' });
  const { name, color } = req.body;
  if (!name || name.trim() === '') return res.status(400).json({ error: '标签名称不能为空' });

  try {
    const tagColor = color || '#e94560';
    db.run('INSERT INTO tags (name, color) VALUES (?, ?)', [name.trim(), tagColor]);
    saveDatabase();
    const result = db.exec('SELECT last_insert_rowid()');
    const id = result[0].values[0][0];
    res.json({ success: true, id, name: name.trim(), color: tagColor });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: '标签已存在' });
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
    const safePath = photoPath.replace(/'/g, "''");
    const result = db.exec(`SELECT t.id, t.name, t.color FROM tags t INNER JOIN photo_tags pt ON t.id = pt.tag_id WHERE pt.photo_path = '${safePath}' ORDER BY t.name`);
    const tags = result.length > 0 ? result[0].values.map(row => ({ id: row[0], name: row[1], color: row[2] })) : [];
    res.json(tags);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tags/photo', (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: '数据库未初始化' });
  const { path: photoPath, tagId } = req.body;
  if (!photoPath || !tagId) return res.status(400).json({ error: '缺少参数' });

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
  if (paths.length === 0) return res.json({});

  try {
    const safePaths = paths.map(p => p.replace(/'/g, "''"));
    const result = db.exec(`SELECT pt.photo_path, t.id, t.name, t.color FROM photo_tags pt INNER JOIN tags t ON pt.tag_id = t.id WHERE pt.photo_path IN ('${safePaths.join("','")}')`);
    const tagsMap = {};
    if (result.length > 0) {
      result[0].values.forEach(row => {
        const photoPath = row[0];
        if (!tagsMap[photoPath]) tagsMap[photoPath] = [];
        tagsMap[photoPath].push({ id: row[1], name: row[2], color: row[3] });
      });
    }
    res.json(tagsMap);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
