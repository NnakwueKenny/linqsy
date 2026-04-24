# Frontend Steering

## Stack

- React + Vite + TypeScript
- Tailwind CSS for styling primitives
- Framer Motion for meaningful transitions
- Zustand for local client state slices

## App Structure

Recommended web structure:

- `src/app`: app providers, router, shell wiring
- `src/pages`: top-level pages
- `src/features`: feature modules (session, transfers, presence, activity)
- `src/lib`: API client, socket client, helpers
- `src/state`: Zustand slices and selectors

UI composition must follow Atomic Design rules from `docs/steering/atomic-design.md`.

## State Ownership Rules

Client-owned:

- local interaction state
- upload UI progress while in-flight
- transient UI feedback (toasts, drag hover, modal open state)

Server-owned:

- session truth
- membership truth
- transfer lifecycle truth

Rule:

- if multiple devices must agree on it, server owns it

## Data And Realtime Rules

- Always fetch initial room/session state over HTTP
- Use WebSocket for incremental updates
- On reconnect, rehydrate from HTTP and then resume event stream
- Do not create client-only copies of shared contracts

## UX Behavior Rules

Every major screen must define:

- loading state
- empty state
- error state
- disconnected/reconnecting state
- ended-session state

Interaction rules:

- drag-and-drop works on desktop and touch alternatives exist on mobile
- transfer status is visible without opening secondary panels
- primary action is obvious in each page state

## Accessibility Rules

- keyboard-accessible controls and focus visibility
- semantic landmarks and headings
- sufficient contrast across dark theme tokens
- aria labels for icon-only actions

## Performance Rules

- avoid unnecessary rerenders in transfer lists
- virtualize only when list growth proves necessary
- defer non-critical animations on low-end devices
- keep bundle additions justified and documented

## Testing Rules

- component tests for critical UI states
- integration tests for join flow and transfer UI updates
- manual checks on mobile browser behavior

## Frozen Decisions

- React + Zustand + Tailwind + Framer Motion for v1 web stack
- Mobile-first support is mandatory
- Atomic Design composition is mandatory

## Requires ADR

- Replacing state management approach
- Replacing styling system or motion framework
- Changing reconnect/rehydration behavior contract
