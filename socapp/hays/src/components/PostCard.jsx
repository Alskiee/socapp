import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useToast } from '../utils/Toast';
import { likePost, updatePost, deletePost as removePost } from '../api/posts';
import { useAuth } from '../context/AuthContext';
import { isPinned, togglePin } from '../utils/pins';
import { uploadToCloudinary } from '../utils/cloudinary'; // Add this import
import TimeAgo from 'react-timeago';
import {
  FaHeart,
  FaRegHeart,
  FaRegComment,
  FaThumbtack,
  FaEllipsisH,
  FaEdit,
  FaTrash,
  FaShare,
  FaTimes, // Add this import
  FaImage, // Add this import
} from 'react-icons/fa';
import CommentSection from './CommentSection';
import Avatar from './Avatar';

export default function PostCard({ post, onChanged, pinned = false }) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const { user } = useAuth();
  const [showEditModal, setShowEditModal] = useState(false);
  const [editText, setEditText] = useState(post.content || '');
  const [savingEdit, setSavingEdit] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editImageFile, setEditImageFile] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState(() => {
    const raw = post.image_url;
    if (!raw) return null;
    return raw.startsWith('http') ? raw : null; // Cloudinary URLs are always full URLs
  });
  const [showMenu, setShowMenu] = useState(false);

  const userData = post?.user || {};
  const BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
  const postPinned = user ? isPinned(user.id, post.id) : false;
  const [liked, setLiked] = useState(!!post.liked);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const isOwner = user && userData?.id === user?.id;

  const toggleLike = async () => {
    const nextLiked = !liked;
    const prevLiked = liked;
    const prevCount = likesCount;
    setLiked(nextLiked);
    setLikesCount((c) => (nextLiked ? c + 1 : Math.max(0, c - 1)));

    try {
      setSubmitting(true);
      await likePost(post.id);
      onChanged?.();
    } catch (e) {
      setLiked(prevLiked);
      setLikesCount(prevCount);
      toast.error(e.response?.data?.detail || 'Failed to like post');
    } finally {
      setSubmitting(false);
    }
  };

  const doTogglePin = () => {
    if (!user) return toast.error('Login required');
    togglePin(user.id, post.id);
    onChanged?.();
  };

  const handleEditSubmit = async () => {
    if (!editText.trim() && !editImageFile) return;

    try {
      setSavingEdit(true);

      let imageUrl = post.image_url; // Keep existing image by default

      // Upload new image to Cloudinary if changed
      if (editImageFile) {
        imageUrl = await uploadToCloudinary(editImageFile);
      } else if (!editImagePreview && post.image_url) {
        // Image was removed
        imageUrl = null;
      }

      // Update post with Cloudinary URL
      await updatePost(post.id, {
        content: editText.trim(),
        image_url: imageUrl,
      });

      toast.success('✨ Post updated successfully!');
      setShowEditModal(false);
      setEditImageFile(null);
      onChanged?.();
    } catch (error) {
      console.error('Error updating post:', error);
      toast.error('Failed to update post 😢');
    } finally {
      setSavingEdit(false);
    }
  };

  const createdAt = post?.created_at || new Date().toISOString();

  return (
    <div className="bg-white/80 backdrop-blur-lg rounded-2xl border border-white/50 shadow-sm hover:shadow-md transition-all duration-300">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Avatar
              src={userData.avatar_url || userData.profile_pic}
              username={userData.username}
              name={userData.name}
              size={48}
              to={`/profile/${userData.id}`}
              showOnline={true}
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  to={`/profile/${userData.id}`}
                  className="font-semibold text-gray-900 hover:text-purple-600 transition-colors truncate"
                >
                  {userData.name || userData.username || 'Anonymous'}
                </Link>
                <span className="text-sm text-gray-500 truncate">@{userData.username}</span>
                <span className="text-sm text-gray-400">•</span>
                <span className="text-sm text-gray-500">
                  <TimeAgo date={createdAt} />
                </span>
                {(pinned || postPinned) && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                    <FaThumbtack size={10} /> Pinned
                  </span>
                )}
              </div>

              {userData.bio && (
                <p className="text-sm text-gray-600 mt-1 truncate">{userData.bio}</p>
              )}
            </div>
          </div>

          {/* Menu Button */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <FaEllipsisH size={16} />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-10 bg-white rounded-xl shadow-lg border border-gray-100 w-48 py-2 z-20">
                {isOwner && (
                  <>
                    <button
                      onClick={() => {
                        setShowEditModal(true);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <FaEdit className="text-blue-500" /> Edit Post
                    </button>
                    <button
                      onClick={() => {
                        setShowDeleteModal(true);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <FaTrash /> Delete Post
                    </button>
                    <div className="border-t border-gray-100 my-1"></div>
                  </>
                )}
                <button
                  onClick={doTogglePin}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <FaThumbtack className={postPinned ? 'text-purple-500' : 'text-gray-500'} />
                  {postPinned ? 'Unpin Post' : 'Pin Post'}
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <FaShare /> Share Post
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Post Content */}
        <div className="mb-4">
          <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{post.content}</p>
        </div>

        {/* Post Image - Simplified for Cloudinary */}
        {post.image_url && (
          <div className="mb-4 rounded-2xl overflow-hidden border border-gray-200">
            <img
              src={post.image_url} // Cloudinary URLs are always full URLs
              alt="post"
              className="w-full max-h-96 object-cover"
            />
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
          <div className="flex items-center gap-4">
            <span>{likesCount} likes</span>
            <span>{post.comments_count || 0} comments</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center border-t border-gray-100 pt-3">
          <button
            onClick={toggleLike}
            disabled={submitting}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-colors ${
              liked
                ? 'text-purple-600 hover:text-purple-700'
                : 'text-gray-600 hover:text-purple-600'
            }`}
          >
            {liked ? <FaHeart className="text-purple-600" /> : <FaRegHeart />}
            <span className="font-medium">Like</span>
          </button>

          <button
            onClick={() => setShowComments((s) => !s)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-colors ${
              showComments ? 'text-purple-600' : 'text-gray-600 hover:text-purple-600'
            }`}
          >
            <FaRegComment />
            <span className="font-medium">Comment</span>
          </button>

          <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-gray-600 hover:text-purple-600 transition-colors">
            <FaShare />
            <span className="font-medium">Share</span>
          </button>
        </div>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="border-t border-gray-100">
          <div className="p-6 pt-4">
            <CommentSection postId={post.id} onChanged={onChanged} />
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Edit Post</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <FaTimes size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full rounded-xl border border-gray-200 p-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
                rows={4}
                placeholder="What's on your mind?"
              />

              {editImagePreview && (
                <div className="relative rounded-2xl overflow-hidden border border-gray-200">
                  <img
                    src={editImagePreview}
                    alt="preview"
                    className="w-full max-h-80 object-cover"
                  />
                  <div className="absolute top-3 right-3 flex gap-2">
                    <label className="px-3 py-2 bg-white/90 backdrop-blur-sm rounded-lg text-sm font-medium text-gray-700 hover:bg-white cursor-pointer transition-colors">
                      Change
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setEditImageFile(file);
                          const reader = new FileReader();
                          reader.onload = () => setEditImagePreview(reader.result);
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="px-3 py-2 bg-white/90 backdrop-blur-sm rounded-lg text-sm font-medium text-red-600 hover:bg-white transition-colors"
                      onClick={() => {
                        setEditImageFile(null);
                        setEditImagePreview(null);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}

              {!editImagePreview && (
                <label className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 cursor-pointer p-3 rounded-lg hover:bg-purple-50 transition-colors">
                  <FaImage />
                  <span className="font-medium">Add Image</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setEditImageFile(file);
                      const reader = new FileReader();
                      reader.onload = () => setEditImagePreview(reader.result);
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditImageFile(null);
                  setEditImagePreview(post.image_url || null);
                }}
                className="px-6 py-3 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSubmit}
                disabled={savingEdit || (!editText.trim() && !editImageFile)}
                className={`px-6 py-3 rounded-xl text-white font-medium transition-colors ${
                  savingEdit || (!editText.trim() && !editImageFile)
                    ? 'bg-purple-400 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {savingEdit ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </div>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaTrash className="text-red-500 text-2xl" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">Delete Post?</h3>
            <p className="text-gray-600 text-center text-sm mb-6">
              This action cannot be undone. The post will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-3 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    await removePost(post.id);
                    toast.success('Post deleted successfully');
                    setShowDeleteModal(false);
                    onChanged?.();
                  } catch {
                    toast.error('Failed to delete post 😞');
                  }
                }}
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
