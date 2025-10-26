import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { FaPaperPlane, FaEllipsisH, FaEdit, FaTrash, FaCheck, FaTimes } from 'react-icons/fa';
import TimeAgo from 'react-timeago';
import { getComments, addComment, updateComment, deleteComment } from '../api/comments';
import Avatar from './Avatar';

export default function CommentSection({ postId, onChanged }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchComments = async () => {
    try {
      const res = await getComments(postId);
      setComments(res.data || []);
    } catch (err) {
      console.error('❌ Failed to fetch comments:', err);
    } finally {
      setFetching(false);
    }
  };

  const openEdit = (comment) => {
    setMenuOpenId(null);
    setEditTarget(comment);
    setEditText(comment.content || '');
  };

  const cancelEdit = () => {
    setEditTarget(null);
    setEditText('');
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    if (!editText.trim()) return;
    setSavingEdit(true);
    try {
      await updateComment(editTarget.id, { content: editText.trim() });
      setComments((prev) =>
        prev.map((c) => (c.id === editTarget.id ? { ...c, content: editText.trim() } : c)),
      );
      if (onChanged) onChanged();
      cancelEdit();
    } catch (err) {
      console.error('❌ Failed to update comment:', err);
      alert(err.response?.data?.detail || 'Failed to update comment');
    } finally {
      setSavingEdit(false);
    }
  };

  const openDelete = (comment) => {
    setMenuOpenId(null);
    setDeleteTarget(comment);
  };

  const cancelDelete = () => setDeleteTarget(null);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteComment(deleteTarget.id);
      setComments((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      if (onChanged) onChanged();
      cancelDelete();
    } catch (err) {
      console.error('❌ Failed to delete comment:', err);
      alert(err.response?.data?.detail || 'Failed to delete comment');
    }
  };

  useEffect(() => {
    fetchComments();
  }, [postId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!user) {
      alert('Please log in to comment.');
      return;
    }
    if (!text.trim()) return;

    setLoading(true);
    try {
      const res = await addComment(postId, { content: text.trim() });
      const newComment = res.data;

      if (!newComment.user && user) {
        newComment.user = {
          id: user.id,
          username: user.username,
          name: user.name,
        };
      }

      setComments((prev) => [...prev, newComment]);
      setText('');
      if (onChanged) onChanged();
    } catch (err) {
      console.error('❌ Failed to add comment:', err);
      alert(err.response?.data?.detail || 'Failed to add comment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Comments List */}
      {fetching ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-500 border-t-transparent"></div>
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-6 text-gray-500 text-sm">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <span className="text-2xl">💬</span>
          </div>
          No comments yet — be the first!
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => {
            const userData = c.user || {};
            const isOwner = user && userData.id === user.id;

            return (
              <div
                key={c.id}
                className="flex items-start gap-3 group hover:bg-white/50 rounded-xl p-3 transition-all duration-200"
              >
                <Avatar
                  src={userData.avatar_url || userData.profile_pic}
                  username={userData.username}
                  name={userData.name}
                  size={40}
                  to={`/profile/${userData.id}`}
                  showOnline={true}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900 text-sm">
                      {userData.name || userData.username || 'Anonymous'}
                    </span>
                    <span className="text-xs text-gray-500">
                      <TimeAgo date={c.created_at} />
                    </span>
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed">{c.content}</p>
                </div>

                {isOwner && (
                  <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => setMenuOpenId(menuOpenId === c.id ? null : c.id)}
                      className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <FaEllipsisH size={14} />
                    </button>

                    {menuOpenId === c.id && (
                      <div className="absolute right-0 top-8 bg-white rounded-xl shadow-lg border border-gray-100 w-32 py-1 z-10">
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <FaEdit className="text-blue-500" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => openDelete(c)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <FaTrash /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Comment Form */}
      <form onSubmit={handleAdd} className="flex items-center gap-3 pt-4 border-t border-gray-100">
        <Avatar
          src={user?.profile_pic}
          username={user?.username}
          name={user?.name}
          size={40}
          showOnline={true}
        />
        <div className="flex-1 relative">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a comment..."
            className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent bg-gray-50/50 backdrop-blur-sm transition-all duration-200"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !text.trim()}
          className={`p-3 rounded-xl transition-all duration-200 ${
            loading || !text.trim()
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:shadow-lg transform hover:-translate-y-0.5'
          }`}
        >
          <FaPaperPlane size={14} />
        </button>
      </form>

      {/* Edit Modal */}
      {editTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
          onClick={cancelEdit}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Comment</h3>
            <textarea
              className="w-full rounded-xl border border-gray-200 p-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
              rows={3}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={cancelEdit}
                className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={savingEdit}
                className={`px-4 py-2 rounded-lg text-white font-medium transition-colors ${
                  savingEdit ? 'bg-purple-400' : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
          onClick={cancelDelete}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaTrash className="text-red-500 text-xl" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
              Delete Comment?
            </h3>
            <p className="text-gray-600 text-center text-sm mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={cancelDelete}
                className="flex-1 px-4 py-3 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
