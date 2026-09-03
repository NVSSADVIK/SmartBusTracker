import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bus,
  SlidersHorizontal,
  Info,
  CheckCircle2
} from "lucide-react";
import LocationSearch from "./components/LocationSearch/LocationSearch";
import BusList from "./components/BusList/BusList";
import BusMap from "./components/BusMap/BusMap";
import {
  fetchApproachingBuses,
  connectLiveFeed,
  getApiMode,
  setApiMode
} from "./api";

export default function App() {
  // Geolocation states
  const [userCoords, setUserCoords] = useState(null);
  const [geoStatus, setGeoStatus] = useState("prompt"); // 'prompt' | 'granted' | 'denied'

  // Selected stop & approaching buses
  const [selectedStop, setSelectedStop] = useState(null);
  const [buses, setBuses] = useState([]);
  const [isLoadingBuses, setIsLoadingBuses] = useState(false);
  const [busesError, setBusesError] = useState(null);
  const [selectedBusId, setSelectedBusId] = useState(null);

  // WebSocket live feed status: 'connecting' | 'connected' | 'stale' | 'disconnected'
  const [wsStatus, setWsStatus] = useState("disconnected");

  // API Mode & Backend contract inspector drawer
  const [isMock, setIsMock] = useState(getApiMode());
  const [showContractModal, setShowContractModal] = useState(false);

  // Live feed reference to manage subscriptions
  const liveFeedRef = useRef(null);

  // Request location on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      // Async state update if geolocation not supported
      setTimeout(() => setGeoStatus("denied"), 0);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
        setGeoStatus("granted");
      },
      (err) => {
        console.warn("Geolocation denied or timed out:", err.message);
        setGeoStatus("denied");
        setUserCoords({ lat: 13.0827, lng: 80.2707 });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  }, []);

  const handleManualRequestLocation = useCallback(() => {
    setGeoStatus("prompt");
    if (!navigator.geolocation) {
      setGeoStatus("denied");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
        setGeoStatus("granted");
      },
      (err) => {
        console.warn("Geolocation denied or timed out:", err.message);
        setGeoStatus("denied");
        setUserCoords({ lat: 13.0827, lng: 80.2707 });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  }, []);

  const handleSelectStop = useCallback((stop) => {
    setSelectedStop(stop);
    setSelectedBusId(null);
    setIsLoadingBuses(true);
    setBusesError(null);
  }, []);

  // 2. Fetch approaching buses and bind live WebSocket feed when stop changes
  useEffect(() => {
    if (!selectedStop) return;

    let isMounted = true;

    // Initial fetch via GET /buses/nearby?stop_id=
    fetchApproachingBuses(selectedStop.stop_id, {
      lat: selectedStop.lat,
      lng: selectedStop.lng
    })
      .then((initialBuses) => {
        if (!isMounted) return;
        setBuses(initialBuses || []);
        setIsLoadingBuses(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Failed to load approaching buses:", err);
        setBusesError("Unable to load approaching buses for this stop.");
        setIsLoadingBuses(false);
      });

    // Close any prior WebSocket before starting a new one
    if (liveFeedRef.current) {
      liveFeedRef.current.disconnect();
      liveFeedRef.current = null;
    }

    // Subscribe to live WebSocket feed: ws://<host>/live
    liveFeedRef.current = connectLiveFeed({
      stopId: selectedStop.stop_id,
      baseStopCoords: { lat: selectedStop.lat, lng: selectedStop.lng },
      onStatusChange: (status) => {
        if (isMounted) setWsStatus(status);
      },
      onError: (err) => {
        console.warn("Live feed warning:", err);
      },
      onMessage: (payload) => {
        if (!isMounted) return;
        if (payload?.buses) {
          // Live telemetry update from WebSocket
          setBuses(payload.buses);
        }
      }
    });

    return () => {
      isMounted = false;
      if (liveFeedRef.current) {
        liveFeedRef.current.disconnect();
        liveFeedRef.current = null;
      }
    };
  }, [selectedStop, isMock]);

  // Toggle Mock vs Real API backend
  const handleToggleApiMode = (val) => {
    setApiMode(val);
    setIsMock(val);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Header Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-slate-900 text-white p-1.5 rounded">
              <Bus className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 leading-none">
                  Smart Bus Intelligence
                </h1>
                <span className="text-[10px] uppercase font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded hidden sm:inline">
                  Passenger App
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-none">
                Conductor ETM Seat &amp; Position Derived Tracking
              </p>
            </div>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowContractModal(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition-colors"
              title="View FastAPI endpoints contract and connection settings"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">API Contract</span>
              <span className="font-mono text-[11px] text-slate-500">
                ({isMock ? "Mock" : "Live API"})
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-4 flex-1">
        {/* Responsive Grid: 2 columns on desktop, stacked on mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left Column: Location, Search, Stops, Approaching Buses (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* 1. Location + Nearby Stops + Dynamic Search */}
            <LocationSearch
              userCoords={userCoords}
              selectedStop={selectedStop}
              onSelectStop={handleSelectStop}
              geoStatus={geoStatus}
              onRequestLocation={handleManualRequestLocation}
            />

            {/* 2. Buses Approaching Selected Stop */}
            <BusList
              selectedStop={selectedStop}
              buses={buses}
              isLoading={isLoadingBuses}
              errorMsg={busesError}
              wsStatus={wsStatus}
              selectedBusId={selectedBusId}
              onSelectBus={(bus) => setSelectedBusId(bus.bus_id)}
            />
          </div>

          {/* Right Column: Interactive Leaflet Map (7 cols) */}
          <div className="lg:col-span-7 lg:sticky lg:top-20">
            <BusMap
              userCoords={userCoords}
              selectedStop={selectedStop}
              buses={buses}
              selectedBusId={selectedBusId}
              onSelectBus={(bus) => setSelectedBusId(bus.bus_id)}
              wsStatus={wsStatus}
            />

            {/* Explanatory system note on conductor ticket telemetry */}
            <div className="mt-3 p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-semibold text-slate-800">
                  How does this work without reliable GPS?
                </span>{" "}
                State transport buses (TNSTC/MTC/SETC) issue tickets through electronic ticketing machines (ETM). Every ticket issued registers a timestamped transit transaction. The backend ML model predicts real-time bus progression and seat odds directly from ticket issuance velocity, using onboard GPS as an auxiliary signal whenever active.
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-3 mt-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            Smart Bus Intelligence System &bull; Passenger Web App
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>FastAPI + PostgreSQL + Leaflet</span>
            <span>&bull;</span>
            <button
              type="button"
              onClick={() => setShowContractModal(true)}
              className="text-sky-700 hover:underline"
            >
              API Spec &amp; Endpoint Status
            </button>
          </div>
        </div>
      </footer>

      {/* Backend API Contract & Switcher Modal */}
      {showContractModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-300 rounded-lg max-w-2xl w-full p-5 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-sky-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Backend Contract &amp; Integration Status
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowContractModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-medium px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs text-slate-700">
              {/* API Mode Selector */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                <div className="font-semibold text-slate-900 mb-1">
                  Active Data Provider Mode
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="api_mode"
                      checked={isMock}
                      onChange={() => handleToggleApiMode(true)}
                      className="text-sky-600 focus:ring-sky-600"
                    />
                    <span className="font-medium text-slate-800">
                      Mock Data &amp; Simulated WebSocket (Demo Ready)
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="api_mode"
                      checked={!isMock}
                      onChange={() => handleToggleApiMode(false)}
                      className="text-sky-600 focus:ring-sky-600"
                    />
                    <span className="font-medium text-slate-800">
                      Live FastAPI Backend (localhost:8000)
                    </span>
                  </label>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  When your backend teammate starts the FastAPI service, select Live Backend. The entire app communicates exclusively through <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">src/api/index.js</code>.
                </p>
              </div>

              {/* Endpoint Contract Table */}
              <div>
                <div className="font-semibold text-slate-900 mb-2">
                  API Endpoints &amp; Contract Verification
                </div>
                <div className="border border-slate-200 rounded overflow-hidden">
                  <table className="min-w-full divide-y divide-slate-200 text-left">
                    <thead className="bg-slate-50 text-slate-600 font-medium text-[11px]">
                      <tr>
                        <th className="px-3 py-2">Endpoint</th>
                        <th className="px-2 py-2">Method</th>
                        <th className="px-3 py-2">Status / Origin</th>
                        <th className="px-3 py-2">Purpose</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                      <tr className="bg-amber-50/50">
                        <td className="px-3 py-2 font-semibold text-slate-900">
                          /stops/nearby?lat=&amp;lng=&amp;radius=
                        </td>
                        <td className="px-2 py-2 text-sky-700">GET</td>
                        <td className="px-3 py-2">
                          <span className="inline-block px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-sans text-[10px] font-semibold border border-amber-300">
                            NEW (Needs Confirmation)
                          </span>
                        </td>
                        <td className="px-3 py-2 font-sans text-slate-600">
                          Nearest stops to coordinate with distance
                        </td>
                      </tr>
                      <tr className="bg-amber-50/50">
                        <td className="px-3 py-2 font-semibold text-slate-900">
                          /stops/search?q=
                        </td>
                        <td className="px-2 py-2 text-sky-700">GET</td>
                        <td className="px-3 py-2">
                          <span className="inline-block px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-sans text-[10px] font-semibold border border-amber-300">
                            NEW (Needs Confirmation)
                          </span>
                        </td>
                        <td className="px-3 py-2 font-sans text-slate-600">
                          Dynamic stop search by name/area (debounced 300ms)
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-semibold text-slate-900">
                          /buses/nearby?stop_id=
                        </td>
                        <td className="px-2 py-2 text-sky-700">GET</td>
                        <td className="px-3 py-2">
                          <span className="inline-block px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-sans text-[10px] font-semibold border border-emerald-300">
                            Original Contract
                          </span>
                        </td>
                        <td className="px-3 py-2 font-sans text-slate-600">
                          Approaching buses, ETA + Seat-Likelihood
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-semibold text-slate-900">
                          /buses/&#123;bus_id&#125;/eta?stop_id=
                        </td>
                        <td className="px-2 py-2 text-sky-700">GET</td>
                        <td className="px-3 py-2">
                          <span className="inline-block px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-sans text-[10px] font-semibold border border-emerald-300">
                            Original Contract
                          </span>
                        </td>
                        <td className="px-3 py-2 font-sans text-slate-600">
                          Specific bus detailed ETA breakdown
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-semibold text-slate-900">
                          ws://&lt;host&gt;/live
                        </td>
                        <td className="px-2 py-2 text-purple-700">WS</td>
                        <td className="px-3 py-2">
                          <span className="inline-block px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-sans text-[10px] font-semibold border border-emerald-300">
                            Original Contract
                          </span>
                        </td>
                        <td className="px-3 py-2 font-sans text-slate-600">
                          Live WebSocket push of bus coordinates &amp; ETAs
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Requirements checklist */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1.5 text-[11px] text-slate-600">
                <div className="font-semibold text-slate-800 text-xs">
                  Zero Rework Guarantee:
                </div>
                <div className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>All backend calls isolated behind <code className="font-mono">src/api/index.js</code></span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Native WebSocket API matching FastAPI without Socket.io dependency</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Seat-likelihood badges (Seat likely / uncertain / unlikely) instead of raw numbers</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Automatic WebSocket reconnect on drop with stale telemetry warning</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowContractModal(false)}
                className="px-4 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors"
              >
                Close Spec Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
