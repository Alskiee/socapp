// Login.jsx
import React, { useState } from 'react';
import api from '@/api/axios';
import { FaEye, FaEyeSlash, FaUser, FaLock } from 'react-icons/fa';

const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await api.post('/auth/login-with-username', formData);
      const token = res.data.access_token;
      localStorage.setItem('token', token);

      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    } catch (err) {
      console.error('❌ Login error:', err);
      const msg = err.response?.data?.detail || 'Invalid username or password.';
      setError(msg);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-purple-200 to-purple-300 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-white/80 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg border border-purple-200">
              <span className="text-purple-600 font-bold text-2xl">M</span>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-purple-700 mb-2">Welcome Back</h1>
          <p className="text-purple-600/80">Sign in to your CSS Social account</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-lg border border-purple-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username Field */}
            <div className="space-y-2">
              <label className="text-purple-700 text-sm font-medium">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaUser className="text-purple-500 text-lg" />
                </div>
                <input
                  type="text"
                  name="username"
                  placeholder="Enter your username"
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-white/50 border border-purple-200 rounded-xl text-purple-800 placeholder-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 transition-all duration-200"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-purple-700 text-sm font-medium">Password</label>
                <button
                  type="button"
                  className="text-purple-600 hover:text-purple-800 text-sm transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaLock className="text-purple-500 text-lg" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-10 pr-12 py-3 bg-white/50 border border-purple-200 rounded-xl text-purple-800 placeholder-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 transition-all duration-200"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <FaEyeSlash className="text-purple-500 hover:text-purple-700 transition-colors" />
                  ) : (
                    <FaEye className="text-purple-500 hover:text-purple-700 transition-colors" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center">
                <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-purple-600 text-white py-3.5 rounded-xl font-semibold shadow-lg hover:bg-purple-700 transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:transform-none disabled:hover:bg-purple-600 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Footer Links */}
          <div className="mt-6 text-center space-y-3">
            <a
              href="/forgot-password"
              className="text-purple-600 hover:text-purple-800 text-sm transition-colors block"
            >
              Forgot your password?
            </a>
            <div className="text-purple-600 text-sm">
              Don't have an account?{' '}
              <a
                href="/register"
                className="text-purple-700 font-semibold hover:underline transition-colors"
              >
                Sign up
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
