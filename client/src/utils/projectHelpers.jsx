import React from 'react';
import { CheckCircle2, AlertCircle, PauseCircle, Clock, Info } from 'lucide-react';

export const getStepDisplayName = (name) => {
  const map = {
    'A&F Received': 'A&F Sanction',
    'Technical Sanction': 'Technical Sanction (TS)',
    'NIT Published': 'NIT Publication',
    'Tender Opened': 'Tender Opened',
    'Work Order Issued': 'Work Order Release',
    'DPR Submitted': 'DPR Preparation & Submission',
    'DPR Approved': 'Final DPR Approval'
  };
  return map[name] || name;
};

export const getProjectStage = (project) => {
  if (project.currentProgress >= 100) return "COMPLETED";
  const workflows = project.workflows || [];
  const hasWorkOrder = workflows.some(w => (w.stageKey === 'WORK_ORDER' || w.stepName === 'Work Order Issued') && w.value === 'Yes');
  const hasTender = workflows.some(w => (w.stageKey === 'TENDER_OPENED' || w.stepName === 'Tender Opened') && w.value === 'Yes');
  const hasDPRApp = workflows.some(w => (w.stageKey === 'DPR_APPROVED' || w.stepName === 'DPR Approved' || w.stepName === 'Final DPR Approved') && w.value === 'Yes');
  const hasDPRSub = workflows.some(w => (w.stageKey === 'DPR_SUBMITTED' || w.stepName === 'DPR Submitted' || w.stepName === 'Final DPR Submitted') && w.value === 'Yes');

  if (project.type === 'CONSULTANCY') {
    if (hasDPRApp) return "COMPLETED";
    if (hasDPRSub) return "DPR APPROVAL STAGE";
    return "DPR PREPARATION STAGE";
  }
  if (hasWorkOrder) return "EXECUTION STAGE";
  if (hasTender) return "TENDER STAGE";
  return "PRE-EXECUTION STAGE";
};

export const getCalculatedStatus = (project) => {
  if (project.currentProgress >= 100) return "Completed";
  if (project.overallStatus === 'Delay' || project.overallStatus === 'On Hold') return project.overallStatus;
  const workflows = project.workflows || [];
  const firstPending = workflows.find(w => w.value !== 'Yes' && w.value !== 'N/A');
  if (firstPending) {
    const displayName = getStepDisplayName(firstPending.stepName);
    if (firstPending.value === 'No' && firstPending.reason && firstPending.reason.trim().length > 0) return `Delayed: ${displayName}`;
    return `Pending: ${displayName}`;
  }
  return project.overallStatus || "On Track";
};

export const renderStatusBadge = (status) => {
  if (!status || status === 'On Track') {
    return (
      <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
        <CheckCircle2 size={12} /> ON TRACK
      </span>
    );
  }
  if (status === 'Delay' || status.startsWith('Delayed:')) {
    return (
      <span className="badge badge-error" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
        <AlertCircle size={12} /> {status.startsWith('Delayed:') ? status.toUpperCase() : 'DELAYED'}
      </span>
    );
  }
  if (status === 'On Hold') {
    return (
      <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
        <PauseCircle size={12} /> ON HOLD
      </span>
    );
  }
  if (status.startsWith('Pending:')) {
    return (
      <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600, background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
        <Clock size={12} /> {status.toUpperCase()}
      </span>
    );
  }
  return (
    <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
      <Info size={12} /> {status.toUpperCase()}
    </span>
  );
};
