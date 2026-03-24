# Bug Fix Record

## Issue 1: 图片无法加载 (src="[object Promise]")

**症状**: 缩略图和预览图片无法显示，HTML 中显示 `src="[object Promise]"`

**原因**: `client/src/services/api.js` 中的 `fetchThumbnail`、`fetchPreview`、`fetchImage` 被错误声明为 `async` 函数

```javascript
// 错误代码
export async function fetchThumbnail(path) {
  return `${API_BASE}/thumbnail?path=${encodeURIComponent(path)}`;
}
```

`async` 函数返回 `Promise<string>` 而不是 `string`，导致 `<img src>` 接收到 Promise 对象

**修复**: 移除 `async` 关键字

```javascript
// 正确代码
export function fetchThumbnail(path) {
  return `${API_BASE}/thumbnail?path=${encodeURIComponent(path)}`;
}
```

**文件**: `client/src/services/api.js:8-18`

---

## Issue 2: 打开图片详情报错 `b.map is not a function`

**症状**: 点击图片打开 Modal 时控制台报错 `Uncaught TypeError: b.map is not a function`

**原因**:
1. `fetchTagsBatch` 返回值可能是 `undefined`
2. API 返回数据可能不是数组

**修复**:
- `client/src/pages/Browse.jsx`: 添加 `tags || {}` 防御
- `client/src/components/Modal.jsx`: 使用 `Array.isArray()` 确保是数组

```javascript
// Browse.jsx
setTagsMap(tags || {});

// Modal.jsx
setTags(Array.isArray(tagRes) ? tagRes : []);
setAllTags(Array.isArray(allTagsRes) ? allTagsRes : []);
```

**文件**: `client/src/pages/Browse.jsx:41`, `client/src/components/Modal.jsx:27-28`

---

## Issue 3: 标签查询返回 500 错误

**症状**: 打开图片详情时 `GET /api/tags/photo` 返回 500 错误

**原因**: SQL 查询中使用了模板字符串但写法有问题

```javascript
// 错误代码 - \$ 导致 ${} 不被解析
const result = db.exec(`SELECT ... WHERE pt.photo_path = '\${photoPath.replace(/'/g, "''")}' ...`);
```

`\$` 转义序列导致 `${photoPath...}` 被当作字面字符串而非变量插值，生成的 SQL 语法错误

**修复**: 预先处理路径变量

```javascript
// 正确代码
const safePath = photoPath.replace(/'/g, "''");
const result = db.exec(`SELECT ... WHERE pt.photo_path = '${safePath}' ...`);
```

**文件**: `server/routes/api.js:377-378`

---

## 根因分析

这些问题都是由于代码修改（可能是自动格式化或重构）导致的不一致问题：

1. `async` 关键字被添加到返回字符串的函数上
2. SQL 查询中的模板字符串变量插值被破坏
3. 缺少防御性编程检查

**建议**: 添加类型检查和单元测试防止此类问题再次发生

---

# Bug Fix Summary - 2026-03-20

## 1. 地址标签栏目与图片清单间距问题

**问题描述**：主页面上地址标签栏目（Breadcrumb）和下方的图片清单（Grid）上下贴得太紧。

**解决文件**：`client/src/pages/Browse.jsx`

**解决方案**：为加载状态、错误提示、空目录提示以及图片网格都添加了 `mt-6`/`mt-8` 上边距。

```jsx
{!loading && !error && items.length > 0 && (
  <div className="mt-8">
    <Grid ... />
  </div>
)}
```

---

## 2. 前端热更新与终端日志问题

**问题描述**：
- 代码更新后前端没有自动变化
- 前端的 `console.log` 在终端看不到

**解决文件**：`client/vite.config.js`

**解决方案**：添加了 `terminalLogger` Vite 插件，通过 WebSocket 将浏览器控制台日志转发到终端。

**输出样式**：
- `[HMR]` - 前端 console.log（青色）
- `[ERROR]` - 前端 console.error（红色）
- `[WARN]` - 前端 console.warn（黄色）
- `[INFO]` - 前端 console.info（绿色）

---

## 3. 路径未保存问题

**问题描述**：每次打开页面都会回到默认路径，而非上次访问的路径。

**解决文件**：`client/src/pages/Browse.jsx`

**解决方案**：在 `loadPath` 函数中，成功获取数据后将路径保存到 localStorage。

```jsx
setCurrentPath(data.path);
localStorage.setItem('photoViewerLastPath', data.path);
```

---

## 4. 地址标签栏点击不跳转

**问题描述**：点击地址标签栏中的任意标签，都只会跳转到首页。

**解决文件**：
- `client/src/components/Breadcrumb.jsx`
- `client/src/pages/Browse.jsx`

**解决方案**：
1. 给 Breadcrumb 组件添加 `onNavigate` 回调属性
2. 修复 `handleClick` 函数，使用传入的 `targetPath`

```jsx
// Breadcrumb.jsx
const handleClick = (targetPath) => {
  if (onNavigate) {
    onNavigate(targetPath);
  } else {
    navigate('/');
  }
};

// Browse.jsx
<Breadcrumb path={currentPath} onNavigate={handleOpenFolder} />
```

---

## 5. 缩略图与实际照片不一致

**问题描述**：偶尔出现缩略图显示的照片与打开后的照片不匹配。

**解决文件**：`server/routes/api.js`

**问题原因**：
1. 缩略图缓存 key 只基于 `path + mtime`，没有考虑文件大小
2. 没有设置浏览器缓存头

**解决方案**：
1. 缓存 key 改为 `path + mtime + size`
2. 添加缓存验证逻辑
3. 添加 `Cache-Control: no-cache` 头

```js
function getCachePath(filePath) {
  const stat = fs.statSync(filePath);
  const key = crypto.createHash('md5').update(filePath + stat.mtimeMs + stat.size).digest('hex');
  return path.join(CACHE_DIR, `${key}.jpg`);
}
```

**清除错误缓存**：`rm -rf thumbnail_cache/`

---

## 6. 标签页面点击标签后黑屏

**问题描述**：点击标签后页面黑屏，无法显示照片。

**解决文件**：`server/routes/api.js`

**问题原因**：`\${...}` 模板字符串语法错误，变量未被解析。

**解决的接口**：`/photos/by-tag` 和 `/tags/batch`

```js
// 错误（\$ 导致不解析）
result = db.exec(`SELECT ... WHERE tag_id = \${tagId}`);

// 正确
result = db.exec(`SELECT ... WHERE tag_id = ${tagId}`);
```

---

## 总结

本次共修复了 6 个问题：

| # | 问题 | 类型 |
|---|------|------|
| 1 | 地址标签与图片间距过紧 | UI 布局 |
| 2 | 前端热更新和终端日志 | 开发体验 |
| 3 | 路径未保存到 localStorage | 功能缺失 |
| 4 | Breadcrumb 点击不跳转 | 导航 Bug |
| 5 | 缩略图与照片不一致 | 缓存策略 |
| 6 | 标签页点击黑屏 | SQL 语法错误 |
