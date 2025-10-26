# CCS Social Frontend Style Guide

## Theme
- Primary Gradient: from #7B68EE to #6A0DAD (Tailwind: `from-[#7B68EE] to-[#6A0DAD]`)
- Background: App root uses a diagonal gradient (see `src/index.css`).
- Text: White by default, darker text (gray-900/700/600) inside white cards.
- Cards: White backgrounds, `rounded-2xl`, subtle border `border-gray-100`, soft shadow `shadow-md`.
- Buttons: Purple gradient `bg-gradient-to-r from-purple-500 to-purple-600`, white text, `rounded-xl`.
- Hover: Prefer subtle opacity changes or purple tint (`hover:bg-white/10`, `hover:text-purple-600`).
- Avatars: Circle with purple gradient background showing the user initial.

## Typography
- Base font: System default via Tailwind.
- Headings: Use Tailwind sizes (`text-xl`, `text-lg`) with `font-semibold`.
- Body: `text-gray-800` on card content; `text-gray-600/500/400` for meta.

## Layout
- Page layout uses a `Sidebar` on the left for md+ breakpoints.
- Content area is constrained to `max-w-2xl` for readability.
- Containers: Use `container mx-auto` and 16px padding (`p-4`) consistently.

## Components
- Naming: PascalCase for components and files, e.g., `PostCard.jsx`, `PostForm.jsx`.
- Folders: `components/` for shared UI; `pages/` for route-level views; `api/` for API clients.
- Icons: `react-icons` (FontAwesome subset) for Like, Comment, Pin, Friends, etc.
- Time: Use `react-timeago` for relative timestamps.

## Conventions
- Imports: Use `@` alias for anything under `src/` (configured in `vite.config.js`).
  - Example: `import PostCard from '@/components/PostCard'`.
- Do not include file extensions in imports.
- State hooks at the top of components, followed by handlers, then JSX.
- Add section comments in each component:
  ```js
  // Imports
  // States
  // Handlers
  // UI Render
  ```

## Tailwind Classes
- Cards: `bg-white rounded-2xl shadow-md border border-gray-100`
- Buttons (primary): `bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl`
- Inputs: `border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300`
- Avatar: `h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 text-white flex items-center justify-center font-semibold`

## Accessibility
- Use `hover:` plus `focus:` styles for interactive elements.
- Ensure color contrast (purple on white, white on purple).

## Formatting
- Prettier settings in `.prettierrc`:
  - 2-space indentation
  - single quotes
  - semicolons
  - trailing commas
- Use scripts:
  - `npm run format` to write changes
  - `npm run format:check` in CI/pre-commit

## Examples
- See `src/components/PostCard.jsx` and `src/components/PostForm.jsx` for recommended styling & structure.
