import { Link } from 'react-router-dom';
import { API_BASE_URL } from '@/api/axios';

export default function Avatar({
  src,
  alt = 'avatar',
  username,
  name,
  size = 48,
  to,
  className = '',
  showBorder = true,
  showOnline = false,
  isOnline = false,
}) {
  const placeholder = '/avatar-placeholder.svg';
  const fallbackInitial = (name?.[0] || username?.[0] || 'U').toUpperCase();
  const dim = typeof size === 'number' ? `${size}px` : size;
  const borderCls = showBorder ? 'border-2 border-white/20 shadow-sm' : '';
  const sizeClass = size <= 32 ? 'text-xs' : size <= 48 ? 'text-sm' : 'text-base';

  const resolvedSrc = (() => {
    if (!src) return null;
    const s = String(src);
    const isAbsolute = /^https?:\/\//i.test(s) || s.startsWith('data:');
    if (isAbsolute) return s;
    if (s.startsWith('/')) return `${API_BASE_URL}${s}`;
    return `${API_BASE_URL}/${s}`;
  })();

  const avatarContent = (
    <div className="relative">
      {resolvedSrc ? (
        <img
          src={resolvedSrc}
          alt={alt}
          style={{ width: dim, height: dim }}
          className={`rounded-full object-cover ${borderCls} ${className} transition-all duration-200 hover:scale-105`}
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = placeholder;
          }}
        />
      ) : (
        <div
          style={{ width: dim, height: dim }}
          className={`rounded-full ${borderCls} ${className} bg-gradient-to-br from-purple-500 to-blue-500 text-white flex items-center justify-center font-semibold ${sizeClass} shadow-lg transition-all duration-200 hover:scale-105`}
        >
          {fallbackInitial}
        </div>
      )}
      {showOnline && (
        <div
          className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}
        />
      )}
    </div>
  );

  if (to)
    return (
      <Link to={to} className="inline-block">
        {avatarContent}
      </Link>
    );
  return avatarContent;
}
