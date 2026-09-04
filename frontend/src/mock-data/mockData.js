// Mock dataset representing FastAPI backend database & Pydantic response models
// Based on TNSTC / MTC transit corridors where ticket ETM data predicts seat availability and bus position

export const MOCK_STOPS = [
  {
    stop_id: "stop_001",
    stop_name: "Koyambedu CMBT Bus Stand",
    lat: 13.0694,
    lng: 80.1948,
    area: "Koyambedu",
    routes_served: ["153P", "570", "27B", "70V", "D70"]
  },
  {
    stop_id: "stop_002",
    stop_name: "Guindy Industrial Estate / Metro",
    lat: 13.0067,
    lng: 80.2023,
    area: "Guindy",
    routes_served: ["21G", "570", "70V", "G18", "E18"]
  },
  {
    stop_id: "stop_003",
    stop_name: "T. Nagar - Panagal Park",
    lat: 13.0405,
    lng: 80.2337,
    area: "T. Nagar",
    routes_served: ["47A", "11G", "12B", "29N", "47D"]
  },
  {
    stop_id: "stop_004",
    stop_name: "Chennai Central Railway Station",
    lat: 13.0827,
    lng: 80.2707,
    area: "Central",
    routes_served: ["11G", "21G", "18A", "A1", "17D"]
  },
  {
    stop_id: "stop_005",
    stop_name: "Adyar Bus Depot",
    lat: 13.0012,
    lng: 80.2565,
    area: "Adyar",
    routes_served: ["29C", "19B", "5E", "23C", "47D"]
  },
  {
    stop_id: "stop_006",
    stop_name: "Velachery Railway Station / Junction",
    lat: 12.9759,
    lng: 80.2212,
    area: "Velachery",
    routes_served: ["570", "570S", "119", "V51", "A51"]
  },
  {
    stop_id: "stop_007",
    stop_name: "Tambaram Sanatorium",
    lat: 12.9249,
    lng: 80.1479,
    area: "Tambaram",
    routes_served: ["70V", "G18", "119", "E18", "66"]
  },
  {
    stop_id: "stop_008",
    stop_name: "Anna Nagar Roundtana",
    lat: 13.0850,
    lng: 80.2101,
    area: "Anna Nagar",
    routes_served: ["27B", "47A", "22", "41D", "70V"]
  }
];

// Helper to calculate distance in meters (Haversine formula)
export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

// Mock approaching buses generator keyed by stop_id
export function getMockBusesForStop(stopId, baseStopCoords) {
  const centerLat = baseStopCoords?.lat || 13.0067;
  const centerLng = baseStopCoords?.lng || 80.2023;

  // Curated approaching buses with realistic positions around the stop
  const busesByStop = {
    stop_001: [
      {
        bus_id: "TN-01-N-9214",
        route_no: "570",
        destination: "Kelambakkam via OMR",
        eta_minutes: 4,
        seat_likelihood: "Seat likely",
        confidence_score: 0.91,
        last_signal_type: "ETM_DERIVED",
        last_signal_time: "20s ago",
        current_lat: centerLat - 0.007,
        current_lng: centerLng - 0.004,
        intermediate_stops_away: 2,
        ticket_sales_rate: "Low passenger load • Seats widely available",
        is_recommended: true
      },
      {
        bus_id: "TN-01-AN-4412",
        route_no: "70V",
        destination: "Tambaram West",
        eta_minutes: 9,
        seat_likelihood: "Seat uncertain",
        confidence_score: 0.74,
        last_signal_type: "GPS_LIVE",
        last_signal_time: "10s ago",
        current_lat: centerLat - 0.015,
        current_lng: centerLng + 0.005,
        intermediate_stops_away: 4,
        ticket_sales_rate: "Steady passenger boardings • Few seats remaining",
        is_recommended: false
      },
      {
        bus_id: "TN-02-N-1823",
        route_no: "27B",
        destination: "Anna Square",
        eta_minutes: 15,
        seat_likelihood: "Seat unlikely",
        confidence_score: 0.88,
        last_signal_type: "ETM_DERIVED",
        last_signal_time: "45s ago",
        current_lat: centerLat + 0.021,
        current_lng: centerLng - 0.009,
        intermediate_stops_away: 7,
        ticket_sales_rate: "High passenger load • Standing room only",
        is_recommended: false
      }
    ],
    stop_002: [
      {
        bus_id: "TN-01-N-5120",
        route_no: "21G",
        destination: "Broadway / High Court",
        eta_minutes: 3,
        seat_likelihood: "Seat likely",
        confidence_score: 0.94,
        last_signal_type: "ETM_DERIVED",
        last_signal_time: "15s ago",
        current_lat: centerLat - 0.005,
        current_lng: centerLng - 0.003,
        intermediate_stops_away: 1,
        ticket_sales_rate: "Low boarding volume • Open seats available",
        is_recommended: true
      },
      {
        bus_id: "TN-01-N-8812",
        route_no: "570",
        destination: "CMBT Koyambedu",
        eta_minutes: 7,
        seat_likelihood: "Seat uncertain",
        confidence_score: 0.68,
        last_signal_type: "GPS_LIVE",
        last_signal_time: "5s ago",
        current_lat: centerLat - 0.012,
        current_lng: centerLng + 0.004,
        intermediate_stops_away: 3,
        ticket_sales_rate: "Moderate passenger crowd • Few open seats",
        is_recommended: false
      },
      {
        bus_id: "TN-01-N-3304",
        route_no: "G18",
        destination: "T. Nagar Bus Terminus",
        eta_minutes: 12,
        seat_likelihood: "Seat unlikely",
        confidence_score: 0.82,
        last_signal_type: "ETM_DERIVED",
        last_signal_time: "30s ago",
        current_lat: centerLat - 0.018,
        current_lng: centerLng - 0.008,
        intermediate_stops_away: 5,
        ticket_sales_rate: "Heavy passenger volume • Standing room only",
        is_recommended: false
      }
    ]
  };

  if (busesByStop[stopId]) {
    return busesByStop[stopId];
  }

  // Generic approaching buses for any other selected stop
  return [
    {
      bus_id: `TN-01-N-${Math.floor(1000 + Math.random() * 9000)}`,
      route_no: "47A",
      destination: "Thiruvanmiyur via Adyar",
      eta_minutes: 3,
      seat_likelihood: "Seat likely",
      confidence_score: 0.92,
      last_signal_type: "ETM_DERIVED",
      last_signal_time: "12s ago",
      current_lat: centerLat - 0.006,
      current_lng: centerLng - 0.003,
      intermediate_stops_away: 2,
      ticket_sales_rate: "Low crowd density • High chance of seats",
      is_recommended: true
    },
    {
      bus_id: `TN-01-AN-${Math.floor(1000 + Math.random() * 9000)}`,
      route_no: "29C",
      destination: "Perambur",
      eta_minutes: 8,
      seat_likelihood: "Seat uncertain",
      confidence_score: 0.76,
      last_signal_type: "GPS_LIVE",
      last_signal_time: "8s ago",
      current_lat: centerLat - 0.014,
      current_lng: centerLng + 0.006,
      intermediate_stops_away: 4,
      ticket_sales_rate: "Moderate crowd • Seats filling steadily",
      is_recommended: false
    },
    {
      bus_id: `TN-02-N-${Math.floor(1000 + Math.random() * 9000)}`,
      route_no: "11G",
      destination: "Broadway Central",
      eta_minutes: 14,
      seat_likelihood: "Seat unlikely",
      confidence_score: 0.85,
      last_signal_type: "ETM_DERIVED",
      last_signal_time: "25s ago",
      current_lat: centerLat + 0.019,
      current_lng: centerLng - 0.007,
      intermediate_stops_away: 6,
      ticket_sales_rate: "Peak load • Standing passengers reported",
      is_recommended: false
    }
  ];
}
