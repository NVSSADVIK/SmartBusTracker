import { useEffect, useRef } from "react";
import L from "leaflet";
import { Locate, Navigation, RefreshCw, Bus, User, MapPin } from "lucide-react";

export default function BusMap({
  userCoords,
  selectedStop,
  buses,
  selectedBusId,
  onSelectBus,
  wsStatus
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const onSelectBusRef = useRef(onSelectBus);
  useEffect(() => {
    onSelectBusRef.current = onSelectBus;
  }, [onSelectBus]);

  const markersRef = useRef({
    user: null,
    stop: null,
    buses: {}
  });

  // 1. Initialize Map once
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialLat = selectedStop?.lat || userCoords?.lat || 13.0827;
    const initialLng = selectedStop?.lng || userCoords?.lng || 80.2707;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 14,
      zoomControl: true
    });

    // OpenStreetMap standard clean light tiles (no API key needed)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Update User Location Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (userCoords?.lat && userCoords?.lng) {
      const userIcon = L.divIcon({
        className: "custom-user-marker",
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute w-8 h-8 bg-sky-400/40 rounded-full animate-ping pointer-events-none"></div>
            <div class="w-7 h-7 bg-sky-600 rounded-full border-2 border-white shadow-md flex items-center justify-center text-white z-10">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div class="absolute -bottom-3.5 bg-sky-900/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs whitespace-nowrap leading-none">
              You
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      if (!markersRef.current.user) {
        markersRef.current.user = L.marker([userCoords.lat, userCoords.lng], { icon: userIcon })
          .addTo(map)
          .bindPopup("<div class='text-xs font-semibold text-slate-800'>Your Current Location</div>");
      } else {
        markersRef.current.user.setLatLng([userCoords.lat, userCoords.lng]);
      }
    } else if (markersRef.current.user) {
      markersRef.current.user.remove();
      markersRef.current.user = null;
    }
  }, [userCoords?.lat, userCoords?.lng]);

  // 3. Update Selected Bus Stop Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedStop) return;

    const stopIcon = L.divIcon({
      className: "custom-stop-marker",
      html: `
        <div class="bg-amber-600 text-white p-1.5 rounded-full border-2 border-white shadow-md flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 6 2 7 10 7 12 6"/>
            <path d="m10 7 5 3 5-3"/>
            <path d="M4 6v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6"/>
            <path d="M16 17h.01"/>
            <path d="M8 17h.01"/>
          </svg>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    if (!markersRef.current.stop) {
      markersRef.current.stop = L.marker([selectedStop.lat, selectedStop.lng], { icon: stopIcon })
        .addTo(map)
        .bindPopup(`
          <div class="text-xs font-sans">
            <div class="font-bold text-slate-900">${selectedStop.stop_name}</div>
            <div class="text-slate-500 mt-0.5">Selected Waiting Stop</div>
          </div>
        `);
    } else {
      markersRef.current.stop.setLatLng([selectedStop.lat, selectedStop.lng]);
      markersRef.current.stop.setPopupContent(`
        <div class="text-xs font-sans">
          <div class="font-bold text-slate-900">${selectedStop.stop_name}</div>
          <div class="text-slate-500 mt-0.5">Selected Waiting Stop</div>
        </div>
      `);
    }

    // Pan smoothly towards stop
    map.panTo([selectedStop.lat, selectedStop.lng], { animate: true, duration: 0.6 });
  }, [selectedStop]);

  // 4. Update Live Buses Markers (Driven by WebSocket updates)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const currentBusMap = markersRef.current.buses;
    const incomingBusIds = new Set((buses || []).map((b) => b.bus_id));

    // Remove markers for buses that are no longer in approaching list
    Object.keys(currentBusMap).forEach((busId) => {
      if (!incomingBusIds.has(busId)) {
        currentBusMap[busId].remove();
        delete currentBusMap[busId];
      }
    });

    // Create or update marker for each approaching bus
    (buses || []).forEach((bus) => {
      if (!bus.current_lat || !bus.current_lng) return;

      const isSelected = selectedBusId === bus.bus_id;

      const busIcon = L.divIcon({
        className: "custom-bus-marker",
        html: `
          <div class="flex items-center gap-1.5 bg-slate-900 text-white pl-2 pr-2.5 py-1 rounded-full border-2 ${
            isSelected ? "border-amber-400 ring-2 ring-amber-400 scale-105" : "border-white"
          } shadow-md text-[11px] font-mono font-bold whitespace-nowrap cursor-pointer hover:scale-105 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
              <path d="M8 6v6"/>
              <path d="M15 6v6"/>
              <path d="M2 12h19.6"/>
              <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/>
              <circle cx="7" cy="18" r="2"/>
              <path d="M9 18h5"/>
              <circle cx="16" cy="18" r="2"/>
            </svg>
            <span>${bus.route_no}</span>
            <span class="text-[10px] font-sans font-medium text-sky-300">(${bus.eta_minutes <= 1 ? "Due" : `${bus.eta_minutes}m`})</span>
          </div>
        `,
        iconSize: [74, 28],
        iconAnchor: [37, 14]
      });

      const popupHtml = `
        <div class="text-xs font-sans">
          <div class="font-bold text-slate-900 text-sm flex items-center justify-between gap-2">
            <span class="flex items-center gap-1.5">
              <span class="bg-slate-900 text-white font-mono text-xs px-1.5 py-0.5 rounded">Route ${bus.route_no}</span>
            </span>
            <span class="font-mono text-xs font-semibold text-sky-700">${bus.eta_minutes <= 1 ? "Due now" : `${bus.eta_minutes} mins away`}</span>
          </div>
          <div class="text-slate-600 mt-1">${bus.destination}</div>
          <div class="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span class="text-slate-500">Seat prediction:</span>
            <span class="font-medium ${
              bus.seat_likelihood === "Seat likely"
                ? "text-emerald-700"
                : bus.seat_likelihood === "Seat uncertain"
                ? "text-amber-700"
                : "text-slate-700"
            }">${bus.seat_likelihood}</span>
          </div>
          <div class="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-sky-600"></span>
            <span>Signal: ${bus.last_signal_type === "ETM_DERIVED" ? "Live from conductor data" : "Live GPS signal"}</span>
          </div>
        </div>
      `;

      if (!currentBusMap[bus.bus_id]) {
        const marker = L.marker([bus.current_lat, bus.current_lng], { icon: busIcon })
          .addTo(map)
          .bindPopup(popupHtml);

        marker.on("click", () => {
          onSelectBusRef.current?.(bus);
        });

        currentBusMap[bus.bus_id] = marker;
      } else {
        // Move existing marker smoothly
        const marker = currentBusMap[bus.bus_id];
        marker.setLatLng([bus.current_lat, bus.current_lng]);
        marker.setIcon(busIcon);
        marker.setPopupContent(popupHtml);
      }
    });
  }, [buses, selectedBusId]);

  // Center on stop handler
  const handleCenterOnStop = () => {
    if (mapInstanceRef.current && selectedStop?.lat && selectedStop?.lng) {
      mapInstanceRef.current.flyTo([selectedStop.lat, selectedStop.lng], 15);
    }
  };

  // Center on user handler
  const handleCenterOnUser = () => {
    if (mapInstanceRef.current && userCoords?.lat && userCoords?.lng) {
      mapInstanceRef.current.flyTo([userCoords.lat, userCoords.lng], 15);
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs flex flex-col h-full min-h-[360px]">
      {/* Map header toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50/70">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold tracking-tight text-slate-900 uppercase">
            Live Transit Map
          </h2>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            (Live bus positions &amp; progression)
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          {userCoords && (
            <button
              type="button"
              onClick={handleCenterOnUser}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 rounded border border-slate-300 transition-colors shadow-2xs"
              title="Center map on your location"
            >
              <Locate className="w-3.5 h-3.5 text-sky-600" />
              <span>My Location</span>
            </button>
          )}

          {selectedStop && (
            <button
              type="button"
              onClick={handleCenterOnStop}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 rounded border border-slate-300 transition-colors shadow-2xs"
              title="Center map on selected bus stop"
            >
              <Navigation className="w-3.5 h-3.5 text-amber-600" />
              <span>Stop Location</span>
            </button>
          )}
        </div>
      </div>

      {/* Map display area */}
      <div className="relative flex-1 min-h-[340px] w-full">
        <div ref={mapContainerRef} className="w-full h-full min-h-[340px] z-0" />

        {/* Legend overlay in bottom left */}
        <div className="absolute bottom-3 left-3 z-10 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-lg p-2.5 text-[11px] space-y-1.5 shadow-sm">
          <div className="font-semibold text-slate-700 text-[10px] uppercase tracking-wider mb-1">
            Map Legend
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <User className="w-2.5 h-2.5" />
            </div>
            <span className="text-slate-700">Your Location</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <MapPin className="w-2.5 h-2.5" />
            </div>
            <span className="text-slate-700">Selected Stop</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-slate-900 text-sky-400 flex items-center justify-center shrink-0 shadow-2xs">
              <Bus className="w-2.5 h-2.5" />
            </div>
            <span className="text-slate-700">Approaching Bus (Route)</span>
          </div>
        </div>

        {/* Stale status overlay on map if ws is down */}
        {wsStatus === "stale" && (
          <div className="absolute top-3 right-3 z-10 bg-amber-50/95 border border-amber-300 rounded px-2.5 py-1 text-xs text-amber-800 font-medium shadow-xs flex items-center gap-1.5">
            <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
            <span>Map positions holding last known ping</span>
          </div>
        )}
      </div>
    </section>
  );
}
