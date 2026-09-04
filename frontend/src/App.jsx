import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bus,
  SlidersHorizontal,
  Info,
  CheckCircle2,
  User,
  Bookmark,
  Settings,
  LogOut,
  ChevronDown,
  HelpCircle,
  ShieldCheck,
  X
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

// Crisp SVG placeholder avatar for commuter profile
const DEFAULT_AVATAR_URL = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%230284c7"/><stop offset="100%" stop-color="%230f172a"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(%23bg)"/><circle cx="50" cy="38" r="17" fill="%23ffffff" opacity="0.95"/><path d="M22 84c0-15.46 12.54-28 28-28s28 12.54 28 28" fill="%23ffffff" opacity="0.95"/></svg>`;

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

  // User Profile Menu & Avatar Fallback
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const profileMenuRef = useRef(null);

  // Consumer Informational Modals: 'about' | 'help' | 'privacy' | null
  const [activeFooterModal, setActiveFooterModal] = useState(null);

  // Dev-only contract inspector (hidden from passengers; gated via ?dev=true or Ctrl+Shift+D)
  const isDevParam =
    typeof window !== "undefined" &&
    (new URLSearchParams(window.location.search).get("dev") === "true" ||
      new URLSearchParams(window.location.search).get("dev") === "1");
  const [isDevMode, setIsDevMode] = useState(isDevParam);
  const [isMock, setIsMock] = useState(getApiMode());
  const [showContractModal, setShowContractModal] = useState(false);

  // Live feed reference to manage subscriptions
  const liveFeedRef = useRef(null);

  // Close profile menu on click outside or Escape key
  useEffect(() => {
    function handleClickOutside(e) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setIsProfileMenuOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setIsProfileMenuOpen(false);
        setActiveFooterModal(null);
        setShowContractModal(false);
      }
      // Dev mode secret toggle for engineers/judges: Ctrl+Shift+D
      if (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d")) {
        setIsDevMode((prev) => !prev);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Dismiss toast after delay
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

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

  const handleMenuAction = (actionName) => {
    setIsProfileMenuOpen(false);
    switch (actionName) {
      case "Profile":
        setToastMessage("Viewing profile: Daily Commuter (Chennai Transit)");
        break;
      case "My saved stops":
        setToastMessage("Saved stops: CMBT, Guindy & Panagal Park");
        break;
      case "Settings":
        setToastMessage("Settings updated: Live arrivals & notifications active");
        break;
      case "Log out":
        setToastMessage("Logged out. Switched to Guest Commuter mode.");
        break;
      default:
        break;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-16 right-4 z-50 bg-slate-900 text-white text-xs px-3.5 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Consumer-friendly Branding */}
          <div className="flex items-center gap-2.5">
            <div className="bg-slate-900 text-white p-1.5 rounded-lg shadow-2xs">
              <Bus className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 leading-none">
                  Smart Bus Tracker
                </h1>
                <span className="text-[10px] uppercase font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full hidden sm:inline">
                  Live Network
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-none">
                Real-time bus arrivals &amp; seat availability
              </p>
            </div>
          </div>

          {/* Right: User Profile Avatar & Account Dropdown */}
          <div className="flex items-center gap-3">
            {/* Dev Mode toggle indicator if dev flag is active */}
            {isDevMode && (
              <button
                type="button"
                onClick={() => setShowContractModal(true)}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-900 bg-amber-100 hover:bg-amber-200 rounded border border-amber-300 transition-colors"
                title="Open API Contract & Dev settings"
              >
                <SlidersHorizontal className="w-3 h-3 text-amber-700" />
                <span>Dev Spec</span>
              </button>
            )}

            {/* Profile Avatar Trigger */}
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-1.5 p-1 rounded-full hover:bg-slate-100 transition-colors focus:outline-hidden focus:ring-2 focus:ring-sky-500 cursor-pointer"
                aria-label="User account menu"
                aria-expanded={isProfileMenuOpen}
              >
                <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-slate-200 shadow-2xs bg-slate-100 flex items-center justify-center">
                  {!avatarError ? (
                    <img
                      src={DEFAULT_AVATAR_URL}
                      alt="User profile avatar"
                      className="w-full h-full object-cover"
                      onError={() => setAvatarError(true)}
                    />
                  ) : (
                    <User className="w-4 h-4 text-slate-600" />
                  )}
                  {/* Subtle online status indicator */}
                  <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white"></span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-150 ${
                    isProfileMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Account Dropdown Menu */}
              {isProfileMenuOpen && (
                <div className="absolute right-0 top-11 w-64 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-50 text-xs">
                  {/* Commuter profile summary */}
                  <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center shrink-0">
                      {!avatarError ? (
                        <img
                          src={DEFAULT_AVATAR_URL}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-4 h-4 text-slate-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">
                        Daily Commuter
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        Chennai MTC / TNSTC
                      </div>
                      <span className="inline-block mt-0.5 text-[9px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full">
                        Transit Pass Active
                      </span>
                    </div>
                  </div>

                  {/* Menu options */}
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => handleMenuAction("Profile")}
                      className="w-full text-left px-3.5 py-2 flex items-center gap-2.5 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      <span>Profile</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMenuAction("My saved stops")}
                      className="w-full text-left px-3.5 py-2 flex items-center justify-between text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <Bookmark className="w-4 h-4 text-slate-400" />
                        <span>My saved stops</span>
                      </div>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-medium">
                        3
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMenuAction("Settings")}
                      className="w-full text-left px-3.5 py-2 flex items-center gap-2.5 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-slate-400" />
                      <span>Settings</span>
                    </button>
                  </div>

                  {/* Divider and Log out */}
                  <div className="border-t border-slate-100 pt-1">
                    <button
                      type="button"
                      onClick={() => handleMenuAction("Log out")}
                      className="w-full text-left px-3.5 py-2 flex items-center gap-2.5 text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      <span>Log out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
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

            {/* Consumer-friendly explanatory system note */}
            <div className="mt-3 p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 flex items-start gap-2.5 shadow-2xs">
              <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-semibold text-slate-800">
                  How does live tracking work here?
                </span>{" "}
                Many state transport buses operate without reliable GPS. Smart Bus Tracker predicts real-time bus locations and seat availability by analyzing electronic ticketing data as conductors issue tickets to boarding passengers along the route.
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Consumer-Ready App Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            {/* Left: App name and one-line tagline */}
            <div className="flex items-center gap-2.5">
              <div className="bg-slate-900 text-white p-1.5 rounded">
                <Bus className="w-4 h-4 text-sky-400" />
              </div>
              <div>
                <span className="font-bold text-slate-900 text-sm">
                  Smart Bus Tracker
                </span>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time bus tracking and crowd intelligence for daily commuters.
                </p>
              </div>
            </div>

            {/* Right: Consumer Navigation Links */}
            <div className="flex items-center gap-5 text-xs font-medium text-slate-600">
              <button
                type="button"
                onClick={() => setActiveFooterModal("about")}
                className="hover:text-sky-600 transition-colors cursor-pointer"
              >
                About
              </button>
              <button
                type="button"
                onClick={() => setActiveFooterModal("help")}
                className="hover:text-sky-600 transition-colors cursor-pointer"
              >
                Help &amp; Support
              </button>
              <button
                type="button"
                onClick={() => setActiveFooterModal("privacy")}
                className="hover:text-sky-600 transition-colors cursor-pointer"
              >
                Privacy
              </button>
            </div>
          </div>

          {/* Bottom Bar: Copyright & Unobtrusive Tech Credits */}
          <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
            <div>
              &copy; {new Date().getFullYear()} Smart Bus Tracker &bull; Hackathon Demonstration Build
            </div>
            <div className="text-[11px] text-slate-400">
              Built with React, Leaflet &amp; OpenStreetMap
            </div>
          </div>
        </div>
      </footer>

      {/* Consumer Informational Modals */}
      {activeFooterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-300 rounded-lg max-w-lg w-full p-5 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                {activeFooterModal === "about" && (
                  <Bus className="w-4 h-4 text-sky-600" />
                )}
                {activeFooterModal === "help" && (
                  <HelpCircle className="w-4 h-4 text-sky-600" />
                )}
                {activeFooterModal === "privacy" && (
                  <ShieldCheck className="w-4 h-4 text-sky-600" />
                )}
                <h3 className="text-sm font-bold text-slate-900">
                  {activeFooterModal === "about" && "About Smart Bus Tracker"}
                  {activeFooterModal === "help" && "Help & Frequently Asked Questions"}
                  {activeFooterModal === "privacy" && "Privacy Notice"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveFooterModal(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 text-xs text-slate-600 space-y-3 leading-relaxed">
              {activeFooterModal === "about" && (
                <>
                  <p>
                    <strong className="text-slate-800">Smart Bus Tracker</strong> solves the transit visibility challenge for commuters who rely on city and state transport buses.
                  </p>
                  <p>
                    Many government transit buses lack continuous GPS devices. Our platform turns conductor electronic ticketing machines (ETMs) into live transit sensors. As tickets are issued, our predictive engine calculates bus velocity, arrival times, and passenger crowding.
                  </p>
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200 space-y-1 text-[11px]">
                    <div>&bull; <strong>Active Coverage:</strong> Chennai Metropolitan Transport Corporation (MTC) &amp; TNSTC corridors</div>
                    <div>&bull; <strong>Build Version:</strong> 1.0.0 (Hackathon Demonstration)</div>
                  </div>
                </>
              )}

              {activeFooterModal === "help" && (
                <>
                  <div className="space-y-2">
                    <div>
                      <strong className="text-slate-800 block">What do the seat likelihood badges mean?</strong>
                      <span className="text-slate-600">
                        &bull; <strong>Seat likely:</strong> Low boarding volume on preceding stops. Plenty of open seating.<br />
                        &bull; <strong>Seat uncertain:</strong> Moderate passenger loading. Seats may fill rapidly.<br />
                        &bull; <strong>Seat unlikely:</strong> Bus has heavy boardings. Standing room only expected.
                      </span>
                    </div>
                    <div>
                      <strong className="text-slate-800 block">How often does data refresh?</strong>
                      <span className="text-slate-600">
                        Buses push live position ticks every 3 to 5 seconds. The green &ldquo;Live Feed&rdquo; badge confirms active real-time connectivity.
                      </span>
                    </div>
                  </div>
                </>
              )}

              {activeFooterModal === "privacy" && (
                <>
                  <p>
                    Smart Bus Tracker is designed with privacy-first principles for passengers.
                  </p>
                  <p>
                    Your device location is processed locally in your browser strictly to sort the nearest bus stops. Coordinates are never saved, stored, or shared.
                  </p>
                </>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveFooterModal(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dev-Only Backend API Contract & Switcher Modal (strictly gated) */}
      {isDevMode && showContractModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-300 rounded-lg max-w-2xl w-full p-5 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-sky-600" />
                <h3 className="text-base font-bold text-slate-900">
                  [Developer Mode] Backend Contract &amp; Status
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
            </div>

            <div className="mt-5 pt-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowContractModal(false)}
                className="px-4 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors cursor-pointer"
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
