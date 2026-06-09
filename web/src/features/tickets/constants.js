export const STATUS_META = {
  NEW: { label: 'New', cls: 'bg-slate-500' },
  OPEN: { label: 'Open', cls: 'bg-blue-600' },
  IN_PROGRESS: { label: 'In Progress', cls: 'bg-amber-500' },
  ON_HOLD: { label: 'On Hold', cls: 'bg-violet-500' },
  IN_REVIEW: { label: 'In Review', cls: 'bg-cyan-500' },
  RESOLVED: { label: 'Resolved', cls: 'bg-emerald-500' },
  CLOSED: { label: 'Closed', cls: 'bg-slate-600' },
  REJECTED: { label: 'Rejected', cls: 'bg-red-600' },
  REOPENED: { label: 'Reopened', cls: 'bg-orange-500' },
};

export const PRIORITY_META = {
  LOW: { label: 'Low', cls: 'bg-emerald-50 text-emerald-700' },
  MEDIUM: { label: 'Medium', cls: 'bg-yellow-50 text-yellow-700' },
  HIGH: { label: 'High', cls: 'bg-orange-50 text-orange-600' },
  URGENT: { label: 'Urgent', cls: 'bg-red-50 text-red-600' },
};

// Mirrors the backend transition map so the UI only offers valid next statuses.
export const STATUS_TRANSITIONS = {
  NEW: ['OPEN', 'IN_PROGRESS', 'REJECTED'],
  OPEN: ['IN_PROGRESS', 'ON_HOLD', 'REJECTED'],
  IN_PROGRESS: ['ON_HOLD', 'IN_REVIEW', 'RESOLVED'],
  ON_HOLD: ['IN_PROGRESS', 'OPEN'],
  IN_REVIEW: ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['CLOSED', 'REOPENED'],
  CLOSED: ['REOPENED'],
  REJECTED: ['REOPENED'],
  REOPENED: ['IN_PROGRESS', 'OPEN'],
};

export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
export const ALL_STATUSES = Object.keys(STATUS_META);
