/**
 * HeatGuard - Seed state for the browser-only (Calibrated Local Engine) mode.
 * When the AWS backend is reachable, rosters and the audit trail are loaded from DynamoDB instead.
 */

export { INITIAL_WORKERS } from '../../backend/src/core/sites.js';

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
    actor: 'Calibrated Local Engine',
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
    actor: 'Local Simulation (SNS offline)',
    details: 'Multilingual SMS/App broadcast simulated for 42 active workforce devices (Tamil & Hindi).',
    severity: 'info',
  },
];
