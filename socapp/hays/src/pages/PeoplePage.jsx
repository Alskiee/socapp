import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUserPlus, FaUserCheck, FaUserTimes, FaSearch } from 'react-icons/fa';
import api from '@/api/axios';
import { useAuth } from '@/context/AuthContext';
import Sidebar from '@/components/Sidebar';

export default function PeoplePage() {
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState(new Set());

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const meId = me?.id;
      const res = await api.get('/users', { params: meId ? { me: meId } : {} });
      const raw = Array.isArray(res.data) ? res.data : [];
      // Exclude self and dedupe by id to ensure only user profiles, no duplicates
      const deduped = [];
      const seen = new Set();
      for (const u of raw) {
        if (!u || !u.id) continue;
        if (meId && u.id === meId) continue;
        if (seen.has(u.id)) continue;
        seen.add(u.id);
        deduped.push(u);
      }
      setUsers(deduped);
    } catch (e) {
      console.error('Failed to fetch users', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [me?.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    // Search by username or name if provided
    return users.filter((u) => {
      const uname = (u.username || '').toLowerCase();
      const name = (u.name || '').toLowerCase();
      return uname.includes(q) || name.includes(q);
    });
  }, [users, query]);

  const toggleFollow = async (u, willFollow) => {
    setBusyIds((prev) => new Set(prev).add(u.id));
    const prev = [...users];
    setUsers((curr) =>
      curr.map((x) =>
        x.id === u.id
          ? {
              ...x,
              is_following: willFollow,
              followers_count: Math.max(0, (x.followers_count || 0) + (willFollow ? 1 : -1)),
            }
          : x,
      ),
    );
    try {
      if (willFollow) {
        await api.post(`/users/${u.id}/follow`);
      } else {
        await api.post(`/users/${u.id}/unfollow`);
      }
    } catch (e) {
      console.error('Follow/unfollow failed', e);
      setUsers(prev); // revert on error
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(u.id);
        return next;
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-purple-200 to-purple-300 px-4 py-6">
      <div className="container mx-auto">
        <div className="flex gap-6">
          <Sidebar />
          <div className="flex-1 max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold text-purple-800 mb-4">Explore People</h1>

            <div className="flex items-center gap-2 bg-white/80 border border-purple-200 rounded-full px-4 py-2 shadow-sm mb-4">
              <FaSearch className="text-purple-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by username"
                className="flex-1 bg-transparent outline-none text-gray-800 placeholder:text-purple-400"
                aria-label="Search users"
              />
            </div>

            {loading ? (
              <div className="text-purple-600">Loading users...</div>
            ) : filtered.length === 0 ? (
              <div className="text-gray-600">No users match your search.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((u) => {
                  const avatar = u.profile_pic || null; // backend sends full URL
                  const placeholder = '/avatar-placeholder.svg';
                  const isFollowing = !!u.is_following;
                  const busy = busyIds.has(u.id);
                  const followsMe = false; // optional: could be added if backend returns this flag per user

                  return (
                    <div
                      key={u.id}
                      className="group bg-white/80 rounded-2xl border border-purple-100 p-4 shadow-sm hover:shadow-md transition"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={avatar || placeholder}
                          alt={`${u.username}'s avatar`}
                          className="h-12 w-12 rounded-full object-cover border-2 border-purple-200 shadow-sm cursor-pointer"
                          onClick={() => navigate(`/profile/${u.id}`)}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = placeholder;
                          }}
                        />
                        <div className="min-w-0">
                          <div
                            className="font-semibold text-gray-900 truncate cursor-pointer hover:text-purple-700"
                            onClick={() => navigate(`/profile/${u.id}`)}
                            title={u.username}
                          >
                            {u.username}
                          </div>
                          {u.bio && <div className="text-xs text-gray-600 truncate">{u.bio}</div>}
                          <div className="text-xs text-gray-500">
                            <span className="mr-3">{u.followers_count ?? 0} followers</span>
                            <span>{u.following_count ?? 0} following</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex justify-end">
                        {isFollowing ? (
                          <button
                            aria-label={`Unfollow ${u.username}`}
                            disabled={busy}
                            onClick={() => toggleFollow(u, false)}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition transform ${
                              busy
                                ? 'bg-purple-400 text-white cursor-not-allowed'
                                : 'bg-purple-600 text-white hover:bg-purple-700 hover:scale-[1.02]'
                            }`}
                            title="Unfollow"
                          >
                            {busy ? (
                              <span className="animate-pulse">...</span>
                            ) : (
                              <>
                                <FaUserCheck />
                                <span className="group-hover:hidden">Following ✓</span>
                                <span className="hidden group-hover:inline">Unfollow</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            aria-label={`Follow ${u.username}`}
                            disabled={busy}
                            onClick={() => toggleFollow(u, true)}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition transform ${
                              busy
                                ? 'bg-purple-300 text-purple-900 cursor-not-allowed'
                                : 'bg-white text-purple-700 border border-purple-300 hover:bg-purple-50 hover:scale-[1.02]'
                            }`}
                            title={followsMe ? 'Follow Back' : 'Follow'}
                          >
                            {busy ? <span className="animate-pulse">...</span> : <FaUserPlus />}
                            <span>{followsMe ? 'Follow Back' : 'Follow'}</span>
                          </button>
                        )}
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
