import { useEffect, useRef, useState } from 'react';
import api from '@/api/axios';
import { useAuth } from '@/context/AuthContext';
import CreatePost from '@/components/CreatePost';
import PostCard from '@/components/PostCard';
import { getPinnedForUser } from '@/utils/pins';
import Sidebar from '@/components/Sidebar';
import Avatar from '@/components/Avatar';
import { FaEdit, FaUsers, FaImage, FaCamera, FaCheck, FaTimes } from 'react-icons/fa';

export default function ProfilePage() {
  const { user: me } = useAuth();
  const [profile, setProfile] = useState(null);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [pinnedPosts, setPinnedPosts] = useState([]);
  const [loadingPins, setLoadingPins] = useState(true);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const editFormRef = useRef(null);
  const [showEdit, setShowEdit] = useState(false);

  const fetchMe = async () => {
    const res = await api.get('/users/me');
    setProfile(res.data);
    setUsername(res.data.username || '');
    setBio(res.data.bio || '');
    const raw = res.data.profile_pic || res.data.avatar_url || null;
    if (raw) setAvatarPreview(raw);
    return res.data;
  };

  const fetchMyPosts = async (id) => {
    setLoadingPosts(true);
    try {
      const res = await api.get('/posts', { params: { user_id: id } });
      setPosts(res.data || []);
    } finally {
      setLoadingPosts(false);
    }
  };

  const fetchPinnedPosts = async (id) => {
    setLoadingPins(true);
    try {
      const pinnedIds = getPinnedForUser(id);
      const results = await Promise.all(
        pinnedIds.map((pid) =>
          api
            .get(`/posts/${pid}`)
            .then((r) => r.data)
            .catch(() => null),
        ),
      );
      setPinnedPosts(results.filter(Boolean));
    } finally {
      setLoadingPins(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const meData = await fetchMe();
        await fetchMyPosts(meData.id);
        await fetchPinnedPosts(meData.id);
      } catch (e) {
        console.error('Failed to load profile', e);
      }
    })();
  }, []);

  const onAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const saveProfile = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (!profile) return;
    setSaving(true);
    try {
      const form = new FormData();
      form.append('username', username);
      form.append('bio', bio);
      if (avatarFile) form.append('avatar', avatarFile);

      await api.put('/users/me', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const updated = await fetchMe();
      await fetchMyPosts(updated.id);
      await fetchPinnedPosts(updated.id);
      setShowEdit(false);
    } catch (e) {
      console.error('Failed to save profile', e);
      alert(e?.response?.data?.detail || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const loadFollowers = async () => {
    if (!profile) return;
    setLoadingList(true);
    try {
      const res = await api.get(`/users/${profile.id}/followers`);
      setFollowers(res.data || []);
      setShowFollowers(true);
    } finally {
      setLoadingList(false);
    }
  };

  const loadFollowing = async () => {
    if (!profile) return;
    setLoadingList(true);
    try {
      const res = await api.get(`/users/${profile.id}/following`);
      setFollowing(res.data || []);
      setShowFollowing(true);
    } finally {
      setLoadingList(false);
    }
  };

  const handlePostCreated = (newPost) => {
    setPosts((prev) => [newPost, ...prev]);
  };

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-500 via-blue-500 to-indigo-600">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg font-medium">Loading your profile...</p>
        </div>
      </div>
    );
  }

  const followersCount = Array.isArray(profile.followers_ids)
    ? profile.followers_ids.length
    : profile.followers_count || 0;
  const followingCount = Array.isArray(profile.following_ids)
    ? profile.following_ids.length
    : profile.following_count || 0;
  const postsCount = posts.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-purple-200 to-indigo-100 px-4 py-6">
      <div className="container mx-auto">
        <div className="flex gap-6">
          <Sidebar />
          <div className="flex-1 max-w-4xl mx-auto space-y-6">
            {/* Profile Header */}
            <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-sm border border-white/50 p-8">
              <div className="flex items-start gap-6">
                <div className="relative group">
                  <Avatar
                    src={avatarPreview}
                    username={profile.username}
                    name={profile.name}
                    size={120}
                    showOnline={true}
                    isOnline={true}
                  />
                  <label className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <FaCamera className="text-white text-2xl" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={onAvatarChange}
                    />
                  </label>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900">{profile.username}</h1>
                      <p className="text-gray-600 mt-1">{bio || 'No bio yet'}</p>
                    </div>
                    <button
                      onClick={() => setShowEdit(!showEdit)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <FaEdit size={14} />
                      Edit Profile
                    </button>
                  </div>

                  <div className="flex items-center gap-6 text-sm">
                    <button
                      onClick={loadFollowers}
                      className="flex items-center gap-2 hover:text-purple-600 transition-colors"
                    >
                      <span className="font-semibold text-gray-900">{followersCount}</span>
                      <span className="text-gray-600">Followers</span>
                    </button>
                    <button
                      onClick={loadFollowing}
                      className="flex items-center gap-2 hover:text-purple-600 transition-colors"
                    >
                      <span className="font-semibold text-gray-900">{followingCount}</span>
                      <span className="text-gray-600">Following</span>
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{postsCount}</span>
                      <span className="text-gray-600">Posts</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Edit Profile Form */}
            {showEdit && (
              <div
                ref={editFormRef}
                className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-sm border border-white/50 p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-gray-900">Edit Profile</h3>
                  <button
                    onClick={() => setShowEdit(false)}
                    className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <FaTimes size={20} />
                  </button>
                </div>

                <div className="grid gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                    <input
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent bg-white/50"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Username"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                    <textarea
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent resize-none bg-white/50"
                      rows={4}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell something about you..."
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setShowEdit(false)}
                    className="px-6 py-3 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveProfile}
                    disabled={saving}
                    className={`px-6 py-3 rounded-xl text-white font-medium transition-colors flex items-center gap-2 ${
                      saving ? 'bg-purple-400' : 'bg-purple-600 hover:bg-purple-700'
                    }`}
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <FaCheck />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Create Post */}
            <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-sm border border-white/50 p-6">
              <CreatePost onPostCreated={handlePostCreated} />
            </div>

            {/* Pinned Posts */}
            {pinnedPosts.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
                    <FaImage className="text-white text-sm" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">Pinned Posts</h2>
                </div>
                <div className="space-y-4">
                  {pinnedPosts.map((p) => (
                    <PostCard
                      key={p.id}
                      post={p}
                      pinned
                      onChanged={() => fetchPinnedPosts(profile.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* My Posts */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
                    <FaEdit className="text-white text-sm" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">My Posts</h2>
                </div>
                <button
                  onClick={() => fetchMyPosts(profile.id)}
                  className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Refresh
                </button>
              </div>

              {loadingPosts ? (
                <div className="grid gap-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-white/80 rounded-2xl p-6 animate-pulse">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                        <div className="space-y-2 flex-1">
                          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/6"></div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-full"></div>
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : posts.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-24 h-24 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <FaEdit className="text-gray-400 text-3xl" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Posts Yet</h3>
                  <p className="text-gray-600">Start sharing your thoughts with the community!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {posts.map((p) => (
                    <PostCard key={p.id} post={p} onChanged={() => fetchMyPosts(profile.id)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Followers Modal */}
      {showFollowers && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
          onClick={() => setShowFollowers(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Followers</h3>
              <button
                onClick={() => setShowFollowers(false)}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <FaTimes size={20} />
              </button>
            </div>

            {loadingList ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent"></div>
              </div>
            ) : followers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FaUsers className="text-4xl text-gray-300 mx-auto mb-3" />
                <p>No followers yet.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-auto">
                {followers.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => {
                      setShowFollowers(false);
                      window.location.href = `/profile/${u.id}`;
                    }}
                  >
                    <Avatar
                      src={u.profile_pic}
                      username={u.username}
                      name={u.name}
                      size={48}
                      showOnline={true}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{u.username}</div>
                      {u.bio && <div className="text-sm text-gray-600 truncate">{u.bio}</div>}
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
          onClick={() => setShowFollowing(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Following</h3>
              <button
                onClick={() => setShowFollowing(false)}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <FaTimes size={20} />
              </button>
            </div>

            {loadingList ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent"></div>
              </div>
            ) : following.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FaUsers className="text-4xl text-gray-300 mx-auto mb-3" />
                <p>Not following anyone yet.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-auto">
                {following.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => {
                      setShowFollowing(false);
                      window.location.href = `/profile/${u.id}`;
                    }}
                  >
                    <Avatar
                      src={u.profile_pic}
                      username={u.username}
                      name={u.name}
                      size={48}
                      showOnline={true}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{u.username}</div>
                      {u.bio && <div className="text-sm text-gray-600 truncate">{u.bio}</div>}
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
