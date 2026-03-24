# 照片浏览器 React 重构开发总结

## 项目概述

将原有的原生 HTML/CSS/JS 单页应用重构为 **React 19 + Express.js** 的前后端分离架构。

### 重构前技术栈
- 后端：Express.js（与前端混在一起）
- 前端：原生 HTML/CSS/JS（约 2100 行）
- 数据库：sql.js（客户端 WASM）
- 端口：3456

### 重构后技术栈
| 层级 | 技术 |
|------|------|
| 前端框架 | React 19 + Vite 6 |
| 样式 | Tailwind CSS 3 |
| 路由 | React Router DOM 7 |
| 后端 | Express.js 4 |
| 数据库 | sql.js（服务器端） |
| 图像处理 | sharp |
| 视频缩略图 | ffmpeg |

---

## 项目结构

```
photo-viewer/
├── client/                      # React 前端
│   ├── src/
│   │   ├── components/         # UI 组件
│   │   │   ├── Breadcrumb.jsx  # 路径导航
│   │   │   ├── Grid.jsx        # 瀑布流网格
│   │   │   ├── Header.jsx       # 顶部导航
│   │   │   ├── Layout.jsx       # 布局容器
│   │   │   ├── Modal.jsx        # 图片/视频预览
│   │   │   ├── PathBar.jsx      # 路径输入栏
│   │   │   └── TagPicker.jsx    # 标签选择器
│   │   ├── context/
│   │   │   └── AppContext.jsx  # 全局状态管理
│   │   ├── pages/
│   │   │   ├── Browse.jsx      # 浏览页
│   │   │   ├── Favorites.jsx    # 收藏页
│   │   │   └── Tags.jsx        # 标签页
│   │   ├── services/
│   │   │   └── api.js          # API 调用封装
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── vite.config.js          # Vite 配置（含 API 代理）
│   └── package.json
├── server/                      # Express 后端
│   ├── routes/
│   │   └── api.js               # API 路由
│   ├── db/
│   │   └── database.js          # 数据库初始化
│   └── index.js                 # 服务入口
├── package.json                 # Workspace 根配置
└── node_modules/
```

---

## 开发过程

### 1. 架构设计

采用 npm workspaces 实现 Monorepo 结构：

```json
{
  "workspaces": ["client", "server"],
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:client": "npm run dev --workspace=client",
    "dev:server": "npm run dev --workspace=server"
  }
}
```

### 2. 后端搭建

#### 2.1 数据库迁移

原项目使用客户端 sql.js，重构后改为服务器端：

```javascript
// server/db/database.js
import initSqlJs from 'sql.js';

const projectRoot = path.resolve(__dirname, '..', '..');
const DB_PATH = path.join(projectRoot, 'photo_viewer.db');

export async function initDatabase() {
  const wasmPath = path.join(projectRoot, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const SQL = await initSqlJs({ locateFile: file => wasmPath });

  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }
  // 创建表...
}
```

#### 2.2 API 路由

将原有 API 整理到 `server/routes/api.js`，包括：

- `GET /api/list` - 获取目录列表
- `GET /api/thumbnail` - 获取缩略图
- `GET /api/preview` - 获取预览图
- `GET /api/image` - 获取原图/视频
- `GET/POST /api/favorites` - 收藏管理
- `GET/POST/DELETE /api/tags` - 标签管理
- `GET/POST/DELETE /api/tags/photo` - 照片标签管理
- `GET /api/photos/by-tag` - 按标签筛选
- `GET /api/tags/batch` - 批量获取标签

### 3. 前端开发

#### 3.1 组件设计

| 组件 | 功能 |
|------|------|
| Header | 顶部导航栏，三个 Tab（浏览/收藏/标签） |
| PathBar | 路径输入、前进/后退、历史记录 |
| Breadcrumb | 面包屑导航 |
| Grid | 瀑布流布局，支持文件夹/图片/视频 |
| Modal | 全屏预览，支持左右切换 |
| TagPicker | 标签选择/创建弹窗 |

#### 3.2 状态管理

使用 React Context 统一管理全局状态：

```javascript
// AppContext.jsx
export function AppProvider({ children }) {
  const [favorites, setFavorites] = useState([]);
  const [tags, setTags] = useState([]);
  const [currentView, setCurrentView] = useState('browse');
  const [currentPath, setCurrentPath] = useState('');
  // 导航历史管理...
}
```

#### 3.3 Tailwind 配置

```javascript
// tailwind.config.js
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: '#e94560',
        secondary: '#ff6b6b',
        dark: {
          100: '#1a1a2e',
          200: '#16213e',
          300: '#0f0f1a',
          400: '#0f3460',
        },
      },
    },
  },
}
```

### 4. 遇到的问题及解决

#### 4.1 better-sqlite3 编译失败

**问题**：环境 Python 版本为 3.7.6，node-gyp 编译失败。

**解决**：改用 `sql.js`（纯 JavaScript 实现，无需编译）。

#### 4.2 sql.js WASM 文件路径

**问题**：WASM 文件路径使用 `process.cwd()` 在子包中不正确。

**解决**：使用 `path.resolve(__dirname, '..', '..')` 获取项目根目录。

#### 4.3 sql.js API 差异

**问题**：sql.js 的 API 与 better-sqlite3 不同（无 `.prepare().all()` 方法）。

**解决**：使用 `db.exec()` + 手动的结果映射：

```javascript
const result = db.exec('SELECT * FROM tags');
const tags = result.length > 0
  ? result[0].values.map(row => ({
      id: row[0], name: row[1], color: row[2]
    }))
  : [];
```

---

## API 代理配置

Vite 开发服务器配置了 API 代理：

```javascript
// vite.config.js
export default {
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3456',
        changeOrigin: true,
      },
    },
  },
}
```

---

## 构建与部署

### 开发模式
```bash
npm run dev          # 同时启动前后端
npm run dev:client  # 仅前端 (5173)
npm run dev:server  # 仅后端 (3456)
```

### 生产构建
```bash
npm run build        # 构建前端
npm start            # 启动后端服务
```

访问 http://localhost:3456

---

## 功能清单

| 功能 | 状态 |
|------|------|
| 目录浏览 | ✅ |
| 缩略图生成 | ✅ |
| 视频缩略图（ffmpeg） | ✅ |
| HEIC 格式支持 | ✅ |
| 全屏预览 | ✅ |
| 收藏功能 | ✅ |
| 标签管理 | ✅ |
| 键盘导航 | ✅ |
| 触摸滑动 | ✅ |
| 响应式布局 | ✅ |

---

## 后续优化建议

1. **性能优化**：图片懒加载、虚拟列表
2. **状态管理**：考虑使用 Zustand 或 Redux 替代 Context
3. **SSR**：可选添加服务端渲染
4. **PWA**：添加离线支持
5. **国际化**：多语言支持
