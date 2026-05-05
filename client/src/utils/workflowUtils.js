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

  // Use stageKey for reliable detection
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
