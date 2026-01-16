# Apple-Inspired Redesign Plan

## Design Philosophy
- **Clean & Minimal**: White/light gray backgrounds, no yellow/amber
- **Transparent Bubble Buttons**: Glassmorphism with backdrop blur
- **System Fonts**: SF Pro Display / System fonts
- **Subtle Depth**: Soft shadows, layered elements
- **Futuristic Feel**: Smooth animations, modern spacing

## Color Palette Changes
- **Background**: Pure white (#FFFFFF) or very light gray (#F5F5F7)
- **Primary**: System blue (#007AFF) or neutral gray (#1D1D1F)
- **Text**: Dark gray (#1D1D1F) on light, white on dark
- **Borders**: Subtle gray (#D2D2D7)
- **Remove**: All yellow/amber colors

## Button Style
- **Transparent Bubble**: `bg-white/80 backdrop-blur-xl border border-gray-200/50`
- **Rounded**: `rounded-2xl` or `rounded-3xl` (more rounded)
- **Shadow**: Subtle `shadow-sm` with hover `shadow-md`
- **Hover**: Slight scale and opacity change

## Implementation Steps
1. Update color palette in tailwind.config.js
2. Update index.css with new CSS variables
3. Redesign button component with bubble style
4. Update all backgrounds (remove yellow/amber)
5. Update cards and containers
6. Improve typography and spacing
7. Add smooth transitions
