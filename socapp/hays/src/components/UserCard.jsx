import { Link, useNavigate } from 'react-router-dom';
import api from '@/api/axios';
import { FaUserPlus, FaUserCheck, FaComment, FaEllipsisH } from 'react-icons/fa';
import Avatar from './Avatar';

export default function UserCard({ user, onFollow }) {
  const navigate = useNavigate();

  const handleMessage = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await api.post('/messages/start', { user_id: user.id });
      const cid = res?.data?.id || res?.data?.conversation_id || null;
      if (cid) {
        navigate(`/chat/${cid}`);
      } else {
        navigate(`/chat/${user.id}`);
      }
    } catch {
      navigate(`/chat/${user.id}`);
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-lg rounded-2xl border border-white/50 shadow-sm hover:shadow-md transition-all duration-300 p-6 group">
      <div className="flex items-center justify-between">
        <Link to={`/user/${user.id}`} className="flex items-center gap-4 flex-1 min-w-0">
          <Avatar
            src={user.avatar || user.profile_pic}
            username={user.username}
            name={user.name}
            size={56}
            showOnline={true}
          />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900 truncate group-hover:text-purple-600 transition-colors">
              {user.name || user.username}
            </div>
            <div className="text-sm text-gray-500 truncate">@{user.username}</div>
            {user.bio && <div className="text-sm text-gray-600 mt-1 line-clamp-2">{user.bio}</div>}
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span>{user.followers_count || 0} followers</span>
              <span>{user.following_count || 0} following</span>
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onFollow?.(user);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            title="Follow this user"
          >
            <FaUserPlus size={14} />
            <span className="font-medium">Follow</span>
          </button>

          <button
            type="button"
            onClick={handleMessage}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
            title="Message this user"
          >
            <FaComment />
          </button>

          <button className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <FaEllipsisH size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
