# Public Folder

Place your static media assets here (images, videos, fonts, audio files).

Vite serves files in this directory directly at the root path:
- An image saved at `public/hero-left.jpg` can be referenced as `/hero-left.jpg`
- A video saved at `public/bg-video.mp4` can be referenced as `/bg-video.mp4`

Example usage in `TwoPanelHero.tsx`:
```tsx
<TwoPanelHero
  leftPanelBg="/hero-left.jpg"
  rightPanelBg="/hero-right.jpg"
/>
```
