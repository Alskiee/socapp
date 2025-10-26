import { useState } from 'react';
import api from '../api/axios';
import { uploadToCloudinary } from '../utils/cloudinary'; // Add this import
import { FaImage, FaPaperPlane } from 'react-icons/fa';
import { useToast } from '../utils/Toast';
import { useAuth } from '../context/AuthContext';

export default function CreatePost({ onPostCreated }) {
  const { user } = useAuth();
  const toast = useToast();

  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(file);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ensure content exists
    const safeContent = content == null ? '' : content;

    if (!safeContent.trim() && !image) {
      toast.error('Please write something or upload an image.');
      return;
    }

    setLoading(true);

    try {
      let imageUrl = null;

      // Upload to Cloudinary if there's an image
      if (image) {
        console.log('Uploading to Cloudinary...', image);
        imageUrl = await uploadToCloudinary(image);
        console.log('Cloudinary URL received:', imageUrl);
      }

      // Send JSON data with Cloudinary URL (NOT FormData)
      const postData = {
        content: safeContent.trim(),
        image_url: imageUrl, // This will be the Cloudinary URL or null
      };

      // DEBUG: log what we're sending
      console.log('Sending JSON to backend:', postData);

      // Send as JSON with proper Content-Type
      const res = await api.post('/posts/', postData, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      toast.success('Posted!');
      setContent('');
      setImage(null);
      setPreview(null);

      if (onPostCreated) onPostCreated(res.data);
    } catch (err) {
      console.error('Create post error:', err);

      // Helpful toast with server response when available
      const status = err?.response?.status;
      const data = err?.response?.data;
      let message = err.message || 'Failed to create post';

      if (data) {
        // If API returns {"detail": "..."} or validation errors
        if (data.detail) message = data.detail;
        else message = JSON.stringify(data);
      }

      toast.error(`Post failed${status ? ` (HTTP ${status})` : ''}: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        placeholder="What's on your mind? 🌸"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        // ensure typed text is visible (not white)
        className="w-full rounded-2xl border border-purple-300 p-3 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-purple-400 outline-none resize-none transition"
      />

      {preview && (
        <div className="relative mt-3">
          <img
            src={preview}
            alt="preview"
            className="rounded-2xl w-full max-h-64 object-cover shadow-md"
          />
          <button
            type="button"
            onClick={() => {
              setPreview(null);
              setImage(null);
            }}
            className="absolute top-2 right-2 bg-purple-700 text-white rounded-full px-2 py-1 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-purple-700 cursor-pointer hover:text-purple-900 transition">
          <FaImage />
          <span className="font-medium">Add Image</span>
          <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
        </label>

        <button
          type="submit"
          disabled={loading}
          className={`flex items-center gap-2 px-5 py-2 rounded-full text-white font-semibold shadow-md transition ${
            loading ? 'bg-purple-400 cursor-wait' : 'bg-purple-600 hover:bg-purple-700'
          }`}
        >
          <FaPaperPlane />
          {loading ? 'Posting...' : 'Post'}
        </button>
      </div>
    </form>
  );
}
