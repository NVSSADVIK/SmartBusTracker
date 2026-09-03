/**
 * API Client Module for Smart Bus Intelligence System
 * 
 * All HTTP and WebSocket interactions pass through this module.
 * Switching between mock mode and real FastAPI backend is controlled via
 * environment variables (VITE_API_URL, VITE_WS_URL, VITE_USE_MOCK)
 * or dynamically via setApiMode().
 * 
 * CONTRACT STATUS WITH BACKEND DEV:
 * 1. GET /stops/nearby?lat=&lng=&radius=  --> [NEW - Needs backend confirmation]
 * 2. GET /stops/search?q=                 --> [NEW - Needs backend confirmation]
 * 3. GET /buses/nearby?stop_id=          --> [Confirmed from original contract]
 * 4. GET /buses/{bus_id}/eta?stop_id=    --> [Confirmed from original contract]
 * 5. ws://<host>/live                    --> [Confirmed from original contract]
 */

import {
  MOCK_STOPS,
  calculateDistanceMeters,
  getMockBusesForStop
} from "../mock-data/mockData";

const DEFAULT_API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const DEFAULT_WS_BASE = import.meta.env.VITE_WS_URL || "ws://localhost:8000/live";

// Default to mock mode if VITE_USE_MOCK is 'true' or if no API url is configured
let isMockMode = import.meta.env.VITE_USE_MOCK !== "false";

export function getApiMode() {
  return isMockMode;
}

export function setApiMode(useMock) {
  isMockMode = Boolean(useMock);
  return isMockMode;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 1. GET /stops/nearby?lat=&lng=&radius=
 * [FLAGGED FOR BACKEND: New endpoint vs original contract]
 * Returns nearest bus stops sorted by distance.
 */
export async function fetchNearbyStops(lat, lng, radius = 5000) {
  if (isMockMode) {
    await delay(300); // Simulate network latency
    // If coords provided, compute real distances and sort
    const stopsWithDistance = MOCK_STOPS.map((stop) => {
      const distance = calculateDistanceMeters(lat, lng, stop.lat, stop.lng);
      return {
        ...stop,
        distance_meters: distance,
        distance_text: distance < 1000 ? `${distance} m` : `${(distance / 1000).toFixed(1)} km`
      };
    }).sort((a, b) => a.distance_meters - b.distance_meters);

    return stopsWithDistance;
  }

  const url = `${DEFAULT_API_BASE}/stops/nearby?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&radius=${encodeURIComponent(radius)}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch nearby stops: HTTP ${response.status}`);
  }
  return await response.json();
}

/**
 * 2. GET /stops/search?q=
 * [FLAGGED FOR BACKEND: New endpoint vs original contract]
 * Dynamic query for stops by name or area.
 */
export async function searchStops(query) {
  if (!query || query.trim().length === 0) {
    return [];
  }

  if (isMockMode) {
    await delay(250);
    const q = query.toLowerCase().trim();
    const results = MOCK_STOPS.filter(
      (stop) =>
        stop.stop_name.toLowerCase().includes(q) ||
        (stop.area && stop.area.toLowerCase().includes(q)) ||
        stop.routes_served.some((r) => r.toLowerCase().includes(q))
    ).map((stop) => ({
      ...stop,
      distance_meters: null,
      distance_text: "Search result"
    }));

    return results;
  }

  const url = `${DEFAULT_API_BASE}/stops/search?q=${encodeURIComponent(query.trim())}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error(`Failed to search stops: HTTP ${response.status}`);
  }
  return await response.json();
}

/**
 * 3. GET /buses/nearby?stop_id=
 * [CONFIRMED: Original contract]
 * Buses approaching the specified stop with ETA and seat-likelihood badge.
 */
export async function fetchApproachingBuses(stopId, baseStopCoords) {
  if (!stopId) {
    throw new Error("stop_id is required");
  }

  if (isMockMode) {
    await delay(350);
    return getMockBusesForStop(stopId, baseStopCoords);
  }

  const url = `${DEFAULT_API_BASE}/buses/nearby?stop_id=${encodeURIComponent(stopId)}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch approaching buses: HTTP ${response.status}`);
  }
  return await response.json();
}

/**
 * 4. GET /buses/{bus_id}/eta?stop_id=
 * [CONFIRMED: Original contract]
 * Detailed ETA calculation for one specific bus approaching one stop.
 */
export async function fetchBusEta(busId, stopId) {
  if (!busId || !stopId) {
    throw new Error("bus_id and stop_id are required");
  }

  if (isMockMode) {
    await delay(200);
    return {
      bus_id: busId,
      stop_id: stopId,
      eta_minutes: 4,
      estimated_arrival_timestamp: new Date(Date.now() + 4 * 60000).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      }),
      intermediate_stops: [
        { name: "Previous Junction", status: "passed", time: "3 mins ago" },
        { name: "Signal Cross", status: "approaching", time: "Now" },
        { name: "Your Stop", status: "pending", time: "In 4 mins" }
      ],
      prediction_basis: "Conductor ETM ticket generation frequency + Corridor speed pattern",
      confidence: "High (0.91)"
    };
  }

  const url = `${DEFAULT_API_BASE}/buses/${encodeURIComponent(busId)}/eta?stop_id=${encodeURIComponent(stopId)}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch specific bus ETA: HTTP ${response.status}`);
  }
  return await response.json();
}

/**
 * 5. ws://<host>/live
 * [CONFIRMED: Original contract]
 * Native WebSocket connection with automatic reconnect and stale state tracking.
 * In mock mode, simulates live telemetry ticks, moving buses closer to the stop
 * and pushing updated ETAs and seat-likelihood.
 */
export function connectLiveFeed({ stopId, baseStopCoords, onMessage, onStatusChange, onError }) {
  let isClosed = false;
  let reconnectTimer = null;
  let ws = null;
  let mockInterval = null;

  // Track live simulation state when in mock mode
  let currentBuses = stopId ? getMockBusesForStop(stopId, baseStopCoords) : [];

  if (isMockMode) {
    onStatusChange?.("connected");

    // Push live telemetry tick every 3.5 seconds
    mockInterval = setInterval(() => {
      if (isClosed) return;

      currentBuses = currentBuses.map((bus) => {
        // Move bus slightly closer towards stop coords
        const targetLat = baseStopCoords?.lat || 13.0067;
        const targetLng = baseStopCoords?.lng || 80.2023;

        const deltaLat = (targetLat - bus.current_lat) * 0.08;
        const deltaLng = (targetLng - bus.current_lng) * 0.08;

        const newLat = bus.current_lat + deltaLat + (Math.random() - 0.5) * 0.0001;
        const newLng = bus.current_lng + deltaLng + (Math.random() - 0.5) * 0.0001;

        // Occasional ETA tick
        let newEta = bus.eta_minutes;
        if (Math.random() > 0.65 && newEta > 1) {
          newEta = Math.max(1, newEta - 1);
        }

        return {
          ...bus,
          current_lat: newLat,
          current_lng: newLng,
          eta_minutes: newEta,
          last_signal_time: "Just now"
        };
      });

      onMessage?.({
        type: "LIVE_TELEMETRY",
        stop_id: stopId,
        timestamp: new Date().toISOString(),
        buses: currentBuses
      });
    }, 3500);

    return {
      disconnect: () => {
        isClosed = true;
        if (mockInterval) clearInterval(mockInterval);
        onStatusChange?.("disconnected");
      },
      updateStop: (newStopId, newCoords) => {
        currentBuses = getMockBusesForStop(newStopId, newCoords);
        onMessage?.({
          type: "LIVE_TELEMETRY",
          stop_id: newStopId,
          timestamp: new Date().toISOString(),
          buses: currentBuses
        });
      }
    };
  }

  // Real Native WebSocket Mode
  function setupWebSocket() {
    if (isClosed) return;

    try {
      onStatusChange?.("connecting");
      ws = new WebSocket(DEFAULT_WS_BASE);

      ws.onopen = () => {
        onStatusChange?.("connected");
        // Send subscribe payload if required by backend
        if (stopId) {
          ws.send(JSON.stringify({ action: "subscribe", stop_id: stopId }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          onMessage?.(payload);
        } catch (e) {
          console.error("Failed to parse WebSocket message:", event.data, e);
        }
      };

      ws.onerror = (err) => {
        onError?.(err);
        onStatusChange?.("stale");
      };

      ws.onclose = () => {
        onStatusChange?.("stale");
        if (!isClosed) {
          // Auto reconnect with 3s backoff
          reconnectTimer = setTimeout(setupWebSocket, 3000);
        }
      };
    } catch (e) {
      onError?.(e);
      onStatusChange?.("stale");
      if (!isClosed) {
        reconnectTimer = setTimeout(setupWebSocket, 4000);
      }
    }
  }

  setupWebSocket();

  return {
    disconnect: () => {
      isClosed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        ws.close();
      }
      onStatusChange?.("disconnected");
    },
    updateStop: (newStopId) => {
      if (ws && ws.readyState === WebSocket.OPEN && newStopId) {
        ws.send(JSON.stringify({ action: "subscribe", stop_id: newStopId }));
      }
    }
  };
}
