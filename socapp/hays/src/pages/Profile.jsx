import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getUser, followUser, unfollowUser, getMe } from '@/api/users';
import PostCard from '@/components/PostCard';
import { useToast } from '@/utils/Toast';
import api from '@/api/axios';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/context/AuthContext';
import { getPinnedForUser } from '@/utils/pins';

export default function Profile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const { user: me } = useAuth();
  const [meData, setMeData] = useState(null);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [meRes, uRes, pRes] = await Promise.all([
        getMe(),
        getUser(id, me?.id),
        api.get('/posts/', { params: { user_id: id } }),
      ]);
      setMeData(meRes.data);
      setUser(uRes.data);
      const data = pRes.data;
      // If viewing own profile, sort pinned to top
      if (me && String(me.id) === String(id)) {
        const pinnedIds = new Set(getPinnedForUser(me.id));
        const pin = data.filter((p) => pinnedIds.has(p.id));
        const rest = data.filter((p) => !pinnedIds.has(p.id));
        setPosts([...pin, ...rest]);
      } else {
        setPosts(data);
      }
    } catch (e) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleMessage = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await api.post('/messages/start', { user_id: user.id });
      const cid = res?.data?.id || res?.data?.conversation_id || null;
      if (cid) {
        // Best-effort: inform backend to surface in sidebar (if supported)
        try {
          await api.post('/messages/add_to_sidebar', { conversation_id: cid });
        } catch {}
        navigate(`/chat/${cid}`);
      } else {
        navigate(`/chat/${user.id}`);
      }
    } catch {
      navigate(`/chat/${user.id}`);
    }
  };
  useEffect(() => {
    load();
  }, [id]);

  const onFollow = async () => {
    try {
      await followUser(id);
      // Optimistic update
      setUser((prev) =>
        prev
          ? { ...prev, is_following: true, followers_count: (prev.followers_count || 0) + 1 }
          : prev,
      );
      await load();
    } catch (e) {
      toast.error('Failed to follow');
    }
  };
  const onUnfollow = async () => {
    try {
      await unfollowUser(id);
      // Optimistic update
      setUser((prev) =>
        prev
          ? {
              ...prev,
              is_following: false,
              followers_count: Math.max(0, (prev.followers_count || 0) - 1),
            }
          : prev,
      );
      await load();
    } catch (e) {
      toast.error('Failed to unfollow');
    }
  };
  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Not found</div>;

  const isSelf = me && String(me.id) === String(id);
  const followsMe = meData?.followers_ids?.includes?.(user.id);
  const postsCount = posts.length;
  const avatar = user.profile_pic || user.avatar_url || null;

  const loadFollowers = async () => {
    setLoadingList(true);
    try {
      const res = await api.get(`/users/${id}/followers`);
      setFollowers(res.data || []);
      setShowFollowers(true);
    } finally {
      setLoadingList(false);
    }
  };
  const loadFollowing = async () => {
    setLoadingList(true);
    try {
      const res = await api.get(`/users/${id}/following`);
      setFollowing(res.data || []);
      setShowFollowing(true);
    } finally {
      setLoadingList(false);
    }
  };

  const FollowButton = () => {
    if (isSelf) {
      return (
        <a
          href="/me"
          className="px-4 py-1.5 rounded-full text-sm font-medium bg-white text-purple-700 border border-purple-300 hover:bg-purple-50"
        >
          Edit Profile
        </a>
      );
    }
    if (user.is_following) {
      return (
        <button
          onClick={onUnfollow}
          className="px-4 py-1.5 rounded-full text-sm font-medium bg-purple-600 text-white hover:bg-purple-700"
        >
          Following ✓
        </button>
      );
    }
    // Not following
    return (
      <button
        onClick={onFollow}
        className="px-4 py-1.5 rounded-full text-sm font-medium bg-white text-purple-700 border border-purple-300 hover:bg-purple-50"
      >
        {followsMe ? 'Follow Back' : 'Follow'}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-purple-200 to-purple-300 px-4 py-6">
      <div className="container mx-auto">
        <div className="flex gap-6">
          <Sidebar />
          <div className="flex-1 max-w-2xl mx-auto space-y-4">
            {/* Header Card */}
            <div className="bg-white/85 rounded-2xl shadow-md p-5 border border-purple-100">
              <div className="flex items-center gap-4">
                <img
                  src={avatar || '/avatar-placeholder.svg'}
                  alt={`${user.username}'s avatar`}
                  className="h-20 w-20 rounded-full object-cover border-2 border-purple-300 shadow-sm"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/avatar-placeholder.svg';
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xl font-semibold text-gray-900">{user.username}</div>
                  {user.bio && <div className="text-gray-700 truncate">{user.bio}</div>}
                  <div className="text-sm text-gray-600 mt-1 flex gap-4">
                    <button
                      type="button"
                      onClick={loadFollowers}
                      className="hover:text-purple-700 underline-offset-2 hover:underline"
                    >
                      {user.followers_count || 0} followers
                    </button>
                    <button
                      type="button"
                      onClick={loadFollowing}
                      className="hover:text-purple-700 underline-offset-2 hover:underline"
                    >
                      {user.following_count || 0} following
                    </button>
                    <span>{postsCount} posts</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <FollowButton />
                  {!isSelf && (
                    <button
                      onClick={handleMessage}
                      className="px-4 py-1.5 rounded-full text-sm font-medium bg-purple-600 text-white hover:bg-purple-700"
                      title="Message this user"
                    >
                      💬 Message
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Posts */}
            <div className="space-y-4">
              {posts.map((p) => (
                <PostCard key={p.id} post={p} onChanged={load} />
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* Followers Modal */}
      {showFollowers && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setShowFollowers(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-purple-800">Followers</h3>
              <button onClick={() => setShowFollowers(false)} className="text-purple-700">
                ✕
              </button>
            </div>
            {loadingList ? (
              <div className="text-purple-600">Loading...</div>
            ) : followers.length === 0 ? (
              <div className="text-gray-600">No followers yet.</div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-auto">
                {followers.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-purple-50 cursor-pointer"
                    onClick={() => {
                      setShowFollowers(false);
                      window.location.href = `/profile/${u.id}`;
                    }}
                  >
                    <img
                      src={u.profile_pic || '/avatar-placeholder.svg'}
                      alt={u.username}
                      className="h-10 w-10 rounded-full object-cover border border-purple-200"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '/avatar-placeholder.svg';
                      }}
                    />
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">{u.username}</div>
                      {u.bio && <div className="text-xs text-gray-600 truncate">{u.bio}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Following Modal */}
      {showFollowing && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setShowFollowing(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-purple-800">Following</h3>
              <button onClick={() => setShowFollowing(false)} className="text-purple-700">
                ✕
              </button>
            </div>
            {loadingList ? (
              <div className="text-purple-600">Loading...</div>
            ) : following.length === 0 ? (
              <div className="text-gray-600">Not following anyone yet.</div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-auto">
                {following.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-purple-50 cursor-pointer"
                    onClick={() => {
                      setShowFollowing(false);
                      window.location.href = `/profile/${u.id}`;
                    }}
                  >
                    <img
                      src={u.profile_pic || 'https://via.placeholder.com/80'}
                      alt={u.username}
                      className="h-10 w-10 rounded-full object-cover border border-purple-200"
                    />
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">{u.username}</div>
                      {u.bio && <div className="text-xs text-gray-600 truncate">{u.bio}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// (No helper needed when backend supports query params on /posts/)
