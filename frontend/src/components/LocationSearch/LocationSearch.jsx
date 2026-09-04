import { useState, useEffect, useRef } from "react";
import {
  MapPin,
  Search,
  Crosshair,
  Loader2,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { fetchNearbyStops, searchStops } from "../../api";

export default function LocationSearch({
  userCoords,
  selectedStop,
  onSelectStop,
  geoStatus,
  onRequestLocation
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [stopsList, setStopsList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimerRef = useRef(null);
  const onSelectStopRef = useRef(onSelectStop);
  useEffect(() => {
    onSelectStopRef.current = onSelectStop;
  }, [onSelectStop]);

  // Initial fetch or when userCoords change: fetch nearby stops from backend API
  useEffect(() => {
    // If user is actively searching with text, don't overwrite search results
    if (searchQuery.trim().length > 0) return;

    let isMounted = true;
    const lat = userCoords?.lat || 13.0827; // Default Chennai Central if no GPS
    const lng = userCoords?.lng || 80.2707;

    fetchNearbyStops(lat, lng)
      .then((data) => {
        if (!isMounted) return;
        setStopsList(data || []);
        setIsLoading(false);
        setErrorMsg(null);

        // Auto-select first stop if none selected yet
        if (!selectedStop && data && data.length > 0) {
          onSelectStopRef.current?.(data[0]);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Error fetching nearby stops:", err);
        setErrorMsg("Unable to load nearby stops. Please try searching below.");
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userCoords?.lat, userCoords?.lng, searchQuery, selectedStop]);

  // Debounced dynamic search against backend endpoint: GET /stops/search?q=
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!val.trim()) {
      setIsSearching(false);
      // Reload nearby stops based on coords
      const lat = userCoords?.lat || 13.0827;
      const lng = userCoords?.lng || 80.2707;
      setIsLoading(true);
      fetchNearbyStops(lat, lng)
        .then((data) => {
          setStopsList(data || []);
          setIsLoading(false);
        })
        .catch(() => setIsLoading(false));
      return;
    }

    setIsSearching(true);
    setIsLoading(true);
    setErrorMsg(null);

    debounceTimerRef.current = setTimeout(() => {
      searchStops(val)
        .then((results) => {
          setStopsList(results || []);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error("Search error:", err);
          setErrorMsg("Search query failed. Please check network.");
          setIsLoading(false);
        });
    }, 300); // 300ms debounce as required
  };

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
      {/* Geolocation status / trigger header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-slate-900 uppercase">
            Select Bus Stop
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {geoStatus === "granted"
              ? "Showing bus stops nearest to your location"
              : geoStatus === "denied"
              ? "Location permission off — search your stop or area below"
              : "Find stops near you or search any corridor"}
          </p>
        </div>

        <button
          type="button"
          onClick={onRequestLocation}
          className="inline-flex items-center gap-1.5 self-start sm:self-center px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded border border-slate-300 transition-colors shadow-2xs"
          title="Use current location to find nearest stops"
        >
          {geoStatus === "prompt" ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />
              <span>Locating...</span>
            </>
          ) : (
            <>
              <Crosshair className="w-3.5 h-3.5 text-sky-600" />
              <span>Use My Location</span>
            </>
          )}
        </button>
      </div>

      {/* Dynamic Search Bar (Queries GET /stops/search?q=) */}
      <div className="mt-3 relative">
        <label htmlFor="stop-search-input" className="sr-only">
          Search bus stops
        </label>
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            id="stop-search-input"
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search by stop name or area (e.g. CMBT, Guindy, Adyar)..."
            className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-hidden focus:border-sky-600 focus:ring-1 focus:ring-sky-600 transition-colors placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => handleSearchChange({ target: { value: "" } })}
              className="absolute right-2.5 text-xs text-slate-400 hover:text-slate-700 px-1"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Geolocation fallback banner if denied */}
      {geoStatus === "denied" && (
        <div className="mt-2.5 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span>Location access is disabled in your browser. Showing popular transit hubs. Use the search bar above to jump directly to your stop.</span>
          </div>
        </div>
      )}

      {/* Stops List */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5 px-0.5">
          <span>{isSearching ? "Search Results" : "Nearby Bus Stops"}</span>
          {stopsList.length > 0 && <span>{stopsList.length} stops available</span>}
        </div>

        {isLoading ? (
          <div className="py-6 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-sky-600" />
            <span>Finding nearby bus stops...</span>
          </div>
        ) : errorMsg ? (
          <div className="py-4 px-3 bg-red-50 border border-red-200 text-red-700 rounded text-xs">
            {errorMsg}
          </div>
        ) : stopsList.length === 0 ? (
          <div className="py-6 text-center border border-dashed border-slate-200 rounded p-4 text-xs text-slate-500">
            No stops found for &ldquo;{searchQuery}&rdquo;. Try another name or area.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {stopsList.map((stop) => {
              const isSelected = selectedStop?.stop_id === stop.stop_id;
              return (
                <button
                  key={stop.stop_id}
                  type="button"
                  onClick={() => onSelectStop(stop)}
                  className={`w-full text-left p-2.5 rounded border transition-colors flex items-start justify-between gap-3 ${
                    isSelected
                      ? "border-sky-600 bg-sky-50/50"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <MapPin
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        isSelected ? "text-sky-600" : "text-slate-400"
                      }`}
                    />
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-sm font-medium truncate ${
                            isSelected ? "text-sky-950 font-semibold" : "text-slate-900"
                          }`}
                        >
                          {stop.stop_name}
                        </span>
                        {isSelected && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        )}
                      </div>
                      {stop.area && (
                        <div className="text-xs text-slate-500">{stop.area}</div>
                      )}
                      {stop.routes_served && stop.routes_served.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          <span className="text-[10px] text-slate-500 font-medium">Routes:</span>
                          {stop.routes_served.map((route) => (
                            <span
                              key={route}
                              className="text-[10px] bg-slate-100 text-slate-700 font-mono px-1 rounded border border-slate-200"
                            >
                              {route}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {stop.distance_text && (
                    <span className="shrink-0 text-xs font-mono font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                      {stop.distance_text}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
