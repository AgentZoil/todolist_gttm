# Design System — Corporate Trust

Áp dụng cho toàn bộ giao diện frontend (`apps/web`).

## Design Philosophy
- **Trustworthy Yet Vibrant**: Chuyên nghiệp nhưng năng động
- **Dimensional Depth**: Shadows màu, isometric transforms, gradient
- **Refined Elegance**: Micro-interactions, transitions mượt
- **Purposeful Gradients**: Indigo-to-violet là visual signature

## Design Tokens

### Colors
| Token | Value | Usage |
|---|---|---|
| Background | `#F8FAFC` (Slate 50) | Page background |
| Surface | `#FFFFFF` | Cards, raised elements |
| Primary | `#4F46E5` (Indigo 600) | Brand color, buttons |
| Secondary | `#7C3AED` (Violet 600) | Gradients, accents |
| Text Main | `#0F172A` (Slate 900) | Headlines, body |
| Text Muted | `#64748B` (Slate 500) | Supporting text |
| Success | `#10B981` (Emerald 500) | Positive indicators |
| Border | `#E2E8F0` (Slate 200) | Separators |

### Typography
- **Font**: Plus Jakarta Sans (Google Fonts)
- **Weights**: 400 (body), 500 (nav/labels), 600 (subheadings), 700 (headings), 800 (hero)
- **Line Heights**: 1.1 (headlines), 1.6-1.7 (body)
- **Letter Spacing**: -0.02em on large headlines

### Radius & Border
- Cards: `rounded-xl` (12px)
- Inputs: `rounded-lg` (8px)
- Buttons: `rounded-full` or `rounded-lg`
- Border: 1px using Border token

### Shadows (Colored, không dùng gray)
- **Card Default**: `0 4px 20px -2px rgba(79, 70, 229, 0.1)`
- **Card Hover**: `0 10px 25px -5px rgba(79, 70, 229, 0.15)`
- **Button**: `0 4px 14px 0 rgba(79, 70, 229, 0.3)`
- **Glow**: `shadow-[0_0_20px_rgba(79,70,229,0.5)]`

### Gradients
- Primary: `from-indigo-600 to-violet-600`
- Text: `bg-clip-text text-transparent`
- Background: `from-indigo-100 to-violet-100`
- Dark CTA: `from-indigo-900 to-indigo-950`

## Component Patterns

### Buttons
- **Primary**: Gradient bg, white text, rounded-full, lift on hover (`-translate-y-0.5`)
- **Secondary**: White bg, border slate-200, hover bg-slate-50

### Cards
- White bg, rounded-xl, border-slate-100, colored shadow
- Hover: lift `-translate-y-1` + increased shadow
- Feature cards: icon in soft bg (bg-indigo-50 text-indigo-600)

### Inputs
- White bg, border-slate-200, rounded-lg
- Focus: `ring-2 ring-indigo-500 ring-offset-1`
- Label: `text-sm font-semibold text-slate-700`

### Isometric Depth (Special Effects)
- Hero: `perspective-[2000px]` + `rotate-x-[5deg] rotate-y-[-12deg]`
- Hover transforms: `hover:rotate-x-[2deg] hover:rotate-y-[-8deg]`

### Background Blobs
- Large gradient orbs (400-600px), blur-3xl, opacity 20-50%
- Positioned absolutely for layered depth

## Spacing & Layout
- Container: `max-w-7xl` (1280px)
- Padding: `px-4 sm:px-6`
- Vertical: `py-16 sm:py-20 lg:py-24`
- Text width: `max-w-xl` or `max-w-2xl`

## Animation
- Base: `transition-all duration-200`
- Cards: `hover:-translate-y-1` + shadow
- Buttons: `hover:-translate-y-0.5`
- Icons: `group-hover:translate-x-1`
- Pulse: `animate-pulse duration-[4000ms]`

## Icon Library
- `lucide-react`
- Size: `h-4 w-4` inline, `h-5 w-5` - `h-6 w-6` featured
- Badge icons: `text-indigo-600` on `bg-indigo-100`

## Responsive
- Mobile-first, breakpoints: sm:640, md:768, lg:1024, xl:1280
- Headlines: `text-4xl` mobile → `text-6xl` desktop
- Two-column stacks to single on mobile
- Touch targets: min 44x44px

## Accessibility
- WCAG AA contrast ratios
- Focus: `focus-visible:ring-2 focus-visible:ring-indigo-500`
- Semantic HTML, proper headings, ARIA labels
