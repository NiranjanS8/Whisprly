# Visual Design Reference Guide

## Color Palette with Usage Guide

### Primary Colors
```
Primary Blue
Hex: #2D6CDF
RGB: 45, 108, 223
Usage: Primary buttons, sent message bubbles, focus states, links
Hover: #1A4BB8 (darker shade)
Accessibility: WCAG AAA compliant when used on #121212
```

```
Primary Dark Blue
Hex: #1A4BB8
RGB: 26, 75, 184
Usage: Hover states for primary elements, active states
Pairing: Used with #2D6CDF for hierarchy
```

### Accent Colors
```
Accent Teal
Hex: #00C896
RGB: 0, 200, 150
Usage: Accent elements, success states, secondary highlights
Gradient: Paired with Primary Blue for button gradients
Accessibility: High contrast on dark backgrounds
```

### Background Colors (Dark Theme)
```
Main Background
Hex: #121212
RGB: 18, 18, 18
Usage: App main background, maximizes contrast
Properties: Reduces eye strain, optimal for dark mode
Alternatives: For very dark displays, use #0A0A0A
```

```
Sidebar Background
Hex: #1E1E1E
RGB: 30, 30, 30
Usage: Sidebar, component backgrounds, headers
Relationship: 1 step lighter than main (creates subtle separation)
Depth: Creates clear visual hierarchy
```

```
Input Background
Hex: #2A2A2A
RGB: 42, 42, 42
Usage: Input fields, inactive elements, subtle containers
Elevation: Slightly raised from sidebar level
Interaction: Changes on focus with blue glow
```

### Text Colors
```
Primary Text
Hex: #EAEAEA
RGB: 234, 234, 234
Usage: Main body text, primary information
Size: Works at any text size
Contrast Ratio: 15.8:1 on #121212 (WCAG AAA)
```

```
Secondary Text
Hex: #B0B0B0
RGB: 176, 176, 176
Usage: Secondary information, descriptions, metadata
Size: 12-14px recommended
Contrast Ratio: 8.5:1 on #121212 (WCAG AA)
```

```
Muted Text
Hex: #808080
RGB: 128, 128, 128
Usage: Disabled states, tertiary info, placeholders
Size: 11-12px recommended
Contrast Ratio: 5.8:1 on #121212 (Minimum)
```

### Message Colors
```
Own Message (Sent)
Hex: #2D6CDF
RGB: 45, 108, 223
Shadow: 0 2px 8px rgba(45, 108, 223, 0.2)
Text Color: #FFFFFF (white)
Animation: slideIn 0.3s ease
```

```
Other Message (Received)
Hex: #2A2A2A
RGB: 42, 42, 42
Shadow: 0 2px 8px rgba(0, 0, 0, 0.3)
Text Color: #EAEAEA (soft white)
Animation: slideIn 0.3s ease
```

### Border & Divider Colors
```
Border Color
Hex: #2A2A2A
RGB: 42, 42, 42
Usage: Input borders, subtle dividers
Width: 1px standard
Opacity: Solid (no transparency)
Hover: Changes to #2D6CDF on focus
```

```
Divider Color
Hex: #1E1E1E
RGB: 30, 30, 30
Usage: Full-width dividers, section separators
Subtlety: Minimal visual weight
Opacity: Can use 50% for softer effect
```

### Status Colors
```
Success (Green)
Hex: #10B981
RGB: 16, 185, 129
Usage: Message delivered indicator, success states
Examples: ✓ sent, connection established

Warning (Amber)
Hex: #F59E0B
RGB: 245, 158, 11
Usage: Warnings, notifications, reconnecting state
Examples: ⚠ reconnecting, caution states

Error (Red)
Hex: #EF4444
RGB: 239, 68, 68
Usage: Error messages, failed states, delete actions
Examples: ✕ failed, error alerts
```

---

## Shadow System

### Shadow Small (Subtle)
```
Definition: 0 2px 8px rgba(0, 0, 0, 0.3)
Usage: Message bubbles, cards, hover states
Color: Dark with 30% opacity
Depth: Minimal elevation
Spread: Tight, under 8px
```

### Shadow Medium (Moderate)
```
Definition: 0 4px 16px rgba(0, 0, 0, 0.4)
Usage: Modals, popovers, floating elements
Color: Dark with 40% opacity
Depth: Moderate elevation
Spread: 16px for broader effect
```

### Shadow Large (Prominent)
```
Definition: 0 8px 24px rgba(0, 0, 0, 0.5)
Usage: Auth cards, major modals, overlays
Color: Dark with 50% opacity
Depth: High elevation
Spread: 24px for maximum effect
```

### Shadow Glass (Accent)
```
Definition: 0 8px 32px rgba(45, 108, 223, 0.15)
Usage: Blue accents, gradient buttons, premium elements
Color: Primary blue with 15% opacity
Effect: Glow effect specific to primary color
Pairing: Used on blue/gradient elements only
```

---

## Border Radius Reference

| Component | Radius | Use Case | Example |
|-----------|--------|----------|---------|
| Full Circle | 9999px | User avatars, round buttons | User profile picture |
| Large | 20px | Auth cards, large modals | Login form container |
| Message Main | 18px | Message bubble corners | Chat message |
| Message Tail | 6px | Message bubble tail | Asymmetric corner |
| Standard | 12px | Input fields, buttons, cards | Text input, room card |
| Small | 8px | Small UI elements, chips | Badge, small button |

---

## Typography System

### Font Family
```
Primary: 'Inter'
Fallbacks: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
Purpose: Clean, modern, highly readable
Usage: All text in the application
Variable Fonts: Supports weight variation (400, 600, 700, 800)
```

### Font Sizes
```
XS (Extra Small): 12px / 0.75rem
  Usage: Timestamps, small labels, captions
  Line Height: 1.4

SM (Small): 14px / 0.875rem
  Usage: Secondary text, small buttons, form labels
  Line Height: 1.5

Base: 16px / 1rem
  Usage: Body text, standard buttons, normal content
  Line Height: 1.6

LG (Large): 18px / 1.125rem
  Usage: Subheadings, emphasis text
  Line Height: 1.5

XL (Extra Large): 20px / 1.25rem
  Usage: Section headings
  Line Height: 1.3

2XL (2X Large): 24px / 1.5rem
  Usage: Main headings, titles
  Line Height: 1.2
```

### Font Weights
```
Regular: 400
  Usage: Body text, standard content

Semi-Bold: 600
  Usage: Labels, secondary emphasis, room names

Bold: 700
  Usage: Headings, important information, buttons

Extra Bold: 800
  Usage: Brand logo, major headings, app title
```

### Line Heights
```
Tight: 1.2
  Usage: Headings

Normal: 1.5
  Usage: Body text, standard content

Loose: 1.6
  Usage: Long-form text, accessibility

Spacious: 1.8
  Usage: User comfort, readability emphasis
```

---

## Spacing Scale

```
1px (space-1):   0.25rem / 4px     → Tight spacing, minimal gaps
2px (space-2):   0.5rem / 8px      → Small spacing, subtle separation
3px (space-3):   0.75rem / 12px    → Compact spacing
4px (space-4):   1rem / 16px       → Standard spacing, default
6px (space-6):   1.5rem / 24px     → Comfortable spacing
8px (space-8):   2rem / 32px       → Large spacing, section breaks
12px (space-12): 3rem / 48px       → Extra large spacing
```

### Common Spacing Patterns
```
Padding (internal):
  - Button: 12px vertical × 16px horizontal
  - Input: 11px vertical × 16px horizontal
  - Card: 24px (1.5rem) all sides
  - Message bubble: 10px vertical × 14px horizontal

Margin (external):
  - Between sections: 24px (1.5rem)
  - Between items: 8px-12px (space-2 to space-3)
  - Between groups: 16px (space-4)

Gap (flex):
  - Button groups: 8px (space-2)
  - Form fields: 16px (space-4)
  - Message items: 12px (space-3)
```

---

## Animation Specifications

### Message Slide In
```css
Duration: 0.3s
Easing: ease (cubic-bezier(0.25, 0.46, 0.45, 0.94))
Keyframes:
  0%:   opacity: 0, transform: translateY(8px) scale(0.95)
  100%: opacity: 1, transform: translateY(0) scale(1)
GPU: Yes (transform, opacity)
Performance: Smooth 60fps
```

### Fade In
```css
Duration: 0.3s
Easing: ease
Keyframes:
  0%:   opacity: 0
  100%: opacity: 1
Usage: Component entrance, gradual appearance
GPU: Yes (opacity only)
```

### Slide Up
```css
Duration: 0.3s
Easing: ease
Keyframes:
  0%:   opacity: 0, transform: translateY(12px)
  100%: opacity: 1, transform: translateY(0)
Usage: Modal entrance, form appearance
GPU: Yes (transform, opacity)
```

### Button Hover
```css
Property: transform
Duration: 0.2s
Effect: translateY(-2px)
Shadow: Enhanced from 2px to 4px
Combined: Elevation effect with shadow growth
```

### Pulse Loading
```css
Duration: 1.5s
Easing: ease-in-out
Keyframes:
  0%, 100%: opacity: 0.5
  50%:      opacity: 1
Usage: Skeleton loaders, loading indicators
GPU: Yes (opacity)
```

---

## Component-Specific Styling

### Button States
```
Normal State:
  Background: #2D6CDF
  Text: #FFFFFF
  Shadow: 0 2px 8px rgba(45, 108, 223, 0.25)
  Cursor: pointer

Hover State:
  Transform: translateY(-2px)
  Shadow: 0 4px 12px rgba(45, 108, 223, 0.35)
  Duration: 0.2s

Active State:
  Transform: translateY(0)
  Shadow: 0 2px 8px rgba(45, 108, 223, 0.25)

Disabled State:
  Opacity: 0.4
  Cursor: not-allowed
  No hover effect
```

### Input States
```
Idle State:
  Background: #2A2A2A
  Border: 1px solid #2A2A2A
  Text: #EAEAEA
  Placeholder: #808080

Focus State:
  Background: #2A2A2A (unchanged)
  Border: 1px solid #2D6CDF
  Shadow: 0 0 0 3px rgba(45, 108, 223, 0.12)
  Outline: none
  Duration: 0.2s

Error State:
  Border: 1px solid #EF4444
  Shadow: 0 0 0 3px rgba(239, 68, 68, 0.1)
```

---

## Accessibility Compliance

### Color Contrast Ratios
```
Primary Text (#EAEAEA on #121212): 15.8:1
  WCAG Level: AAA (Enhanced)
  Compliant: ✓ All sizes

Secondary Text (#B0B0B0 on #121212): 8.5:1
  WCAG Level: AA (Standard)
  Compliant: ✓ Sizes ≥12px

Muted Text (#808080 on #121212): 5.8:1
  WCAG Level: AA (Minimum)
  Compliant: ✓ Sizes ≥18px

Buttons (#FFFFFF on #2D6CDF): 4.5:1
  WCAG Level: AA
  Compliant: ✓ All sizes
```

### Touch Targets
```
Minimum Size: 44×44px
  Buttons: ✓ 42-48px
  Avatars: ✓ 32-44px
  Card clickable area: ✓ >44px
  Input fields: ✓ 42px height

Spacing Between: 8px minimum
  Between buttons: ✓ 12px gap
  Between interactive elements: ✓ >8px
```

### Focus Indicators
```
Keyboard Navigation: ✓ Visible 3px outline
  Color: #2D6CDF
  Offset: 2px
  
Touch Focus: ✓ Color change + shadow
  Hover visual design applies
  
Screen Reader: ✓ Semantic HTML
  Buttons: <button> tags
  Links: <a> tags
  Forms: <label> associated
```

---

## Implementation Checklist

When implementing new components, ensure:

- [ ] Colors match palette exactly (use CSS variables)
- [ ] Border radius follows scale (8px, 12px, 18px, 20px)
- [ ] Spacing uses scale units (4px, 8px, 12px, 16px, 24px, 32px)
- [ ] Shadows match system (sm, md, lg, or glass)
- [ ] Animations use standard durations (0.2s interaction, 0.3s entrance)
- [ ] Focus states visible for keyboard users
- [ ] Contrast ratio WCAG AA minimum (#808080+ acceptable)
- [ ] Touch targets 44×44px minimum
- [ ] GPU-accelerated animations (transform, opacity)
- [ ] No performance impact on message scroll

---

**Reference Version:** 1.0  
**Last Updated:** 2026-02-24  
**Status:** Production Standard
