import { useEffect, useState } from 'react';
import { createPost } from '@/api/posts';
import { uploadToCloudinary } from '@/utils/cloudinary'; // Add this import
import { useToast } from '@/utils/Toast';
import { FaImage, FaPaperPlane, FaTimes, FaSmile, FaMapMarkerAlt } from 'react-icons/fa';
import Avatar from './Avatar';
import { useAuth } from '@/context/AuthContext';

export default function PostForm({ onCreated }) {
  const [content, setContent] = useState('');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const toast = useToast();
  const { user } = useAuth();

  const submit = async (e) => {
    e.preventDefault();
    if (!content.trim() && !file) return;

    setLoading(true);
    try {
      let imageUrl = null;

      // Upload to Cloudinary if there's a file
      if (file) {
        imageUrl = await uploadToCloudinary(file);
      }

      // Create post with JSON data (not FormData)
      await createPost({
        content: content.trim(),
        image_url: imageUrl, // Send the Cloudinary URL
      });

      setContent('');
      setFile(null);
      setPreviewUrl(null);
      setIsExpanded(false);
      toast.success('Post created successfully! 🎉');
      onCreated?.();
    } catch (e) {
      console.error('Post creation error:', e);
      toast.error('Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const removeImage = () => {
    setFile(null);
    setPreviewUrl(null);
  };

  return (
    <div className="bg-white/80 backdrop-blur-lg rounded-2xl border border-white/50 shadow-sm p-6 transition-all duration-300">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-start gap-4">
          <Avatar
            src={user?.profile_pic}
            username={user?.username}
            name={user?.name}
            size={48}
            to="/me"
            showOnline={true}
          />

          <div className="flex-1">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onFocus={() => setIsExpanded(true)}
              className="w-full border border-gray-200 rounded-2xl p-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none transition-all duration-200 bg-white/50 backdrop-blur-sm"
              placeholder="What's on your mind? 🌟"
              rows={isExpanded ? 4 : 2}
            />

            {previewUrl && (
              <div className="relative mt-3 rounded-2xl overflow-hidden border border-gray-200">
                <img src={previewUrl} alt="preview" className="w-full max-h-80 object-cover" />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-3 right-3 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
                >
                  <FaTimes size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        {(isExpanded || previewUrl) && (
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-gray-600 hover:text-purple-600 cursor-pointer transition-colors p-2 rounded-lg hover:bg-purple-50">
                <FaImage className="text-lg" />
                <span className="font-medium">Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>

              <button
                type="button"
                className="flex items-center gap-2 text-gray-600 hover:text-purple-600 transition-colors p-2 rounded-lg hover:bg-purple-50"
              >
                <FaSmile className="text-lg" />
                <span className="font-medium">Feeling</span>
              </button>

              <button
                type="button"
                className="flex items-center gap-2 text-gray-600 hover:text-purple-600 transition-colors p-2 rounded-lg hover:bg-purple-50"
              >
                <FaMapMarkerAlt className="text-lg" />
                <span className="font-medium">Location</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || (!content.trim() && !file)}
              className={`px-6 py-3 rounded-xl font-semibold shadow-lg transition-all duration-200 flex items-center gap-2 ${
                loading || (!content.trim() && !file)
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:shadow-xl transform hover:-translate-y-0.5'
              }`}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Posting...
                </>
              ) : (
                <>
                  <FaPaperPlane />
                  Post
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
