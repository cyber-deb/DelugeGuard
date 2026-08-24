/* ============================================================
   SROTO — Kolkata location graph
   Approximate real-world coordinates for well-known Kolkata
   areas, connected by an illustrative road graph. Locations
   noted as "lowLying: true" get a higher baseline blockage
   value when a scenario is generated, reflecting real-world
   flood-prone pockets of the city.
   ============================================================ */

const LOCATIONS = [
  { id: "esplanade",  name: "Esplanade",           lat: 22.5675, lng: 88.3520, lowLying: false },
  { id: "parkstreet",  name: "Park Street",         lat: 22.5535, lng: 88.3540, lowLying: false },
  { id: "maidan",      name: "Maidan",              lat: 22.5550, lng: 88.3420, lowLying: false },
  { id: "sealdah",     name: "Sealdah",             lat: 22.5675, lng: 88.3707, lowLying: true  },
  { id: "shyambazar",  name: "Shyambazar",          lat: 22.5990, lng: 88.3730, lowLying: false },
  { id: "howrah",      name: "Howrah",              lat: 22.5804, lng: 88.3299, lowLying: true  },
  { id: "kidderpore",  name: "Kidderpore",          lat: 22.5390, lng: 88.3200, lowLying: true  },
  { id: "ballygunge",  name: "Ballygunge",          lat: 22.5330, lng: 88.3660, lowLying: false },
  { id: "gariahat",    name: "Gariahat",            lat: 22.5185, lng: 88.3660, lowLying: false },
  { id: "jadavpur",    name: "Jadavpur",            lat: 22.4990, lng: 88.3710, lowLying: false },
  { id: "tollygunge",  name: "Tollygunge",          lat: 22.4990, lng: 88.3430, lowLying: true  },
  { id: "behala",      name: "Behala",              lat: 22.4990, lng: 88.3130, lowLying: true  },
  { id: "garia",       name: "Garia",               lat: 22.4630, lng: 88.3930, lowLying: false },
  { id: "saltlake",    name: "Salt Lake Sector V",  lat: 22.5760, lng: 88.4310, lowLying: false },
  { id: "newtown",     name: "New Town",            lat: 22.5850, lng: 88.4640, lowLying: false },
  { id: "rajarhat",    name: "Rajarhat",            lat: 22.6160, lng: 88.4630, lowLying: false },
  { id: "dumdum",      name: "Dum Dum",             lat: 22.6420, lng: 88.4200, lowLying: false },
  { id: "barasat",     name: "Barasat",             lat: 22.7250, lng: 88.4790, lowLying: false }
];

/* Edges are undirected. Distance is computed at runtime with
   the haversine formula, so we only need to declare which
   locations are actually road-connected. */
const EDGES = [
  ["esplanade", "parkstreet"],
  ["esplanade", "maidan"],
  ["esplanade", "sealdah"],
  ["esplanade", "howrah"],
  ["parkstreet", "maidan"],
  ["parkstreet", "ballygunge"],
  ["parkstreet", "kidderpore"],
  ["maidan", "kidderpore"],
  ["sealdah", "shyambazar"],
  ["sealdah", "saltlake"],
  ["shyambazar", "dumdum"],
  ["dumdum", "rajarhat"],
  ["dumdum", "barasat"],
  ["rajarhat", "newtown"],
  ["saltlake", "newtown"],
  ["saltlake", "ballygunge"],
  ["ballygunge", "gariahat"],
  ["gariahat", "jadavpur"],
  ["gariahat", "tollygunge"],
  ["jadavpur", "garia"],
  ["tollygunge", "garia"],
  ["tollygunge", "behala"],
  ["kidderpore", "behala"],
  ["howrah", "behala"]
];
