import { useState } from "react";
import {
  Sparkles,
  Radio,
  WifiOff,
  AlertTriangle,
  ChevronRight,
  X
} from "lucide-react";
import { fetchBusEta } from "../../api";

export default function BusList({
  selectedStop,
  buses,
  isLoading,
  errorMsg,
  wsStatus,
  selectedBusId,
  onSelectBus
}) {
  const [modalBusDetails, setModalBusDetails] = useState(null);

  // Helper for seat likelihood badge styling
  const renderSeatBadge = (likelihood) => {
    switch (likelihood) {
      case "Seat likely":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            Seat likely
          </span>
        );
      case "Seat uncertain":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
            Seat uncertain
          </span>
        );
      case "Seat unlikely":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
            Seat unlikely
          </span>
        );
    }
  };

  const handleOpenEtaDetails = async (e, bus) => {
    e.stopPropagation();
    if (!selectedStop) return;

    setModalBusDetails({ bus, loading: true });

    try {
      const details = await fetchBusEta(bus.bus_id, selectedStop.stop_id);
      setModalBusDetails({ bus, details, loading: false });
    } catch (err) {
      console.error("Failed to fetch detailed ETA:", err);
      setModalBusDetails({
        bus,
        details: null,
        loading: false,
        error: "Could not load detailed ETA schedule from server."
      });
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
      {/* Header with live feed indicator */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-slate-900 uppercase">
            Approaching Buses
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {selectedStop ? (
              <>At <span className="font-medium text-slate-700">{selectedStop.stop_name}</span></>
            ) : (
              "Select a bus stop to view approaching buses"
            )}
          </p>
        </div>

        {/* WebSocket live status badge */}
        <div className="flex items-center gap-1.5">
          {wsStatus === "connected" ? (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-emerald-800 bg-emerald-50 rounded border border-emerald-200"
              title="Live WebSocket feed active"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Feed
            </span>
          ) : wsStatus === "stale" ? (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-amber-800 bg-amber-50 rounded border border-amber-300"
              title="Connection dropped. Displaying last known data while reconnecting."
            >
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              Reconnecting (Stale)
            </span>
          ) : wsStatus === "connecting" ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-slate-700 bg-slate-100 rounded border border-slate-300">
              <Radio className="w-3 h-3 animate-spin text-slate-500" />
              Connecting...
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-slate-500 bg-slate-100 rounded border border-slate-200">
              <WifiOff className="w-3 h-3 text-slate-400" />
              Offline
            </span>
          )}
        </div>
      </div>

      {/* Stale warning banner when websocket drops */}
      {wsStatus === "stale" && (
        <div className="mt-2.5 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex items-center justify-between">
          <span>Live feed paused. Reconnecting to backend WebSocket... ETAs may be slightly delayed.</span>
        </div>
      )}

      {/* Main Buses List */}
      <div className="mt-3">
        {!selectedStop ? (
          <div className="py-8 text-center border border-dashed border-slate-200 rounded p-4 text-xs text-slate-500">
            Please pick a bus stop from the list above to view oncoming buses.
          </div>
        ) : isLoading ? (
          <div className="py-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-slate-300 border-t-sky-600 rounded-full animate-spin"></div>
            <span>Fetching approaching buses & conductor ETM predictions...</span>
          </div>
        ) : errorMsg ? (
          <div className="py-4 px-3 bg-red-50 border border-red-200 text-red-700 rounded text-xs">
            {errorMsg}
          </div>
        ) : buses.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-slate-200 rounded p-4 text-xs text-slate-500">
            No buses currently approaching this stop on active routes. Check back shortly.
          </div>
        ) : (
          <div className="space-y-2.5">
            {buses.map((bus) => {
              const isSelected = selectedBusId === bus.bus_id;

              return (
                <div
                  key={bus.bus_id}
                  onClick={() => onSelectBus(bus)}
                  className={`cursor-pointer rounded border p-3 transition-colors ${
                    isSelected
                      ? "border-sky-600 bg-sky-50/40"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: Route number + destination + signal metadata */}
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="shrink-0 bg-slate-900 text-white font-mono font-bold text-sm px-2 py-1 rounded min-w-14 text-center">
                        {bus.route_no}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900 truncate">
                            {bus.destination}
                          </span>
                          {bus.is_recommended && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300">
                              <Sparkles className="w-3 h-3 text-emerald-700" />
                              Recommended
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>Bus ID: <span className="font-mono text-slate-700">{bus.bus_id}</span></span>
                          <span>•</span>
                          <span
                            className={`inline-flex items-center gap-1 font-medium ${
                              bus.last_signal_type === "ETM_DERIVED"
                                ? "text-slate-700"
                                : "text-sky-700"
                            }`}
                            title={
                              bus.last_signal_type === "ETM_DERIVED"
                                ? "Position derived from conductor electronic ticket machine sales"
                                : "Position verified with onboard GPS ping"
                            }
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                            {bus.last_signal_type === "ETM_DERIVED"
                              ? "ETM Ticket Derived"
                              : "Live GPS"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: ETA & Seat Likelihood Badge */}
                    <div className="shrink-0 text-right flex flex-col items-end">
                      <div className="flex items-baseline gap-1 text-slate-900">
                        <span className="text-lg font-bold font-mono">
                          {bus.eta_minutes <= 1 ? "Due" : `${bus.eta_minutes}`}
                        </span>
                        {bus.eta_minutes > 1 && (
                          <span className="text-xs text-slate-500 font-medium">mins</span>
                        )}
                      </div>

                      <div className="mt-1">
                        {renderSeatBadge(bus.seat_likelihood)}
                      </div>
                    </div>
                  </div>

                  {/* Card footer: ETM details & trigger for deep ETA info */}
                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span className="truncate pr-2">
                      {bus.ticket_sales_rate || `Updated ${bus.last_signal_time || "live"}`}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleOpenEtaDetails(e, bus)}
                      className="inline-flex items-center gap-0.5 font-medium text-sky-700 hover:text-sky-900 transition-colors shrink-0"
                    >
                      <span>ETA breakdown</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal / Sheet for GET /buses/{bus_id}/eta?stop_id= */}
      {modalBusDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-300 rounded-lg max-w-md w-full p-4 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="bg-slate-900 text-white font-mono font-bold text-xs px-2 py-0.5 rounded">
                  {modalBusDetails.bus.route_no}
                </span>
                <h3 className="text-sm font-semibold text-slate-900">
                  ETA Breakdown & Prediction Model
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalBusDetails(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 text-xs text-slate-700 space-y-3">
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                <div className="text-[11px] uppercase font-semibold text-slate-500 mb-1">
                  How arrival & seat odds are calculated
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Government buses often lack continuous GPS tracking. Our model derives real-time bus progression and seat availability directly from conductor Electronic Ticket Machine (ETM) issuance timestamps and corridor traversal velocity.
                </p>
              </div>

              {modalBusDetails.loading ? (
                <div className="py-6 text-center text-slate-500 flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-sky-600 rounded-full animate-spin"></div>
                  <span>Querying backend ETA endpoint...</span>
                </div>
              ) : modalBusDetails.error ? (
                <div className="p-2.5 bg-red-50 text-red-700 rounded border border-red-200">
                  {modalBusDetails.error}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 border border-slate-200 rounded">
                      <div className="text-slate-500">Estimated Arrival</div>
                      <div className="font-semibold text-slate-900 text-sm mt-0.5">
                        {modalBusDetails.bus.eta_minutes} mins
                      </div>
                    </div>
                    <div className="p-2 border border-slate-200 rounded">
                      <div className="text-slate-500">Seat Status</div>
                      <div className="mt-0.5">
                        {renderSeatBadge(modalBusDetails.bus.seat_likelihood)}
                      </div>
                    </div>
                  </div>

                  {modalBusDetails.details?.intermediate_stops && (
                    <div className="border border-slate-200 rounded p-2.5">
                      <div className="font-medium text-slate-900 mb-2">
                        Approaching Stop Sequence
                      </div>
                      <div className="space-y-1.5">
                        {modalBusDetails.details.intermediate_stops.map((stp, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-[11px] text-slate-600"
                          >
                            <span className="flex items-center gap-1.5">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  stp.status === "passed"
                                    ? "bg-slate-400"
                                    : stp.status === "approaching"
                                    ? "bg-sky-600 animate-ping"
                                    : "bg-emerald-600"
                                }`}
                              ></span>
                              {stp.name}
                            </span>
                            <span className="font-mono text-slate-500">{stp.time}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-[11px] text-slate-500">
                    Confidence: <span className="font-semibold text-slate-700">{modalBusDetails.bus.confidence_score ? `${Math.round(modalBusDetails.bus.confidence_score * 100)}%` : "High"}</span>
                  </div>
                </>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setModalBusDetails(null)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
