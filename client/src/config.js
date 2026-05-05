export const CONFIG = {
  API_BASE_URL: window.location.hostname === 'localhost' ? 'http://localhost:5000' : window.location.origin,
  STORAGE_KEY: 'kda_user',
  DEFAULT_AGENCY: 'KDA',
  STATUS_LABELS: {
    ON_TRACK: 'On Track',
    DELAY: 'Delay',
    ON_HOLD: 'On Hold',
    COMPLETED: 'COMPLETED'
  },
  FUNDING_AGENCIES: ['KDA', 'Any other'],
  PROJECT_TYPES: ['EXECUTION', 'CONSULTANCY'],
  DATE_FORMAT: 'en-GB',
  GEO_TIMEOUT: 500
};
