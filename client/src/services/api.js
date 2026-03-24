const API_BASE = '/api';

export async function fetchList(path) {
  const res = await fetch(`${API_BASE}/list?path=${encodeURIComponent(path)}`);
  return res.json();
}

export function fetchThumbnail(path) {
  return `${API_BASE}/thumbnail?path=${encodeURIComponent(path)}`;
}

export function fetchPreview(path) {
  return `${API_BASE}/preview?path=${encodeURIComponent(path)}`;
}

export function fetchImage(path) {
  return `${API_BASE}/image?path=${encodeURIComponent(path)}`;
}

export async function fetchFavorites() {
  const res = await fetch(`${API_BASE}/favorites`);
  return res.json();
}

export async function toggleFavorite(path, action) {
  const res = await fetch(`${API_BASE}/favorites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, action }),
  });
  return res.json();
}

export async function checkFavorite(path) {
  const res = await fetch(`${API_BASE}/favorites/check?path=${encodeURIComponent(path)}`);
  return res.json();
}

export async function fetchTags() {
  const res = await fetch(`${API_BASE}/tags`);
  return res.json();
}

export async function createTag(name, color) {
  const res = await fetch(`${API_BASE}/tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, color }),
  });
  return res.json();
}

export async function deleteTag(id) {
  const res = await fetch(`${API_BASE}/tags/${id}`, { method: 'DELETE' });
  return res.json();
}

export async function fetchPhotoTags(path) {
  const res = await fetch(`${API_BASE}/tags/photo?path=${encodeURIComponent(path)}`);
  return res.json();
}

export async function addPhotoTag(path, tagId) {
  console.log(path,tagId)
  const res = await fetch(`${API_BASE}/tags/photo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, tagId }),
  });
  return res.json();
}

export async function removePhotoTag(path, tagId) {
  const res = await fetch(`${API_BASE}/tags/photo/${encodeURIComponent(path)}/${tagId}`, {
    method: 'DELETE',
  });
  return res.json();
}

export async function fetchPhotosByTag(tagId) {
  const res = await fetch(`${API_BASE}/photos/by-tag?tagId=${tagId}`);
  return res.json();
}

export async function fetchTagsBatch(paths) {
  const res = await fetch(`${API_BASE}/tags/batch?paths=${paths.join(',')}`);
  return res.json();
}
