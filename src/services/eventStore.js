/**
 * HeatGuard - Central Event Store & Real-Time Simulation Engine
 * Emulates AWS DynamoDB Single-Table State and Amazon EventBridge Audit Stream.
 */

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

// Initial audit trail
export const INITIAL_AUDIT_LOGS = [
  {
    id: 'EVT-901',
    time: '11:15:20 AM',
    type: 'ENVIRONMENT_TRIGGER',
    actor: 'Liljegren WBGT Physical Engine',
    details: 'WBGT exceeded NIOSH Table 4-1 Heavy Work Alert Limit (Calculated: 32.2°C, Limit: 28.5°C).',
    severity: 'danger',
  },
  {
    id: 'EVT-902',
    time: '11:16:04 AM',
    type: 'INTERVENTION_SYNTHESIS',
    actor: 'Amazon Bedrock Optimizer',
    details: 'Generated 3 operational mitigation strategies; recommended morning shift swap + 30m shade break.',
    severity: 'info',
  },
  {
    id: 'EVT-903',
    time: '11:20:15 AM',
    type: 'SUPERVISOR_ACTION',
    actor: 'Rajesh Murugan (Site Safety Lead)',
    details: 'Approved Option A: Shift rescheduled. Deployed 2 additional industrial cooling fans to viaduct.',
    severity: 'success',
  },
  {
    id: 'EVT-904',
    time: '11:21:00 AM',
    type: 'BROADCAST_DISPATCH',
    actor: 'AWS SNS / WhatsApp API',
    details: 'Multilingual SMS/App broadcast dispatched to 42 active workforce devices (Tamil & Hindi).',
    severity: 'info',
  },
];
