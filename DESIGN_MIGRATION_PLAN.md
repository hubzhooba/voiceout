# Design System Migration Plan for VoiceOut

## Current State Analysis

### What We Have:
- **Framework**: Next.js 15 with TypeScript ✅
- **UI Library**: Shadcn/ui (Radix UI primitives) - Need to migrate to MUI
- **Styling**: Tailwind CSS - Need to integrate with MUI
- **Animation**: Basic transitions - Need Framer Motion
- **Theme**: Basic dark/light mode - Need MUI CSS Variables Provider

### What Needs to Change:

## Phase 1: Foundation Setup (Priority: HIGH)

### 1.1 Install Dependencies
```bash
npm install @mui/material @emotion/react @emotion/styled
npm install @mui/material-nextjs @emotion/cache
npm install framer-motion
```

### 1.2 Font Setup
- Add Roboto (300, 400, 500, 700)
- Add Space Grotesk (400, 500)
- Configure Next.js font optimization

### 1.3 Create MUI Theme
- Setup color palette (primary, secondary, accent)
- Configure typography scales
- Set breakpoints and spacing

## Phase 2: Color System Migration

### Current Colors → Target Colors

| Current | Target Light | Target Dark |
|---------|-------------|------------|
| Blue/Indigo gradients | #332B34 (Dark purple-gray) | rgb(220,220,220) |
| Glass morphism | rgb(230, 230, 230) | rgb(200,200,200) |
| Random accents | rgba(41, 204, 0, 1) (Green) | rgba(41, 204, 0, 1) |

### Gradient Updates
- Hero gradients: `linear-gradient(90deg, #332B34 0%, #2C3233 49.34%, #4D443A 100%)`
- Remove blue/indigo gradients
- Add subtle gray gradients for backgrounds

## Phase 3: Component Migration

### 3.1 Priority Components (Week 1)
- [ ] Buttons - Convert to MUI Button with gradient styles
- [ ] Cards - Convert to MUI Paper with outlined variant
- [ ] Navigation - Add glass morphism header
- [ ] Forms - Convert to MUI TextField/Select

### 3.2 Secondary Components (Week 2)
- [ ] Modals/Dialogs - MUI Dialog
- [ ] Tables - MUI DataGrid or Table
- [ ] Tabs - MUI Tabs with custom indicator
- [ ] Tooltips - MUI Tooltip

### 3.3 Layout Components (Week 3)
- [ ] Container - MUI Container (maxWidth: xl)
- [ ] Grid System - MUI Grid2
- [ ] Stack - MUI Stack for responsive layouts

## Phase 4: Animation System

### Framer Motion Patterns
```javascript
// Stagger animations for lists
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.5, delayChildren: 0.1 }
  }
}

// Page transitions
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
}
```

## Phase 5: Specific Updates

### 5.1 Dashboard Page
- Glass morphism header with blur
- Gradient accents on cards
- Smooth scroll carousels
- Stagger animations for cards

### 5.2 Project Pages
- MUI DataGrid for project lists
- Outlined paper cards
- Consistent border radius (32px for buttons, 5px for cards)
- Green accent for CTAs

### 5.3 Notification System
- MUI Snackbar for toasts
- Badge component from MUI
- Smooth transitions

## Phase 6: Responsive Design

### Breakpoint Strategy
```javascript
{
  xs: 0,     // Mobile
  sm: 600,   // Tablet
  md: 900,   // Small laptop
  lg: 1200,  // Desktop
  xl: 1360   // Large desktop
}
```

### Mobile-First Approach
- Stack layouts on mobile
- Reduce font sizes
- Hide secondary elements
- Touch-friendly targets (48px minimum)

## Phase 7: Performance Optimization

### CSS-in-JS Optimization
- Use MUI's sx prop efficiently
- Leverage CSS variables
- Minimize runtime calculations
- Use emotion cache for SSR

### Bundle Size
- Tree-shake MUI imports
- Lazy load heavy components
- Use dynamic imports for modals

## Phase 8: Testing & QA

### Visual Testing
- [ ] Light mode consistency
- [ ] Dark mode consistency
- [ ] Responsive breakpoints
- [ ] Animation performance

### Accessibility
- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] Color contrast (WCAG AA)
- [ ] Focus indicators

## Implementation Priority

### Week 1: Foundation
1. Install MUI and dependencies
2. Create theme configuration
3. Setup providers
4. Convert buttons and basic components

### Week 2: Core Pages
1. Dashboard with new design
2. Project list/detail pages
3. Navigation and header

### Week 3: Polish
1. Animations and transitions
2. Responsive refinements
3. Dark mode adjustments
4. Performance optimization

## Migration Checklist

### Immediate Actions
- [ ] Backup current styles
- [ ] Create feature branch
- [ ] Install MUI dependencies
- [ ] Setup theme provider
- [ ] Create component library

### Progressive Migration
- [ ] Start with new components
- [ ] Gradually replace existing
- [ ] Maintain both systems temporarily
- [ ] Remove Tailwind once complete

## Risk Mitigation

### Potential Issues
1. **Bundle size increase**: Mitigate with tree-shaking
2. **Style conflicts**: Use scoped styles and CSS modules
3. **Learning curve**: Create component documentation
4. **Performance**: Monitor with Lighthouse

### Rollback Plan
- Keep Tailwind setup intact initially
- Use feature flags for new design
- A/B test with users
- Maintain git branches

## Success Metrics

### Technical
- Lighthouse score > 90
- Bundle size < 300KB
- First paint < 1.5s
- TTI < 3.5s

### Design
- Consistent spacing (8px grid)
- Proper typography hierarchy
- Smooth animations (60fps)
- WCAG AA compliance

## Resources

### Documentation
- [MUI Documentation](https://mui.com/material-ui/)
- [Framer Motion](https://www.framer.com/motion/)
- [Next.js + MUI Guide](https://mui.com/material-ui/integrations/nextjs/)

### Design Files
- Color palette exports
- Typography scale
- Component specifications
- Animation timing functions

## Notes

The migration should be done progressively, starting with new features and gradually updating existing components. This approach minimizes risk and allows for user feedback during the transition.

Priority should be given to user-facing components that have the most impact on the overall experience. Internal admin pages can be migrated last.

Consider creating a Storybook instance to document the new component library as it's being built.