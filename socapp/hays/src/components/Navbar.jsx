// Imports
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  FaUser,
  FaSearch,
  FaHome,
  FaUserFriends,
  FaBell,
  FaEnvelope,
  FaCog,
  FaSignOutAlt,
} from 'react-icons/fa';
import { useState } from 'react';

// UI Render
export default function Navbar() {
  const { token, user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <nav className="bg-white/95 backdrop-blur-lg border-b border-gray-100 shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link to={token ? '/' : '/login'} className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-sm">C</span>
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent tracking-tight">
              CSSocial
            </span>
          </Link>

          {token ? (
            <div className="flex items-center gap-1">
              {/* Main Navigation */}
              <div className="flex items-center gap-1 bg-gray-50/80 rounded-2xl p-1 shadow-inner">
                <NavLink
                  to="/"
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-white shadow-sm text-purple-600 border border-purple-100'
                        : 'text-gray-600 hover:text-purple-500 hover:bg-white/50'
                    }`
                  }
                >
                  <FaHome className="text-lg" />
                  <span className="font-medium hidden sm:inline">Feed</span>
                </NavLink>

                <NavLink
                  to="/search"
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-white shadow-sm text-purple-600 border border-purple-100'
                        : 'text-gray-600 hover:text-purple-500 hover:bg-white/50'
                    }`
                  }
                >
                  <FaSearch className="text-lg" />
                  <span className="font-medium hidden sm:inline">Search</span>
                </NavLink>

                <NavLink
                  to="/people"
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-white shadow-sm text-purple-600 border border-purple-100'
                        : 'text-gray-600 hover:text-purple-500 hover:bg-white/50'
                    }`
                  }
                >
                  <FaUserFriends className="text-lg" />
                  <span className="font-medium hidden sm:inline">People</span>
                </NavLink>
              </div>

              {/* Action Icons */}
              <div className="flex items-center gap-2 ml-4">
                <button className="w-10 h-10 rounded-xl bg-gray-50 hover:bg-purple-50 text-gray-600 hover:text-purple-600 transition-all duration-200 flex items-center justify-center relative">
                  <FaBell className="text-lg" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    3
                  </span>
                </button>

                <button className="w-10 h-10 rounded-xl bg-gray-50 hover:bg-purple-50 text-gray-600 hover:text-purple-600 transition-all duration-200 flex items-center justify-center relative">
                  <FaEnvelope className="text-lg" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
                    5
                  </span>
                </button>

                {/* User Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 pl-2 pr-3 py-2 rounded-xl bg-gray-50 hover:bg-purple-50 transition-all duration-200 group"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center text-white font-semibold text-sm shadow-md">
                      {user?.name?.charAt(0) || 'U'}
                    </div>
                    <span className="font-medium text-gray-700 group-hover:text-purple-600 hidden md:inline">
                      {user?.name || 'User'}
                    </span>
                  </button>

                  {/* Dropdown Menu */}
                  {showUserMenu && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="font-semibold text-gray-900">{user?.name || 'User'}</p>
                        <p className="text-sm text-gray-500 truncate">
                          {user?.email || 'user@example.com'}
                        </p>
                      </div>

                      <NavLink
                        to="/me"
                        className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                        onClick={() => setShowUserMenu(false)}
                      >
                        <FaUser className="text-gray-400" />
                        <span>My Profile</span>
                      </NavLink>

                      <button className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors w-full text-left">
                        <FaCog className="text-gray-400" />
                        <span>Settings</span>
                      </button>

                      <div className="border-t border-gray-100 mt-2 pt-2">
                        <button
                          onClick={() => {
                            logout();
                            setShowUserMenu(false);
                          }}
                          className="flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 transition-colors w-full text-left"
                        >
                          <FaSignOutAlt />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Guest Navigation */
            <div className="flex items-center gap-3">
              <NavLink
                to="/login"
                className="px-6 py-2.5 rounded-xl text-gray-700 font-medium hover:text-purple-600 transition-colors duration-200"
              >
                Log in
              </NavLink>
              <NavLink
                to="/register"
                className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
              >
                Get Started
              </NavLink>
            </div>
          )}
        </div>
      </div>

      {/* Overlay for dropdown */}
      {showUserMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
      )}
    </nav>
  );
}
