# Smart Bus Intelligence System — Passenger App

Passenger-facing web application for the **Smart Bus Intelligence System** hackathon project. Designed for state/city transport corridors (TNSTC/MTC/SETC) where continuous GPS tracking is irregular, so bus positions and seat availability are primarily inferred from conductor Electronic Ticket Machine (ETM) issuance telemetry, with onboard GPS as an auxiliary signal when available.

---

## Design Directives Followed

- **Strict Minimal Light Color Palette (Max 4 colors)**:
  1. Slate Neutral (`#f8fafc` background, `#ffffff` cards, `#0f172a` text, `#e2e8f0` borders)
  2. Transit Primary Blue (`#0284c7`) — active stop, user pin, bus route highlights
  3. Bus Stop Amber (`#d97706`) — stop shelter markers & "Seat uncertain" badge
  4. Signal Green (`#15803d`) — "Seat likely" badge, live WebSocket indicator, "Recommended" flag
- Simple, high-contrast, clean commuter interface — no artificial dark-mode cyber dashboards or neon AI gradients.
- **Pluggable Architecture**: All network and WebSocket communications are isolated behind `src/api/index.js`. Swapping from demo mock data to real FastAPI backend requires zero component changes.

---

## API Contract & Backend Confirmation Status

| Endpoint | Method | Status | Purpose |
|---|---|---|---|
| `GET /stops/nearby?lat=&lng=&radius=` | GET | ⚠️ **NEW (Needs Confirmation)** | List of nearest stops to a coordinate with distance |
| `GET /stops/search?q=` | GET | ⚠️ **NEW (Needs Confirmation)** | Dynamic stop search by name or area (debounced ~300ms) |
| `GET /buses/nearby?stop_id=` | GET | ✅ Original Contract | Buses approaching given stop, with ETA + seat-likelihood |
| `GET /buses/{bus_id}/eta?stop_id=` | GET | ✅ Original Contract | ETA & intermediate stop sequence for one specific bus |
| `ws://<host>/live` | WebSocket | ✅ Original Contract | Live push of bus coordinates, ETAs, and seat odds |

> **Note for Backend Developer**: The endpoints `/stops/nearby` and `/stops/search` have been created and flagged for your confirmation. Check `src/api/index.js` for expected query parameters and response schemas.

---

## Features

1. **Location & Nearby Stops**:
   - Browser Geolocation API (`navigator.geolocation.getCurrentPosition`) on load.
   - Graceful fallback if permission is denied (manual search / enter area).
   - Dynamic debounced (~300ms) search querying `GET /stops/search?q=`.
2. **Approaching Buses**:
   - Route number, destination, ETA countdown, and seat-likelihood badges:
     - `Seat likely`
     - `Seat uncertain`
     - `Seat unlikely`
   - "Recommended" badge on the optimal combination of soonest arrival and best seat odds.
   - Conductor ETM Ticket Derived vs Live GPS signal indicator.
   - Detailed ETA breakdown modal (`GET /buses/{bus_id}/eta?stop_id=`).
3. **Interactive Leaflet Map**:
   - OpenStreetMap tiles (no API key required).
   - User location marker (blue pulse).
   - Selected stop marker (amber shelter pin).
   - Live approaching bus markers with route numbers, updated in real time via WebSocket feed.
4. **WebSocket Live Feed & Resilience**:
   - Auto-reconnect on drop with stale data warning indicator.
   - Standalone live simulation mode with realistic telemetry movement and ETA updates for testing before backend launch.

---

## Project Structure

```
src/
  api/
    index.js                  → Single module wrapping all REST calls + WebSocket feed
  mock-data/
    mockData.js               → Mock JSON & telemetry generator matching FastAPI schemas
  components/
    LocationSearch/
      LocationSearch.jsx      → Geolocation trigger, search bar, nearby stops list
    BusList/
      BusList.jsx             → Approaching buses, seat badges, live socket status, ETA modal
    BusMap/
      BusMap.jsx              → Leaflet map with OSM tiles & live bus markers
  App.jsx                     → Layout orchestrator & contract spec inspector
  main.jsx
  index.css                   → Tailwind CSS v4 & Leaflet styling
```

---

## Getting Started

### Development Server
```bash
npm run dev
```

### Production Build & Linting
```bash
npm run lint
npm run build
npm run preview
```

### Switching to Live Backend
By default, the application runs in mock mode for zero-dependency standalone demos.
To connect to the real FastAPI backend, either:
1. Open the app and click the **"API Contract"** button in the header bar and switch to **"Live FastAPI Backend"**, or
2. Set environment variables in `.env`:
   ```env
   VITE_API_URL=http://localhost:8000
   VITE_WS_URL=ws://localhost:8000/live
   VITE_USE_MOCK=false
   ```
