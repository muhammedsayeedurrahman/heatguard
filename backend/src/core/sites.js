/**
 * HeatGuard - Site profiles & seed workforce rosters (isomorphic: Lambda + browser).
 * The backend seeds DynamoDB from INITIAL_WORKERS the first time a site roster is read.
 */

export const SITE_PRESETS = [
  {
    id: 'chennai-metro',
    name: 'Chennai Metro Phase II Viaduct',
    city: 'Chennai, Tamil Nadu',
    lat: 13.0827,
    lon: 80.2707,
    industry: 'Infrastructure & Construction',
    workIntensity: 'HEAVY',
    workerCount: 42,
    shift: '08:00 - 16:30',
    primaryTask: 'Steel Rebar Tying & Elevated Concrete Pouring',
    surfaceType: 'Concrete & Steel (Albedo: 0.30)',
    shadeHubs: 2,
    supervisorName: 'Rajesh Murugan (Site Safety Lead)',
    defaultLanguage: 'ta',
    baseTemp: 37,
    baseHumidity: 68,
    baseSolar: 850,
    baseWind: 2.1,
  },
  {
    id: 'delhi-logistics',
    name: 'Delhi NCR Last-Mile Delivery Fleet',
    city: 'Delhi NCR',
    lat: 28.6139,
    lon: 77.2090,
    industry: 'Gig Logistics & Couriers',
    workIntensity: 'MODERATE',
    workerCount: 85,
    shift: '10:00 - 18:00',
    primaryTask: 'Motorcycle & E-bike Urban Route Dispatches',
    surfaceType: 'Asphalt Roadway (Albedo: 0.12)',
    shadeHubs: 4,
    supervisorName: 'Vikram Sharma (Fleet Operations Manager)',
    defaultLanguage: 'hi',
    baseTemp: 41,
    baseHumidity: 32,
    baseSolar: 920,
    baseWind: 1.8,
  },
  {
    id: 'ahmedabad-sanitation',
    name: 'Ahmedabad East Municipal Sector',
    city: 'Ahmedabad, Gujarat',
    lat: 23.0225,
    lon: 72.5714,
    industry: 'Municipal Sanitation & Waste',
    workIntensity: 'MODERATE',
    workerCount: 30,
    shift: '07:30 - 15:30',
    primaryTask: 'Continuous Street Sweeping & Waste Collection',
    surfaceType: 'Pavement & Bare Soil (Albedo: 0.22)',
    shadeHubs: 3,
    supervisorName: 'Kishore Patel (Ward Supervisor)',
    defaultLanguage: 'hi',
    baseTemp: 39,
    baseHumidity: 45,
    baseSolar: 880,
    baseWind: 2.4,
  },
];

export function findSite(siteId) {
  return SITE_PRESETS.find((site) => site.id === siteId) || null;
}

// Initial seed worker rosters
export const INITIAL_WORKERS = {
  'chennai-metro': [
    { id: 'W-01', name: 'Senthil Kumar', role: 'Lead Rebar Tier', hub: 'Shade Canopy A', status: 'NOTIFIED', ackTime: null, waterGlasses: 3, emergency: false },
    { id: 'W-02', name: 'Muthu Vel', role: 'Concrete Finisher', hub: 'Shade Canopy A', status: 'ACKNOWLEDGED', ackTime: '12:14 PM', waterGlasses: 4, emergency: false },
    { id: 'W-03', name: 'Karthik Raja', role: 'Scaffolding Specialist', hub: 'Shade Canopy B', status: 'ACKNOWLEDGED', ackTime: '12:15 PM', waterGlasses: 4, emergency: false },
    { id: 'W-04', name: 'Anbu Selvan', role: 'Crane Signalman', hub: 'Shade Canopy B', status: 'RESTING_SHADE', ackTime: '12:12 PM', waterGlasses: 5, emergency: false },
    { id: 'W-05', name: 'Pravin Chandran', role: 'Formwork Carpenter', hub: 'Shade Canopy A', status: 'ACKNOWLEDGED', ackTime: '12:16 PM', waterGlasses: 3, emergency: false },
    { id: 'W-06', name: 'Gokul Nathan', role: 'Welder', hub: 'Shade Canopy B', status: 'NOTIFIED', ackTime: null, waterGlasses: 2, emergency: false },
    { id: 'W-07', name: 'Dinesh Babu', role: 'Rebar Tier', hub: 'Shade Canopy A', status: 'RESTING_SHADE', ackTime: '12:11 PM', waterGlasses: 5, emergency: false },
    { id: 'W-08', name: 'Saravanan M.', role: 'Heavy Equipment Operator', hub: 'AC Cabin', status: 'ACKNOWLEDGED', ackTime: '12:13 PM', waterGlasses: 4, emergency: false },
    { id: 'W-09', name: 'Vijay Anand', role: 'Mason', hub: 'Shade Canopy A', status: 'ACKNOWLEDGED', ackTime: '12:17 PM', waterGlasses: 3, emergency: false },
    { id: 'W-10', name: 'Ravi Shankar', role: 'Site Rigger', hub: 'Shade Canopy B', status: 'NOTIFIED', ackTime: null, waterGlasses: 3, emergency: false },
    { id: 'W-11', name: 'Manikandan P.', role: 'Safety Marshal', hub: 'Shade Canopy A', status: 'RESTING_SHADE', ackTime: '12:10 PM', waterGlasses: 6, emergency: false },
    { id: 'W-12', name: 'Balamurugan K.', role: 'Concrete Vibrator Op.', hub: 'Shade Canopy B', status: 'ACKNOWLEDGED', ackTime: '12:16 PM', waterGlasses: 4, emergency: false },
  ],
  'delhi-logistics': [
    { id: 'D-01', name: 'Amit Verma', role: 'Priority Bike Courier', hub: 'Sector 18 AC Station', status: 'ACKNOWLEDGED', ackTime: '13:02 PM', waterGlasses: 4, emergency: false },
    { id: 'D-02', name: 'Deepak Yadav', role: 'E-Bike Delivery Agent', hub: 'Metro Plaza Shade Hub', status: 'RESTING_SHADE', ackTime: '13:05 PM', waterGlasses: 5, emergency: false },
    { id: 'D-03', name: 'Rohit Sharma', role: 'Van Express Courier', hub: 'Depot 3', status: 'ACKNOWLEDGED', ackTime: '13:08 PM', waterGlasses: 3, emergency: false },
    { id: 'D-04', name: 'Sunil Kumar', role: 'Two-Wheeler Dispatch', hub: 'Sector 62 Shade Point', status: 'NOTIFIED', ackTime: null, waterGlasses: 2, emergency: false },
    { id: 'D-05', name: 'Sonu Prajapati', role: 'Two-Wheeler Dispatch', hub: 'Sector 18 AC Station', status: 'ACKNOWLEDGED', ackTime: '13:04 PM', waterGlasses: 4, emergency: false },
  ],
  'ahmedabad-sanitation': [
    { id: 'A-01', name: 'Ramesh Vaghela', role: 'Street Sweeping Lead', hub: 'Ward 4 Community Shade', status: 'RESTING_SHADE', ackTime: '12:30 PM', waterGlasses: 5, emergency: false },
    { id: 'A-02', name: 'Pooja Solanki', role: 'Waste Segregator', hub: 'Ward 4 Community Shade', status: 'ACKNOWLEDGED', ackTime: '12:32 PM', waterGlasses: 4, emergency: false },
    { id: 'A-03', name: 'Hitesh Makwana', role: 'Compactor Truck Loader', hub: 'Municipal Depot Tent', status: 'ACKNOWLEDGED', ackTime: '12:33 PM', waterGlasses: 4, emergency: false },
    { id: 'A-04', name: 'Geeta Parmar', role: 'Sanitation Worker', hub: 'Ward 4 Community Shade', status: 'NOTIFIED', ackTime: null, waterGlasses: 3, emergency: false },
  ],
};
