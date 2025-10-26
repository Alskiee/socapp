// Local fallback for pinned posts per user
// Stored as: { [userId]: string[] }
export function getPinnedForUser(userId) {
  const raw = localStorage.getItem('pinned_posts');
  const map = raw ? JSON.parse(raw) : {};
  return map[userId] || [];
}

export function togglePin(userId, postId) {
  const raw = localStorage.getItem('pinned_posts');
  const map = raw ? JSON.parse(raw) : {};
  const arr = new Set(map[userId] || []);
  if (arr.has(postId)) arr.delete(postId);
  else arr.add(postId);
  map[userId] = Array.from(arr);
  localStorage.setItem('pinned_posts', JSON.stringify(map));
  return map[userId];
}

export function isPinned(userId, postId) {
  return getPinnedForUser(userId).includes(postId);
}
