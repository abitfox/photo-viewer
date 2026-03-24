import initSqlJs from 'sql.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

const DB_PATH = path.join(projectRoot, 'photo_viewer.db');
const CACHE_DIR = path.join(projectRoot, 'thumbnail_cache');
let db = null;

export function getDb() {
  return db;
}

export async function initDatabase() {
  try {
    const wasmPath = path.join(projectRoot, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
    const SQL = await initSqlJs({
      locateFile: file => {
        if (file === 'sql-wasm.wasm') {
          return wasmPath;
        }
        return file;
      }
    });

    let dbData = null;
    if (fs.existsSync(DB_PATH)) {
      try {
        dbData = fs.readFileSync(DB_PATH);
      } catch (err) {
        console.log('创建新数据库文件');
      }
    }

    if (dbData) {
      db = new SQL.Database(dbData);
    } else {
      db = new SQL.Database();
    }

    db.run(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        color TEXT DEFAULT '#e94560',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS photo_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        photo_path TEXT NOT NULL,
        tag_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
        UNIQUE(photo_path, tag_id)
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_photo_tags_path ON photo_tags(photo_path)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_photo_tags_tag ON photo_tags(tag_id)`);

    saveDatabase();
    console.log('📊 数据库初始化完成');
  } catch (err) {
    console.error('数据库初始化失败:', err.message);
    throw err;
  }
}

export function saveDatabase() {
  if (db) {
    try {
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_PATH, buffer);
    } catch (err) {
      console.error('保存数据库失败:', err.message);
    }
  }
}

