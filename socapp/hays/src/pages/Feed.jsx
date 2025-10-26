import { useEffect, useState } from 'react';
import CreatePost from '../components/CreatePost';
import PostCard from '../components/PostCard';
import Sidebar from '@/components/Sidebar';
import api from '../api/axios';

export default function Feed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch all posts from backend
  const fetchPosts = async () => {
    try {
      if (!refreshing) setLoading(true);
      const res = await api.get('/posts/');
      const sorted = res.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setPosts(sorted);
    } catch (err) {
      console.error('❌ Failed to load posts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  // When a post is created successfully
  const handlePostCreated = (newPost) => {
    // Instantly show it in the feed without re-fetching
    setPosts((prev) => [newPost, ...prev]);
  };

  // When post data changes (like, comment, delete)
  const handlePostChanged = async () => {
    setRefreshing(true);
    await fetchPosts();
  };

  return (
    <div className="px-4 py-6 bg-gradient-to-br from-purple-100 via-purple-200 to-purple-300 min-h-screen">
      <div className="container mx-auto">
        <div className="flex gap-6">
          <Sidebar />
          <div className="flex-1 max-w-2xl mx-auto space-y-6">
            {/* Create Post Section */}
            <div className="bg-white/80 backdrop-blur-lg p-5 rounded-3xl shadow-lg border border-purple-200">
              <CreatePost onPostCreated={handlePostCreated} />
            </div>

            {/* Feed Header */}
            <div className="flex items-center justify-between text-purple-700 mt-2 mb-1">
              <h2 className="text-lg font-semibold">🌸 Latest Posts</h2>
              <button
                onClick={fetchPosts}
                className="text-sm px-3 py-1 rounded-full bg-purple-600 text-white hover:bg-purple-700 active:scale-95 transition"
              >
                Refresh
              </button>
            </div>

            {/* Posts Feed */}
            {loading ? (
              <div className="text-center text-purple-500 mt-10 animate-pulse">
                Loading posts...
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center text-gray-600 mt-10">
                No posts yet — be the first to share something! 💬
              </div>
            ) : (
              <div className="space-y-5">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} onChanged={handlePostChanged} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
