# CCS Social Frontend

A minimal React (Vite) + TailwindCSS frontend for the College of Computer Studies Social Media Platform.

## Tech
- React + Vite
- React Router v6
- Axios
- TailwindCSS

## Setup
1. Install dependencies
```bash
npm install
```
2. Configure API base URL (optional)
- Edit `.env` and set `VITE_API_URL` (defaults to `http://localhost:8000`)

3. Run the dev server
```bash
npm run dev
```

## Features
- Auth: Login, Register (JWT stored in `localStorage`)
- Feed: View, Create Post (`PostForm`), Like/Unlike, Comment
- Profile: View User, Follow/Unfollow, My Profile edit
- Search Users
- Post Details: View, Edit/Delete if author, Comments

## API Layer
- `src/api/axios.js`: Axios instance with base URL + JWT header
- `src/api/auth.js`: `login`, `register`, `getCurrentUser`
- `src/api/posts.js`: `getFeed`, `createPost`, `likePost`, `getPost`, `updatePost`, `deletePost`
- `src/api/users.js`: `getUser`, `getMe`, `updateMe`, `followUser`, `unfollowUser`, `searchUsers`
- `src/api/comments.js`: `getComments`, `addComment`, `deleteComment`

## Notes
- Backend must expose OpenAPI at `/openapi.json` and endpoints described in the task.
- Adjust field names if your backend uses different keys.
