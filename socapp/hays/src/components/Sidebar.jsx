import { Link, NavLink } from 'react-router-dom';
import { FaHome, FaEnvelope, FaUserFriends, FaCog, FaBell, FaBookmark } from 'react-icons/fa';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Avatar from '@/components/Avatar';
import api from '@/api/axios';
import { getSocket } from '@/services/socket';

export default function Sidebar() {
  const { user } = useAuth();
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [notificationsCount, setNotificationsCount] = useState(0);

  const refreshUnread = async () => {
    try {
      const res = await api.get('/messages/conversations', { params: { limit: 20, offset: 0 } });
      const list = res.data || [];
      const total = list.reduce((sum, c) => sum + (c.unread_count || 0), 0);
      setUnreadTotal(total);
    } catch (_) {
      // noop
    }
  };

  useEffect(() => {
    refreshUnread();
    const s = getSocket();
    const onIncoming = () => refreshUnread();
    s.on('message:new', onIncoming);
    return () => {
      s.off('message:new', onIncoming);
    };
  }, []);

  const navItems = [
    { to: '/', icon: FaHome, label: 'Feed', badge: null },
    { to: '/friends', icon: FaUserFriends, label: 'People', badge: null },
    { to: '/chat', icon: FaEnvelope, label: 'Messages', badge: unreadTotal },
    { to: '/notifications', icon: FaBell, label: 'Notifications', badge: notificationsCount },
    { to: '/saved', icon: FaBookmark, label: 'Saved', badge: null },
    { to: '/settings', icon: FaCog, label: 'Settings', badge: null },
  ];

  return (
    <aside className="hidden md:block w-80 shrink-0">
      <div className="sticky top-6 space-y-4">
        {/* User Profile Card */}
        <Link
          to={user?.id ? `/profile/${user.id}` : '/me'}
          className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-sm border border-white/50 p-6 flex items-center gap-4 hover:shadow-md transition-all duration-300 group"
        >
          <Avatar
            src={user?.profile_pic || user?.avatar_url}
            username={user?.username}
            name={user?.name}
            size={56}
            showOnline={true}
            isOnline={true}
          />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors truncate">
              {user?.name || user?.username || 'User'}
            </div>
            <div className="text-sm text-gray-500 truncate">@{user?.username || 'username'}</div>
            <div className="text-xs text-gray-400 mt-1">View your profile</div>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-sm border border-white/50 p-4">
          <div className="space-y-1">
            {navItems.map(({ to, icon: Icon, label, badge }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group relative ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg'
                      : 'text-gray-700 hover:bg-purple-50 hover:text-purple-600'
                  }`
                }
              >
                <Icon
                  className={`text-lg ${unreadTotal > 0 && to === '/chat' ? 'animate-pulse' : ''}`}
                />
                <span className="font-medium flex-1">{label}</span>

                {badge > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full min-w-6 text-center">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}

                {/* Hover effect */}
                <div className="absolute inset-0 rounded-xl border-2 border-transparent group-hover:border-purple-200 transition-colors pointer-events-none"></div>
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Quick Stats */}
        <div className="bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl shadow-lg p-6 text-white">
          <h3 className="font-semibold text-lg mb-3">Your Stats</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span>Posts</span>
              <span className="font-semibold">24</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Following</span>
              <span className="font-semibold">156</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Followers</span>
              <span className="font-semibold">89</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
