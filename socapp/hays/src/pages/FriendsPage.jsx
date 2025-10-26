import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUserPlus, FaUserCheck, FaUserTimes, FaSearch, FaUsers } from 'react-icons/fa';
import { useAuth } from '@/context/AuthContext';
import api from '@/api/axios';
import Sidebar from '@/components/Sidebar';
import Avatar from '@/components/Avatar';

export default function FriendsPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followingSet, setFollowingSet] = useState(new Set());
  const [followersSet, setFollowersSet] = useState(new Set());
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { user: me } = useAuth();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, meRes] = await Promise.all([api.get('/users'), api.get('/users/me')]);

      const all = Array.isArray(usersRes.data) ? usersRes.data : [];
      const mine = meRes.data;

      const following = new Set(mine.following_ids || []);
      const followers = new Set(mine.followers_ids || []);
      setFollowingSet(following);
      setFollowersSet(followers);

      setUsers(all.filter((u) => String(u.id) !== String(mine.id)));
    } catch (e) {
      console.error('Failed to load users', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleFollow = async (id, isFollowing) => {
    try {
      if (isFollowing) {
        await api.post(`/users/${id}/unfollow`);
        setFollowingSet((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } else {
        await api.post(`/users/${id}/follow`);
        setFollowingSet((prev) => new Set(prev).add(id));
      }
    } catch (e) {
      console.error('Follow/unfollow failed', e);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => (u.username || '').toLowerCase().includes(q));
  }, [users, query]);

  const getStatus = (u) => {
    const id = u.id;
    const iFollow = followingSet.has(id);
    const followsMe = followersSet.has(id);
    if (iFollow && followsMe) return 'friends';
    if (iFollow && !followsMe) return 'pending';
    return 'none';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 px-4 py-6">
      <div className="container mx-auto">
        <div className="flex gap-6">
          <Sidebar />
          <div className="flex-1 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <FaUsers className="text-white text-xl" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Discover Friends</h1>
                  <p className="text-gray-600">Connect with people around the world</p>
                </div>
              </div>
            </div>

            {/* Search Bar */}
            <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-sm border border-white/50 p-4 mb-6">
              <div className="relative">
                <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by username..."
                  className="w-full pl-12 pr-4 py-3 bg-white/50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white/80 rounded-2xl p-6 animate-pulse">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-16 h-16 bg-gray-200 rounded-full"></div>
                      <div className="space-y-2 flex-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>
                    <div className="h-10 bg-gray-200 rounded-xl"></div>
                  </div>
                ))}
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-24 h-24 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FaUsers className="text-gray-400 text-3xl" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Users Found</h3>
                <p className="text-gray-600">There are no other users registered yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((u) => {
                  const status = getStatus(u);
                  const isFollowing = status === 'friends' || status === 'pending';

                  return (
                    <div
                      key={u.id}
                      className="bg-white/80 backdrop-blur-lg rounded-2xl border border-white/50 shadow-sm hover:shadow-md transition-all duration-300 p-6 group"
                    >
                      <div className="flex flex-col items-center text-center mb-4">
                        <Avatar
                          src={u.profile_pic || u.avatar_url}
                          username={u.username}
                          name={u.name}
                          size={80}
                          to={`/profile/${u.id}`}
                          showOnline={true}
                          className="mb-4 group-hover:scale-105 transition-transform duration-300"
                        />
                        <div>
                          <div className="font-semibold text-gray-900 truncate">
                            {u.name || u.username}
                          </div>
                          <div className="text-sm text-gray-500 truncate">@{u.username}</div>
                          {u.bio && (
                            <div className="text-xs text-gray-600 mt-2 line-clamp-2">{u.bio}</div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>{u.followers_count || 0} followers</span>
                          <span>{u.following_count || 0} following</span>
                        </div>

                        <button
                          onClick={() => toggleFollow(u.id, isFollowing)}
                          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all duration-200 ${
                            status === 'friends'
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : status === 'pending'
                                ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                : 'bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:shadow-lg transform hover:-translate-y-0.5'
                          }`}
                        >
                          {status === 'friends' ? (
                            <>
                              <FaUserCheck />
                              Friends
                            </>
                          ) : status === 'pending' ? (
                            <>
                              <FaUserTimes />
                              Pending
                            </>
                          ) : (
                            <>
                              <FaUserPlus />
                              Add Friend
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
