# 照片浏览器 - 部署及使用说明

## 项目简介

本地照片/视频浏览器，支持浏览、收藏、标签管理功能。

### 技术栈

- **前端**：React 19 + Vite 6 + Tailwind CSS
- **后端**：Express 4 + SQLite (sql.js)
- **图片处理**：Sharp (缩略图)、ffmpeg (视频缩略图)

---

## 环境要求

- Node.js 18+
- npm 9+
- ffmpeg（用于视频缩略图生成，macOS 可通过 `brew install ffmpeg` 安装）

---

## 安装

```bash
npm install
```

---

## 开发模式

```bash
npm run dev
```

同时启动：
- **前端**：http://localhost:5173
- **后端**：http://localhost:3456

前端会自动代理 `/api` 请求到后端 3456 端口。

---

## 生产构建

### 1. 构建前端

```bash
npm run build
```

产物输出到 `client/dist/`

### 2. 启动生产服务器

```bash
npm run start
```

生产服务器通过 Express 提供静态文件，监听 http://localhost:3456

---

## 目录访问权限

后端默认只允许访问以下目录：

| 路径 | 说明 |
|------|------|
| `/Users/xxxx/Pictures` | 图片目录 |

如需添加其他目录，修改 `server/routes/api.js` 中的 `ALLOWED_ROOTS` 数组：

```javascript
const ALLOWED_ROOTS = [
  '/Users/xxx/Pictures',
  '/your/custom/path',  // 添加新路径
];
```

---

## 功能说明

### 1. 浏览照片

1. 在顶部地址栏输入目录路径
2. 点击「浏览」按钮或按回车
3. 进入子文件夹可点击文件夹卡片

### 2. 查看大图/视频

- 点击任意照片/视频卡片打开详情
- 使用左右箭头键或点击左右按钮切换上一张/下一张
- 支持触摸滑动切换

### 3. 收藏功能

- 点击照片右下角的 ⭐ 图标添加收藏
- 或在详情页面点击「收藏」按钮
- 收藏数据保存在 `favorites.json`

### 4. 标签管理

1. 点击顶部「标签」进入标签页面
2. 点击卡片可查看该标签下的所有照片
3. 为照片添加标签：在详情页面点击「+ 添加标签」

---

## 数据存储

| 数据类型 | 存储位置 |
|----------|----------|
| 照片信息 | 本地文件系统 |
| 缩略图缓存 | `thumbnail_cache/` |
| 收藏 | `favorites.json` |
| 标签 | `photo_viewer.db` (SQLite) |

### 清除缩略图缓存

```bash
rm -rf thumbnail_cache/
```

---

## 端口说明

| 端口 | 服务 | 说明 |
|------|------|------|
| 5173 | Vite Dev Server | 开发模式前端 |
| 3456 | Express Server | 后端 API + 生产前端 |

---

## 常见问题

### Q: 视频缩略图显示失败？

确保已安装 ffmpeg：
```bash
brew install ffmpeg
```

### Q: HEIC 格式照片无法显示？

macOS 自带 `sips` 命令可处理 HEIC，无需额外安装。

### Q: 缩略图与实际照片不一致？

可能是缓存问题，清除缩略图缓存：
```bash
rm -rf thumbnail_cache/
```

### Q: 如何查看后端日志？

后端 `console.log` 会直接输出到终端。前端的 `console.log` 也会通过 WebSocket 转发到终端显示。

---

## 项目结构

```
photo-viewer/
├── client/                 # React 前端
│   ├── src/
│   │   ├── components/     # React 组件
│   │   ├── pages/         # 页面
│   │   ├── services/      # API 调用
│   │   └── context/       # 状态管理
│   └── vite.config.js     # Vite 配置
├── server/                 # Express 后端
│   ├── routes/
│   │   └── api.js         # API 路由
│   ├── db/
│   │   └── database.js    # SQLite 数据库
│   └── index.js           # 服务器入口
├── thumbnail_cache/        # 缩略图缓存
├── favorites.json          # 收藏数据
└── photo_viewer.db        # SQLite 数据库
```
