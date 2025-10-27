// Register.jsx
import React, { useState } from 'react';
import axios from 'axios';
import { FaEye, FaEyeSlash, FaUser, FaEnvelope, FaLock, FaCheck } from 'react-icons/fa';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const checkPasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    return strength;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });

    if (name === 'password') {
      setPasswordStrength(checkPasswordStrength(value));
    }

    if (error) setError('');
    if (success) setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/auth/register`, formData);
      console.log('Registration success:', response.data);
      setSuccess('Account created successfully! You can now log in.');
      setFormData({ username: '', email: '', password: '' });
      setPasswordStrength(0);
    } catch (error) {
      console.error('Registration error:', error);
      const message =
        error.response?.data?.detail ||
        error.response?.data?.msg ||
        'Registration failed. Please check your inputs.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-yellow-500',
    'bg-blue-500',
    'bg-green-500',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-purple-200 to-purple-300 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-white/80 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg border border-purple-200">
              <span className="text-purple-600 font-bold text-2xl">C</span>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-purple-700 mb-2">Join CSS Social</h1>
          <p className="text-purple-600/80">Create your account and start connecting</p>
        </div>

        {/* Register Card */}
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
                  placeholder="Choose a username"
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-white/50 border border-purple-200 rounded-xl text-purple-800 placeholder-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 transition-all duration-200"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-purple-700 text-sm font-medium">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaEnvelope className="text-purple-500 text-lg" />
                </div>
                <input
                  type="email"
                  name="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-white/50 border border-purple-200 rounded-xl text-purple-800 placeholder-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 transition-all duration-200"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-3">
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
                  placeholder="Create a strong password"
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

              {/* Password Strength Indicator */}
              {formData.password && (
                <div className="space-y-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((index) => (
                      <div
                        key={index}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          index <= passwordStrength
                            ? strengthColors[passwordStrength]
                            : 'bg-purple-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-purple-600 text-xs">
                    Strength:{' '}
                    <span
                      className={
                        passwordStrength >= 3
                          ? 'text-green-600'
                          : passwordStrength >= 2
                            ? 'text-yellow-600'
                            : 'text-red-600'
                      }
                    >
                      {strengthLabels[passwordStrength]}
                    </span>
                  </p>
                </div>
              )}

              {/* Password Requirements */}
              <div className="space-y-1 text-xs text-purple-600">
                <div className="flex items-center gap-2">
                  <FaCheck
                    className={`text-xs ${formData.password.length >= 8 ? 'text-green-600' : 'text-purple-300'}`}
                  />
                  <span>At least 8 characters</span>
                </div>
                <div className="flex items-center gap-2">
                  <FaCheck
                    className={`text-xs ${/[A-Z]/.test(formData.password) ? 'text-green-600' : 'text-purple-300'}`}
                  />
                  <span>One uppercase letter</span>
                </div>
                <div className="flex items-center gap-2">
                  <FaCheck
                    className={`text-xs ${/[0-9]/.test(formData.password) ? 'text-green-600' : 'text-purple-300'}`}
                  />
                  <span>One number</span>
                </div>
              </div>
            </div>

            {/* Messages */}
            {error && (
              <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center">
                <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-100 border border-green-300 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                {success}
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
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Footer Links */}
          <div className="mt-6 text-center">
            <div className="text-purple-600 text-sm">
              Already have an account?{' '}
              <a
                href="/login"
                className="text-purple-700 font-semibold hover:underline transition-colors"
              >
                Sign in
              </a>
            </div>
          </div>
        </div>

        {/* Terms */}
        <div className="text-center mt-6">
          <p className="text-purple-500 text-xs">
            By signing up, you agree to our Terms and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
