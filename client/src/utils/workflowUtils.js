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

export const getCalculatedStatus = (project) => {
  if (project.currentProgress >= 100) return "Completed";
  
  // High priority: Explicitly set overrides
  if (project.overallStatus === 'Delay' || project.overallStatus === 'On Hold') {
    return project.overallStatus;
  }

  const workflows = project.workflows || [];
  
  // Find first milestone not completed ("Yes")
  const firstPending = workflows.find(w => w.value !== 'Yes' && w.value !== 'N/A');
  
  if (firstPending) {
    const displayName = getStepDisplayName(firstPending.stepName);
    // If user explicitly marked as "No" AND provided a reason, it's a known delay
    if (firstPending.value === 'No' && firstPending.reason && firstPending.reason.trim().length > 0) {
      return `Delayed: ${displayName}`;
    }
    // Otherwise it's just the next thing to be done (Pending)
    return `Pending: ${displayName}`;
  }

  // Fallback for execution phase (when all milestones are done but project is ongoing)
  return project.overallStatus || "On Track";
};

export const MILESTONE_SEQUENCE = [
  'AF_SANCTION', 
  'TECH_SANCTION', 
  'NIT_PUBLISHED', 
  'TENDER_OPENED', 
  'WORK_ORDER', 
  'DRAFT_DPR_SUBMITTED', 
  'DRAFT_DPR_APPROVED', 
  'FINAL_DPR_SUBMITTED', 
  'FINAL_DPR_APPROVED',
  'DPR_SUBMITTED', 
  'DPR_APPROVED'
];

export const MILESTONE_NAME_MAP = {
  'A&F Sanction': 'AF_SANCTION',
  'A&F Received': 'AF_SANCTION',
  'Technical Sanction': 'TECH_SANCTION',
  'Technical Sanction (TS)': 'TECH_SANCTION',
  'NIT Published': 'NIT_PUBLISHED',
  'NIT Publication': 'NIT_PUBLISHED',
  'Tender Opened': 'TENDER_OPENED',
  'Work Order Issued': 'WORK_ORDER',
  'Work Order Release': 'WORK_ORDER',
  'Draft DPR Submitted': 'DRAFT_DPR_SUBMITTED',
  'Draft DPR Approved': 'DRAFT_DPR_APPROVED',
  'Final DPR Submitted': 'FINAL_DPR_SUBMITTED',
  'Final DPR Approved': 'FINAL_DPR_APPROVED',
  'DPR Submitted': 'DPR_SUBMITTED',
  'DPR Approved': 'DPR_APPROVED'
};

export const sortWorkflows = (workflows) => {
  if (!workflows) return [];
  return [...workflows].sort((a, b) => {
    const keyA = a.stageKey || MILESTONE_NAME_MAP[a.stepName];
    const keyB = b.stageKey || MILESTONE_NAME_MAP[b.stepName];
    
    const idxA = MILESTONE_SEQUENCE.indexOf(keyA);
    const idxB = MILESTONE_SEQUENCE.indexOf(keyB);
    
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return 0;
  });
};
