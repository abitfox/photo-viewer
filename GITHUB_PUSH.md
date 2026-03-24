# 上传 GitHub 命令总结

## 完整流程

### 1. 检查 Git 状态和远程仓库
```bash
git status && git remote -v
```
**目的：** 查看当前变更和已配置的远程仓库

---

### 2. 添加所有文件到暂存区
```bash
git add -A
```
**说明：** `-A` 参数添加所有变更（包括新增、修改和删除的文件）

---

### 3. 查看提交历史（可选）
```bash
git log -n 3 --oneline
```
**目的：** 保持提交信息风格一致

---

### 4. 提交变更
```bash
git commit -m "重构为 React 照片浏览器应用

- 迁移到 React + Vite + Tailwind CSS 前端架构
- 新增客户端组件：Grid, Header, Modal, Breadcrumb 等
- 新增页面：Browse, Favorites, Tags
- 后端重构为 Express 模块化结构
- 添加完整的项目文档和 BUGFIX 记录"
```
**说明：** 提交信息格式：第一行简短总结，空行后详细列表

---

### 5. 推送到 GitHub
```bash
git push origin main
```
**说明：** 将本地 `main` 分支推送到远程 `origin`

---

## 一键执行版本

```bash
# 进入项目目录
cd /Users/jack/.openclaw/workspace/photo-viewer

# 查看状态
git status && git remote -v

# 添加所有变更
git add -A

# 提交
git commit -m "提交说明"

# 推送
git push origin main
```

---

## 常用 Git 命令速查

| 命令 | 说明 |
|------|------|
| `git status` | 查看当前状态 |
| `git remote -v` | 查看远程仓库 |
| `git add -A` | 添加所有变更 |
| `git commit -m "msg"` | 提交变更 |
| `git push origin main` | 推送到 main 分支 |
| `git log -n 3` | 查看最近 3 次提交 |
| `git pull` | 拉取远程变更 |

---

## 本次提交统计

- **变更文件：** 95 个
- **新增行数：** 12,792 行
- **删除行数：** 2,065 行
- **提交哈希：** `a58cc6a`
- **仓库地址：** https://github.com/abitfox/local-photo-viewer
