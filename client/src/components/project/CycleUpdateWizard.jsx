import React, { useState, useEffect, useContext, useRef } from 'react';
import { X, Calendar, MapPin, Camera, Info, CheckCircle2, Map as MapIcon, Zap, ShieldAlert, FileCheck, Gavel, MoreHorizontal } from 'lucide-react';
import { api } from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import {
  formatDate,
  formatDateForInput,
  normalizeDate
} from '../../utils/dateUtils';
import {
  sanitizeProjectInput,
  sanitizeName,
  sanitizeMobile,
  blockInvalidNumberKeys,
  validateProjectText,
  validateMobile
} from '../../utils/validation';
import { getStepDisplayName, sortWorkflows, MILESTONE_NAME_MAP, MILESTONE_SEQUENCE } from '../../utils/workflowUtils';
import LiveCameraModal from './LiveCameraModal';
import { YesNoToggle, StatusToggle } from '../common/UIHelpers';

// Helper to convert file to base64
const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = error => reject(error);
});

export default function CycleUpdateWizard({ project, userId, userRole, onClose, onSuccess }) {
  const { user } = useContext(AuthContext);
  // Logic to determine initial step based on handover
  const [config, setConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await api.get(`/projects/${project.id}/config`);
        setConfig(res.data);
      } catch (err) {
        console.error("Config fetch error:", err);
      } finally {
        setLoadingConfig(false);
      }
    };
    fetchConfig();
  }, [project.id]);

  const [step, setStep] = useState(1); // Default to 1, will adjust after config load

  useEffect(() => {
    if (config) {
      // Adjust initial step based on config
      const isWorkOrderDone = (project.workflows || []).some(w => (w.stepName === 'Work Order Issued' || w.stageKey === 'WORK_ORDER') && w.isCompleted);
      const firstIncompleteIdx = workflowUpdates.findIndex(w => !w.isCompleted);

      if (userRole === 'ADMIN' && project.currentProgress >= 100) setStep(1);
      else if (firstIncompleteIdx !== -1) setStep(2);
      else if (project.type === 'EXECUTION' && isWorkOrderDone && project.currentProgress < 100) setStep(3);
      else setStep(4);
    }
  }, [config]);
  const [load, setLoad] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  // State for Step 1: Master Field Updates
  const [masterFields, setMasterFields] = useState({
    name: project.name,
    brief: project.brief || '',
    estimatedCost: project.estimatedCost,
    fundingAgency: project.fundingAgency,
    inchargeName: project.inchargeName,
    inchargeMobile: project.inchargeMobile,
    consultantName: project.consultantName || '',
    consultantMobile: project.consultantMobile || '',
    contractorName: project.contractorName || '',
    contractorMobile: project.contractorMobile || '',
    workStarted: project.workStarted || 'No',
    delayReasons: (() => {
      try {
        if (!project.delayReasons) return [];
        if (typeof project.delayReasons === 'string' && (project.delayReasons.startsWith('[') || project.delayReasons.startsWith('{'))) {
          return JSON.parse(project.delayReasons);
        }
        return [project.delayReasons];
      } catch (e) { return []; }
    })(),
    delayBrief: project.delayBrief || '',
    fieldData: (() => {
      try {
        return project.fieldData ? JSON.parse(project.fieldData) : {};
      } catch (e) { return {}; }
    })()
  });

  const [workflowUpdates, setWorkflowUpdates] = useState(() => {
    // 0. Deduplicate existing workflows by stageKey (keep latest)
    const workflowMap = new Map();
    (project.workflows || []).forEach(item => {
      const key = item.stageKey || item.stepName;
      if (!workflowMap.has(key) || (item.id && !workflowMap.get(key).id)) {
        workflowMap.set(key, item);
      }
    });

    let w = Array.from(workflowMap.values()).map(item => {
      // Sync milestone date with project master dates if missing
      let date = item.date;
      if (item.stepName === 'Work Order Issued' && !date && project.actualStartDate) {
        date = project.actualStartDate;
      }
      return { ...item, date: date || '', reason: item.reason || '', value: item.value || 'No' };
    });

    // 1. NIT/Tender Opened Migration for existing projects
    const hasNIT = w.some(item => {
      const key = item.stageKey || MILESTONE_NAME_MAP[item.stepName];
      return key === 'NIT_PUBLISHED';
    });
    const isSingleSource = project.type === 'CONSULTANCY' && project.consultancySource === 'SINGLE_SOURCE';

    if (!hasNIT && !isSingleSource) {
      const oldIdx = w.findIndex(item => {
        const key = item.stageKey || MILESTONE_NAME_MAP[item.stepName];
        return key === 'TENDER_OPENED' || item.stepName === 'Tender Processed';
      });
      
      const nit = { stageKey: 'NIT_PUBLISHED', stepName: 'NIT Published', isCompleted: false, value: 'No', reason: '', date: '' };
      const opened = { stageKey: 'TENDER_OPENED', stepName: 'Tender Opened', isCompleted: false, value: 'No', reason: '', date: '' };

      if (oldIdx !== -1) {
        // Replace old "Tender Processed" or sync Tender Opened
        w.splice(oldIdx, 1, nit, opened);
      } else {
        // Insert before "Work Order Issued"
        const woIdx = w.findIndex(item => {
          const key = item.stageKey || MILESTONE_NAME_MAP[item.stepName];
          return key === 'WORK_ORDER';
        });
        if (woIdx !== -1) w.splice(woIdx, 0, nit, opened);
        else w.push(nit, opened);
      }
    }

    // 2. Consultancy DPR Granularity Migration
    if (project.type === 'CONSULTANCY') {
      // Remove legacy/irrelevant steps
      const obsolete = ['DPR Submitted', 'DPR Approved', 'Technical Sanction'];
      w = w.filter(item => !obsolete.includes(item.stepName));

      // Ensure granular steps exist
      const granular = ['Draft DPR Submitted', 'Draft DPR Approved', 'Final DPR Submitted', 'Final DPR Approved'];
      for (const s of granular) {
        if (!w.some(item => item.stepName === s)) {
          w.push({ stepName: s, isCompleted: false, value: 'No', reason: '', date: '' });
        }
      }
    }
    return sortWorkflows(w);
  });

  // Re-sync workflowUpdates when config loads to ensure display names and stageKeys match
  useEffect(() => {
    if (config && config.stages) {
      setWorkflowUpdates(prev => {
        // 1. Start with a map of existing (prev) milestones for quick lookup
        const prevMap = new Map();
        prev.forEach(p => {
          const key = p.stageKey || p.stepName;
          prevMap.set(key, p);
        });

        // 2. Map over config.stages to update/add from dynamic config
        const fromConfig = config.stages.map(stage => {
          const existing = prevMap.get(stage.stageKey) || prevMap.get(stage.displayName);
          prevMap.delete(stage.stageKey); // Mark as handled
          prevMap.delete(stage.displayName);
          
          return {
            id: existing?.id,
            stageKey: stage.stageKey,
            stepName: stage.displayName,
            isCompleted: existing?.isCompleted || false,
            value: existing?.value || 'No',
            reason: existing?.reason || '',
            date: existing?.date || ''
          };
        });

        // 3. Keep existing milestones that were NOT in config but ARE in our MILESTONE_SEQUENCE
        // (This preserves migrated milestones like Tech/Fin Evaluation if missing from DB config)
        const preserved = Array.from(prevMap.values()).filter(p => {
          const key = p.stageKey || p.stepName;
          return MILESTONE_SEQUENCE.includes(key) || 
                 Object.values(MILESTONE_NAME_MAP).includes(key) ||
                 MILESTONE_NAME_MAP[p.stepName];
        });

        const combined = [...fromConfig, ...preserved];
        return sortWorkflows(combined);
      });
    }
  }, [config]);

  const [pertUpdates, setPertUpdates] = useState(((project.pertActivities || [])).map(p => ({
    id: p.id,
    name: p.name,
    weightage: p.weightage,
    progress: p.progress,
    startDate: p.startDate,
    endDate: p.endDate
  })));

  const [statusUpdate, setStatusUpdate] = useState({
    physicalProgress: project.currentProgress,
    financialProgress: 0,
    remarks: '',
    gpsLat: null,
    gpsLong: null,
    photos: [],
    actualStartDate: project.actualStartDate || '',
    stipulatedCompletionDate: project.stipulatedCompletionDate || '',
    overallStatus: project.overallStatus || '',
    statusHoldReason: project.statusHoldReason || '',
    statusDelayReasons: (() => {
      try {
        if (!project.statusDelayReasons) return [];
        if (typeof project.statusDelayReasons === 'string' && (project.statusDelayReasons.startsWith('[') || project.statusDelayReasons.startsWith('{'))) {
          return JSON.parse(project.statusDelayReasons);
        }
        if (Array.isArray(project.statusDelayReasons)) return project.statusDelayReasons;
        return [project.statusDelayReasons];
      } catch (e) {
        return [project.statusDelayReasons];
      }
    })(),
    statusDelayBrief: project.statusDelayBrief || '',
    todaysUpdateNote: project.todaysUpdateNote || '',
    expectedCompletionDate: project.expectedCompletionDate || '',
    timeExtension: project.timeExtension || '',
    contractorName: project.contractorName || '',
    contractorMobile: project.contractorMobile || '',
    consultantName: project.consultantName || '',
    consultantMobile: project.consultantMobile || '',
    qualitySampling: project.qualitySampling || 'No',
    qualitySamplingReason: project.qualitySamplingReason || '',
    fieldData: (() => {
      try {
        return JSON.parse(project.fieldData || '{}');
      } catch (e) {
        return {};
      }
    })()
  });

  const captureGPS = () => {
    navigator.geolocation.getCurrentPosition((pos) => {
      setStatusUpdate({ ...statusUpdate, gpsLat: pos.coords.latitude, gpsLong: pos.coords.longitude });
    });
  };

  const calculateOverallProgress = (uPert) => {
    return uPert.reduce((sum, p) => sum + (parseFloat(p.progress || 0) * (parseFloat(p.weightage || 0) / 100)), 0).toFixed(1);
  };

  const renderDynamicFields = (location) => {
    const fields = (config?.fields || []).filter(f => f.location === location && f.isActive);
    if (fields.length === 0) return null;

    return fields.sort((a, b) => a.sequenceOrder - b.sequenceOrder).map(field => (
      <div key={field.fieldKey} className="input-group fade-in" style={{ marginBottom: '1.5rem' }}>
        <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
          {field.displayName} {field.isRequired && <span style={{ color: 'var(--error)' }}>*</span>}
        </label>
        {field.fieldType === 'select' ? (
          <YesNoToggle
            value={statusUpdate.fieldData[field.fieldKey] || 'No'}
            onChange={val => setStatusUpdate(prev => ({
              ...prev,
              fieldData: { ...prev.fieldData, [field.fieldKey]: val }
            }))}
          />
        ) : field.fieldType === 'date' ? (
          <input
            type="date"
            value={statusUpdate.fieldData[field.fieldKey] || ''}
            onChange={e => setStatusUpdate(prev => ({
              ...prev,
              fieldData: { ...prev.fieldData, [field.fieldKey]: e.target.value }
            }))}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
          />
        ) : (
          <input
            type={field.fieldType === 'number' ? 'number' : 'text'}
            value={statusUpdate.fieldData[field.fieldKey] || ''}
            placeholder={`Enter ${field.displayName.toLowerCase()}...`}
            onChange={e => setStatusUpdate(prev => ({
              ...prev,
              fieldData: { ...prev.fieldData, [field.fieldKey]: e.target.value }
            }))}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
          />
        )}
      </div>
    ));
  };

  const validateDates = (updatedWorkflows) => {
    const sorted = sortWorkflows(updatedWorkflows);
    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      if (project.type === 'CONSULTANCY' && current.stepName === 'Technical Sanction') continue;
      const isSingleSource = project.type === 'CONSULTANCY' && project.consultancySource === 'SINGLE_SOURCE';
      if (isSingleSource && ['NIT Published', 'Tender Opened'].includes(current.stepName)) continue;

      if (current.value === 'Yes' && current.date) {
        // 1. Backward check (against predecessors)
        for (let j = i - 1; j >= 0; j--) {
          const prev = sorted[j];
          if (project.type === 'CONSULTANCY' && prev.stepName === 'Technical Sanction') continue;
          if (isSingleSource && ['NIT Published', 'Tender Opened'].includes(prev.stepName)) continue;
          if (prev.value === 'Yes' && prev.date) {
            const dCurrent = normalizeDate(current.date);
            const dPrev = normalizeDate(prev.date);
            if (dCurrent && dPrev && dCurrent < dPrev) {
              alert(`Date Conflict: "${getStepDisplayName(current.stepName)}" (${dCurrent}) cannot be before "${getStepDisplayName(prev.stepName)}" (${dPrev}).`);
              return false;
            }
            break;
          }
        }
        // 2. Forward check (against successors)
        for (let k = i + 1; k < sorted.length; k++) {
          const nextStep = sorted[k];
          if (project.type === 'CONSULTANCY' && nextStep.stepName === 'Technical Sanction') continue;
          if (isSingleSource && ['NIT Published', 'Tender Opened'].includes(nextStep.stepName)) continue;
          if (nextStep.value === 'Yes' && nextStep.date) {
            const dCurrent = normalizeDate(current.date);
            const dNext = normalizeDate(nextStep.date);
            if (dCurrent && dNext && dCurrent > dNext) {
              alert(`Date Conflict: "${getStepDisplayName(current.stepName)}" (${dCurrent}) cannot be after "${getStepDisplayName(nextStep.stepName)}" (${dNext}).`);
              return false;
            }
            break;
          }
        }
      }
    }
    return true;
  };

  const validateWorkStarted = () => {
    if ((userRole === 'DEO' || userRole === 'ADMIN') && masterFields.workStarted === 'No') {
      if (!masterFields.delayReasons || masterFields.delayReasons.length === 0) {
        alert("Mandatory: Please select at least one 'Reason for Delay' because work has not started at site.");
        return false;
      }
      if (!masterFields.delayBrief || masterFields.delayBrief.trim().length < 5) {
        alert("Mandatory: Please provide a 'Brief Reason for Delay' (min. 5 characters) because work has not started at site.");
        return false;
      }
    }
    return true;
  };

  const handleFinalSubmit = async (isQuickSave = false) => {
    if (!validateWorkStarted()) return;
    setLoad(true);
    const isFinalStage = step === 6;
    const isConsultancyDone = project.type === 'CONSULTANCY' && workflowUpdates.every(w => w.value === 'Yes');

    // 1. STRICT VALIDATION: Check for empty reasons in ACTIVE milestones only
    let activeIdx = -1;
    for (let i = 0; i < workflowUpdates.length; i++) {
      if (project.type === 'CONSULTANCY' && workflowUpdates[i].stepName === 'Technical Sanction') continue;
      if (workflowUpdates[i].value === 'No') {
        activeIdx = i;
        break; // Only the FIRST 'No' matters for current block
      }
    }

    if (!isQuickSave && activeIdx !== -1) {
      const current = workflowUpdates[activeIdx];
      if (!current.reason || current.reason.trim().length < 5) {
        window.alert(`Dhyan dein: "${getStepDisplayName(current.stepName)}" ke liye Reason for Delay mention karna anivarya hai.`);
        setLoad(false);
        return; // BLOCK SUBMISSION
      }
    }

    // 2. PROGRESS REGRESSION CHECK
    if (statusUpdate.physicalProgress < project.currentProgress) {
      window.alert(`Progress Violation: Nayi progress (${statusUpdate.physicalProgress}%) pichli record ki gayi progress (${project.currentProgress}%) se kam nahi ho sakti.`);
      return;
    }

    // 3. STATUS vs MILESTONE CONSISTENCY
    if (statusUpdate.overallStatus === 'COMPLETED') {
      const isWorkStarted = project.workStarted === 'Yes';
      const hasWorkOrder = project.workflows?.some(w => w.stepName === 'Work Order Issued' && w.value === 'Yes');
      if (!isWorkStarted || !hasWorkOrder) {
        window.alert("Completion Blocked: Project ko COMPLETED nahi mark kiya ja sakta jab tak Work Order Issue na ho aur Work Start na ho.");
        return;
      }
    }

    const hasEvidenceRights = userRole === 'ENGINEER' || userRole === 'DEO';
    // STRICT RULE: No bypass for progress updates (Step 6)
    const isProgressUpdate = isFinalStage || isConsultancyDone;

    if (isProgressUpdate && hasEvidenceRights) {
      if (statusUpdate.photos.length < 1) { window.alert('Submission Blocked: At least 1 site photo is mandatory for engineering evidence.'); return; }
      if (statusUpdate.gpsLat === null || statusUpdate.gpsLat === undefined) { window.alert('Submission Blocked: GPS location capture is mandatory for site updates.'); return; }
      if (!statusUpdate.remarks || statusUpdate.remarks.trim().length < 2) { window.alert('Submission Blocked: Please enter brief engineering observations.'); return; }
    }

    // 2. CHRONOLOGICAL DATE VALIDATION: Ensure no prior date for next stage
    if (!validateDates(workflowUpdates)) {
      setLoad(false);
      return;
    }

    // 2.1 EXECUTION TIMELINE VALIDATION
    const finalStart = statusUpdate.actualStartDate || project.actualStartDate;
    const finalCompletion = statusUpdate.stipulatedCompletionDate || project.stipulatedCompletionDate;
    if (finalStart && finalCompletion && new Date(finalCompletion) < new Date(finalStart)) {
      window.alert('Timeline Conflict: Stipulated Completion Date cannot be earlier than Work Start Date.');
      setLoad(false);
      return;
    }

    let finalStatusUpdate = { ...statusUpdate };
    if (project.type === 'CONSULTANCY') {
      const dprSub = workflowUpdates.find(w => w.stepName === 'DPR Submitted');
      const dprApp = workflowUpdates.find(w => w.stepName === 'DPR Approved');

      if (dprApp?.value === 'Yes') {
        finalStatusUpdate.todaysUpdateNote = "DPR Approved. Project Lifecycle Completed.";
        finalStatusUpdate.physicalProgress = 100;
        finalStatusUpdate.financialProgress = 100;
        finalStatusUpdate.overallStatus = 'On Track';
      } else if (dprApp?.value === 'No' && dprSub?.value === 'Yes') {
        finalStatusUpdate.todaysUpdateNote = "DPR Pending to be approved. Reason: " + (dprApp.reason || 'Not specified');
        finalStatusUpdate.overallStatus = 'Delay';
      } else if (dprSub?.value === 'No') {
        finalStatusUpdate.todaysUpdateNote = "DPR Pending to be submitted. Reason: " + (dprSub.reason || 'Not specified');
        finalStatusUpdate.overallStatus = 'Delay';
      }
    }

    // 4. Character Validation for Master Updates
    if (userRole === 'DEO' || userRole === 'ADMIN') {
      if (!validateProjectText(masterFields.name, 'Project Name')) return;
      if (!validateProjectText(masterFields.brief, 'Project Description')) return;
      if (!validateProjectText(masterFields.fundingAgency, 'Funding Agency')) return;
      if (!validateProjectText(masterFields.inchargeName, 'Incharge Name')) return;
      if (!validateProjectText(masterFields.consultantName, 'Consultant Name')) return;
      if (!validateProjectText(masterFields.contractorName, 'Contractor Name')) return;
    }

    try {
      // Process photos to Base64 before sending (ONLY for authorized roles)
      let base64Photos = statusUpdate.photos;
      if (userRole === 'ENGINEER' || userRole === 'DEO') {
        base64Photos = await Promise.all(statusUpdate.photos.map(p => {
          if (typeof p === 'string') return p; // Already uploaded/base64
          return fileToBase64(p);
        }));
      }

      await api.post(`/projects/${project.id}/cycle-update`, {
        userId: parseInt(userId),
        projectMasterUpdates: (userRole === 'DEO' || userRole === 'ADMIN') ? {
          ...masterFields,
          delayReasons: JSON.stringify(masterFields.delayReasons || []),
          fieldData: JSON.stringify(masterFields.fieldData)
        } : null,
        workflowUpdates: workflowUpdates.map(w => ({
          id: w.id,
          stageKey: w.stageKey, // Strictly ensure stageKey is passed
          stepName: w.stepName,
          isCompleted: w.isCompleted,
          value: w.value,
          date: w.date,
          reason: w.reason
        })),
        pertUpdates: project.type === 'EXECUTION' ? pertUpdates.map(p => ({ id: p.id, progress: p.progress })) : [],
        statusUpdate: {
          ...finalStatusUpdate,
          fieldData: JSON.stringify(statusUpdate.fieldData),
          photos: base64Photos,
          isProgressUpdate: isFinalStage || isConsultancyDone
        }
      });
      setSubmitted(true); // Switch to acknowledgment screen
    } catch (err) {
      alert(err.message || 'Update failed - Please check all mandatory fields and connection.');
    } finally {
      setLoad(false);
    }
  };

  const renderStep1 = () => (
    <div className="fade-in">
      <h4>Step 1: Project Master Review</h4>
      <div className="glass-card" style={{ background: 'rgba(0,0,0,0.1)', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {userRole === 'DEO' || userRole === 'ADMIN' ? (
          <>
            <div className="input-group">
              <label>Project Name</label>
              <input value={masterFields.name} onChange={e => setMasterFields({ ...masterFields, name: sanitizeProjectInput(e.target.value) })} placeholder="Project name" />
            </div>
            <div className="input-group">
              <label>Project Brief Description</label>
              <textarea
                value={masterFields.brief}
                onChange={e => setMasterFields({ ...masterFields, brief: sanitizeProjectInput(e.target.value) })}
                style={{ minHeight: '80px', padding: '0.75rem', fontSize: '0.9rem' }}
                placeholder="Brief description..."
              />
            </div>
            <div className="responsive-input-grid">
              <div className="input-group">
                <label>Estimated Cost (Lakhs)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  onKeyDown={blockInvalidNumberKeys}
                  value={masterFields.estimatedCost}
                  onChange={e => {
                    const val = e.target.value;
                    setMasterFields({ ...masterFields, estimatedCost: val === '' ? '' : Math.max(0, parseFloat(val) || 0) });
                  }}
                  placeholder="Enter amount"
                />
              </div>
              <div className="input-group">
                <label>Funding Agency</label>
                <input value={masterFields.fundingAgency} onChange={e => setMasterFields({ ...masterFields, fundingAgency: sanitizeProjectInput(e.target.value) })} />
              </div>
            </div>

            <div className="responsive-input-grid">
              <div className="input-group">
                <label>Executive Engineer</label>
                <input value={masterFields.inchargeName} onChange={e => setMasterFields({ ...masterFields, inchargeName: sanitizeName(e.target.value) })} />
              </div>
              <div className="input-group">
                <label>Executive Engineer Mobile</label>
                <input value={masterFields.inchargeMobile} onChange={e => setMasterFields({ ...masterFields, inchargeMobile: sanitizeMobile(e.target.value) })} maxLength={10} />
              </div>
            </div>

            {project.type === 'EXECUTION' && (
              <>
                <div className="responsive-input-grid">
                  <div className="input-group">
                    <label>Consultant Name</label>
                    <input value={masterFields.consultantName} onChange={e => setMasterFields({ ...masterFields, consultantName: sanitizeName(e.target.value) })} />
                  </div>
                  <div className="input-group">
                    <label>Consultant Mobile</label>
                    <input value={masterFields.consultantMobile} onChange={e => setMasterFields({ ...masterFields, consultantMobile: sanitizeMobile(e.target.value) })} maxLength={10} />
                  </div>
                </div>
              </>
            )}

            {/* Work Started toggle: only shown when it's not already 'Yes' and Work Order has NOT yet been issued */}
            {masterFields.workStarted !== 'Yes' && (
              <div className="glass-card" style={{ background: 'rgba(255,255,255,0.03)', marginTop: '0.5rem', padding: '1rem' }}>
                <YesNoToggle
                  label="Has Project Work Officially Started at Site?"
                  value={masterFields.workStarted || 'No'}
                  onChange={val => setMasterFields({ ...masterFields, workStarted: val })}
                />

                {masterFields.workStarted === 'No' && (
                  <div style={{ marginTop: '5rem', background: 'rgba(255,0,0,0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,0,0,0.1)' }}>
                    <label style={{ display: 'block', textAlign: 'center', marginBottom: '1.5rem', fontWeight: 900, fontSize: '1.1rem', color: 'var(--text-primary)', letterSpacing: '1px', textTransform: 'uppercase' }}>Reason for Delay</label>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                      gap: '1rem',
                      marginBottom: '2rem'
                    }}>
                      {[
                        { label: 'Land Acquisition', icon: <MapIcon size={20} /> },
                        { label: 'Utility Shifting', icon: <Zap size={20} /> },
                        { label: 'Encroachment', icon: <ShieldAlert size={20} /> },
                        { label: 'NOC (Forest/Pollution/Any Other)', icon: <FileCheck size={20} /> },
                        { label: 'Court Case/Stay', icon: <Gavel size={20} /> },
                        { label: 'Any Other', icon: <MoreHorizontal size={20} /> }
                      ].map(item => {
                        const isSelected = (masterFields.delayReasons || []).includes(item.label);
                        return (
                          <div key={item.label} style={{ 
                            display: 'flex', 
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.75rem',
                            padding: '1.25rem',
                            borderRadius: '20px',
                            background: isSelected 
                              ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%)' 
                              : 'var(--glass-bg)',
                            border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--glass-border)'}`,
                            cursor: 'pointer',
                            transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                            boxShadow: isSelected ? '0 8px 24px rgba(99, 102, 241, 0.3)' : 'none',
                            transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                            textAlign: 'center',
                            minHeight: '130px'
                          }} onClick={(e) => {
                            const current = masterFields.delayReasons || [];
                            if (current.includes(item.label)) {
                              setMasterFields({ ...masterFields, delayReasons: current.filter(r => r !== item.label) });
                            } else {
                              setMasterFields({ ...masterFields, delayReasons: [...current, item.label] });
                            }
                          }}>
                            <div style={{
                              width: '48px',
                              height: '48px',
                              borderRadius: '14px',
                              background: isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: isSelected ? 'white' : 'var(--text-muted)',
                              transition: 'all 0.3s ease',
                              boxShadow: isSelected ? '0 4px 12px rgba(99, 102, 241, 0.4)' : 'none'
                            }}>
                              {item.icon}
                            </div>
                            <span style={{ 
                              fontSize: '0.8rem', 
                              fontWeight: 700, 
                              color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                              lineHeight: '1.3',
                              maxWidth: '180px'
                            }}>
                              {item.label}
                            </span>
                            {isSelected && (
                              <div style={{ 
                                position: 'absolute', 
                                top: '8px', 
                                right: '8px', 
                                background: 'var(--success)', 
                                color: 'white', 
                                borderRadius: '50%', 
                                width: '20px', 
                                height: '20px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center' 
                              }}>
                                <CheckCircle2 size={12} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label>Brief Reason for Delay</label>
                      <textarea
                        placeholder="Please provide specific details about the delay (minimum 5 characters)..."
                        value={masterFields.delayBrief || ''}
                        onChange={e => setMasterFields({ ...masterFields, delayBrief: e.target.value })}
                        style={{
                          minHeight: '100px',
                          padding: '1rem',
                          borderRadius: '12px',
                          background: 'rgba(0,0,0,0.2)',
                          border: '1px solid var(--glass-border)',
                          color: 'var(--text-primary)',
                          fontSize: '0.9rem',
                          lineHeight: '1.5',
                          resize: 'vertical'
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: '0.5rem' }}>
            <p style={{ margin: 0, fontWeight: 700 }}>{masterFields.name}</p>
            <p style={{ margin: '0.2rem 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Estimated Cost: ₹{masterFields.estimatedCost} Lakhs</p>
          </div>
        )}
      </div>

      {/* Live Sync Progress Indicator */}
      <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Live Sync Progress</span>
          <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)' }}>
            {((workflowUpdates.filter(w => w.value === 'Yes').length / workflowUpdates.length) * 100).toFixed(1)}%
          </span>
        </div>
        <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${(workflowUpdates.filter(w => w.value === 'Yes').length / workflowUpdates.length) * 100}%`,
              background: 'linear-gradient(90deg, var(--primary), var(--secondary))',
              transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '2rem' }}>
        {(userRole === 'DEO' || userRole === 'ADMIN' || userRole === 'ENGINEER') && (
          <button className="btn" style={{ flex: 1, background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.2)' }} onClick={() => handleFinalSubmit(true)}>
            Quick Save & Exit
          </button>
        )}
        <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => {
          if (userRole === 'DEO' || userRole === 'ADMIN') {
            if (!masterFields.name || !masterFields.estimatedCost || !masterFields.inchargeMobile) {
              alert('Project Name, Estimated Cost, and EE Mobile are mandatory for updates.');
              return;
            }

            // Character Validation for Master Updates
            if (!validateProjectText(masterFields.name, 'Project Name')) return;
            if (!validateProjectText(masterFields.brief, 'Project Description')) return;
            if (!validateProjectText(masterFields.fundingAgency, 'Funding Agency')) return;
            if (!validateProjectText(masterFields.inchargeName, 'Incharge Name')) return;
            if (!validateProjectText(masterFields.consultantName, 'Consultant Name')) return;

            // Mobile Validations
            if (!validateMobile(masterFields.inchargeMobile, 'Executive Engineer Mobile')) return;
            if (!validateMobile(masterFields.consultantMobile, 'Consultant Mobile')) return;

            // Cost Validation
            if (parseFloat(masterFields.estimatedCost) < 0) {
              alert('Estimated Cost cannot be negative.');
              return;
            }

            // Work Started Validation
            if (!validateWorkStarted()) return;
          }
          setStep(2);
        }}>Next: Pre-Execution</button>
      </div>
    </div>
  );

  const renderStep2 = () => {
    // Determine how many steps to show based on dependencies
    let visibleCount = 1;
    for (let i = 0; i < workflowUpdates.length - 1; i++) {
      const curW = workflowUpdates[i];
      if (project.type === 'CONSULTANCY' && curW.stepName === 'Technical Sanction') {
        visibleCount++;
        continue;
      }
      const tenderSteps = ['NIT Published', 'Tender Opened'];
      if (project.type === 'CONSULTANCY' && project.consultancySource === 'SINGLE_SOURCE' && tenderSteps.includes(curW.stepName)) {
        visibleCount++;
        continue;
      }
      if (curW.value === 'Yes' && curW.date) {
        visibleCount++;
      } else {
        break;
      }
    }

    return (
      <div className="fade-in">
        <h4>Step 2: Pre-Execution Milestones</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Steps must be completed in order. PERT is only accessible after Work Order.
        </p>

        {workflowUpdates.slice(0, visibleCount).map((w, idx) => {
          if (project.type === 'CONSULTANCY' && w.stepName === 'Technical Sanction') return null;

          // Skip tender steps for Single Source consultancy projects
          const tenderSteps = ['NIT Published', 'Tender Opened'];
          if (project.type === 'CONSULTANCY' && project.consultancySource === 'SINGLE_SOURCE' && tenderSteps.includes(w.stepName)) return null;

          const isDPR = ['Draft DPR Submitted', 'Draft DPR Approved', 'Final DPR Submitted', 'Final DPR Approved'].includes(w.stepName);
          const isWOLocked = project.type === 'CONSULTANCY' && isDPR && workflowUpdates.find(item => item.stepName === 'Work Order Issued')?.value !== 'Yes';

          return (
            <div key={idx} className="glass-card" style={{ padding: '1rem', marginBottom: '1rem', borderLeft: w.value === 'Yes' ? '4px solid var(--success)' : '4px solid var(--error)', opacity: isWOLocked ? 0.5 : 1, pointerEvents: isWOLocked ? 'none' : 'auto', cursor: isWOLocked ? 'not-allowed' : 'default' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>{w.stepName}</span>
                <YesNoToggle
                  value={w.value}
                  onChange={val => {
                    // Prevent skipping milestones
                    if (val === 'Yes') {
                      for (let i = 0; i < idx; i++) {
                        if (workflowUpdates[i].value !== 'Yes') {
                          alert(`Sequence Violation: You must first complete "${getStepDisplayName(workflowUpdates[i].stepName)}" before marking this stage as Yes.`);
                          return;
                        }
                      }
                    }

                    const dprSteps = ['Draft DPR Submitted', 'Draft DPR Approved', 'Final DPR Submitted', 'Final DPR Approved'];
                    if (project.type === 'CONSULTANCY' && dprSteps.includes(w.stepName)) {
                      const wo = workflowUpdates.find(item => item.stepName === 'Work Order Issued');
                      if (!wo || wo.value !== 'Yes') {
                        alert("You cannot proceed until the Work Start Date (As per Work Order) is recorded.");
                        return;
                      }
                    }
                    const next = [...workflowUpdates];
                    next[idx].value = val;
                    next[idx].isCompleted = val === 'Yes';
                    if (val === 'No') {
                      for (let j = idx + 1; j < next.length; j++) {
                        next[j].value = 'No';
                        next[j].isCompleted = false;
                        next[j].reason = '';
                        next[j].date = '';
                      }
                    }
                    setWorkflowUpdates(next);
                  }}
                />
              </div>

              {w.value === 'Yes' ? (
                <div className="input-group" style={{ marginTop: '1rem', marginBottom: 0 }}>
                  {w.stepName !== 'Work Order Issued' && (
                    <>
                      <label>Date of Achievement</label>
                      <input
                        type="date"
                        min="1900-01-01"
                        max="2099-12-31"
                        value={formatDateForInput(w.date)}
                        required
                        onChange={e => {
                          const val = e.target.value;
                          const next = [...workflowUpdates];
                          next[idx].date = val;
                          setWorkflowUpdates(next);

                          // Only alert if the date is fully formed (10 chars: YYYY-MM-DD)
                          // This prevents annoying alerts while the user is still typing the year/month
                          if (val && val.length === 10) {
                            validateDates(next);
                          }
                        }}
                      />
                    </>
                  )}

                  {w.stepName === 'Work Order Issued' && (
                    <div className="responsive-input-grid" style={{ gap: '1rem', marginTop: '1rem' }}>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Calendar size={14} color="var(--primary)" /> Work Start Date (As per Work Order)
                        </label>
                        <input
                          type="date"
                          min="1900-01-01"
                          max="2099-12-31"
                          value={formatDateForInput(statusUpdate.actualStartDate)}
                          onChange={e => {
                            const val = e.target.value;
                            setStatusUpdate({ ...statusUpdate, actualStartDate: val });
                            const next = [...workflowUpdates];
                            next[idx].date = val;
                            setWorkflowUpdates(next);
                            if (val && val.length === 10) {
                              validateDates(next);
                            }
                          }}
                        />
                      </div>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Calendar size={14} color="var(--primary)" /> Stipulated Completion Date
                        </label>
                        <input
                          type="date"
                          min={formatDateForInput(statusUpdate.actualStartDate) || "1900-01-01"}
                          max="2099-12-31"
                          value={formatDateForInput(statusUpdate.stipulatedCompletionDate)}
                          onChange={e => setStatusUpdate({ ...statusUpdate, stipulatedCompletionDate: e.target.value })}
                        />
                        {statusUpdate.actualStartDate && statusUpdate.stipulatedCompletionDate &&
                          new Date(statusUpdate.stipulatedCompletionDate) < new Date(statusUpdate.actualStartDate) && (
                            <p style={{ color: 'var(--error)', fontSize: '0.7rem', marginTop: '0.3rem', fontWeight: 600 }}>
                              Cannot be earlier than Start Date
                            </p>
                          )}
                      </div>
                    </div>
                  )}
                  {w.stepName === 'Work Order Issued' && project.type === 'EXECUTION' && (
                    <div className="responsive-input-grid" style={{ gap: '1rem', marginTop: '1rem' }}>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label>Name of Contractor</label>
                        <input value={statusUpdate.contractorName} onChange={e => setStatusUpdate({ ...statusUpdate, contractorName: sanitizeName(e.target.value) })} />
                      </div>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label>Contractor Mobile</label>
                        <input maxLength="10" value={statusUpdate.contractorMobile} onChange={e => setStatusUpdate({ ...statusUpdate, contractorMobile: sanitizeMobile(e.target.value) })} />
                      </div>
                    </div>
                  )}
                  {w.stepName === 'Work Order Issued' && project.type === 'CONSULTANCY' && (
                    <div className="responsive-input-grid" style={{ gap: '1rem', marginTop: '1rem' }}>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label>Name of Consultant</label>
                        <input value={statusUpdate.consultantName || ''} onChange={e => setStatusUpdate({ ...statusUpdate, consultantName: sanitizeName(e.target.value) })} />
                      </div>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label>Consultant Mobile</label>
                        <input maxLength="10" value={statusUpdate.consultantMobile || ''} onChange={e => setStatusUpdate({ ...statusUpdate, consultantMobile: sanitizeMobile(e.target.value) })} />
                      </div>
                    </div>
                  )}

                  {w.stepName === 'Work Order Issued' && (
                    <div className="glass-card" style={{ background: 'rgba(255,255,255,0.03)', marginTop: '1.5rem', padding: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <YesNoToggle
                        label="Has Project Work Officially Started at Site?"
                        value={masterFields.workStarted || 'No'}
                        onChange={val => setMasterFields({ ...masterFields, workStarted: val })}
                      />

                      {masterFields.workStarted === 'No' && (
                        <div className="fade-in" style={{ marginTop: '1rem', background: 'rgba(255,0,0,0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,0,0,0.1)' }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Reason for Delay</label>
                          <div style={{ 
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                            gap: '0.75rem', 
                            marginBottom: '1.5rem'
                          }}>
                            {[
                              'Land Acquisition', 'Utility Shifting', 'Encroachment',
                              'NOC (Forest/Pollution/Any Other)', 'Court Case/Stay', 'Any Other'
                            ].map(reason => (
                              <div key={reason} style={{ 
                                display: 'flex', 
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.75rem 1rem',
                                borderRadius: '10px',
                                background: 'rgba(255, 255, 255, 0.04)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }} onClick={(e) => {
                                if (e.target.type !== 'checkbox') {
                                  const current = masterFields.delayReasons || [];
                                  if (current.includes(reason)) {
                                    setMasterFields({ ...masterFields, delayReasons: current.filter(r => r !== reason) });
                                  } else {
                                    setMasterFields({ ...masterFields, delayReasons: [...current, reason] });
                                  }
                                }
                              }}>
                                <input
                                  type="checkbox"
                                  style={{ 
                                    width: '18px', 
                                    height: '18px', 
                                    cursor: 'pointer',
                                    accentColor: 'var(--primary)',
                                    margin: 0,
                                    flexShrink: 0
                                  }}
                                  checked={(masterFields.delayReasons || []).includes(reason)}
                                  onChange={(e) => {
                                    const current = masterFields.delayReasons || [];
                                    if (e.target.checked) {
                                      setMasterFields({ ...masterFields, delayReasons: [...current, reason] });
                                    } else {
                                      setMasterFields({ ...masterFields, delayReasons: current.filter(r => r !== reason) });
                                    }
                                  }} 
                                />
                                <span style={{ 
                                  fontSize: '0.85rem', 
                                  fontWeight: 600, 
                                  color: 'var(--text-primary)',
                                  textAlign: 'left',
                                  lineHeight: '1.4'
                                }}>
                                  {reason}
                                </span>
                              </div>
                            ))}
                          </div>
                          <div className="input-group" style={{ marginBottom: 0 }}>
                            <label>Brief Reason for Delay</label>
                            <textarea
                              placeholder="Enter brief reason for delay..."
                              value={masterFields.delayBrief || ''}
                              onChange={e => setMasterFields({ ...masterFields, delayBrief: e.target.value })}
                              style={{ minHeight: '60px', padding: '0.5rem' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="input-group" style={{ marginTop: '1rem', marginBottom: 0 }}>
                  <label>Reason for Delay (Mandatory)</label>
                  <textarea
                    placeholder="Why is this step pending?"
                    value={w.reason}
                    required
                    onChange={e => {
                      const next = [...workflowUpdates];
                      next[idx].reason = e.target.value;
                      setWorkflowUpdates(next);
                    }}
                    style={{ minHeight: '60px', padding: '0.5rem' }}
                  />
                </div>
              )}
            </div>
          )
        })}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '2rem' }}>
          <button className="btn btn-ghost" onClick={() => setStep(1)}>Back</button>

          {(userRole === 'DEO' || userRole === 'ADMIN' || userRole === 'ENGINEER') && (
            <button className="btn" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.2)', fontSize: '0.75rem' }} onClick={() => handleFinalSubmit(true)}>
              Quick Save
            </button>
          )}

          {workflowUpdates.slice(0, visibleCount).some(w => w.value === 'No') ? (
            <button
              className="btn btn-primary"
              style={{ flex: '1 1 250px', background: 'var(--error)' }}
              onClick={() => {
                const pendingStep = workflowUpdates.slice(0, visibleCount).find(w => {
                  if (w.value !== 'No') return false;
                  // Skip validation for steps that are filtered out in UI
                  if (project.type === 'CONSULTANCY') {
                    if (w.stepName === 'Technical Sanction') return false;
                    const tenderSteps = ['NIT Published', 'Tender Opened'];
                    if (project.consultancySource === 'SINGLE_SOURCE' && tenderSteps.includes(w.stepName)) return false;
                  }
                  return true;
                });
                if (pendingStep && (!pendingStep.reason || pendingStep.reason.trim().length < 5)) {
                  alert(`Mandatory: Please provide a valid Reason for Delay for "${getStepDisplayName(pendingStep.stepName)}" before submitting.`);
                  return;
                }
                if (!validateWorkStarted()) return;
                handleFinalSubmit();
              }}
              disabled={load}
            >
              {load ? 'Saving...' : (
                project.type === 'CONSULTANCY'
                  ? `Submit (Pending)`
                  : 'Submit & Exit (Work Stalled)'
              )}
            </button>
          ) : (
            <button
              className="btn btn-primary"
              style={{ flex: '1 1 250px' }}
              onClick={() => {
                const lastVisible = workflowUpdates[visibleCount - 1];
                if (lastVisible.value === 'Yes' && !lastVisible.date) {
                  const label = getStepDisplayName(lastVisible.stepName);
                  alert(`Please enter the date for ${label}`);
                  return;
                }

                // Consultancy Final Submission directly from Step 2 if Final DPR Approved is Yes
                if (project.type === 'CONSULTANCY' && workflowUpdates.find(w => w.stepName === 'Final DPR Approved')?.value === 'Yes') {
                  handleFinalSubmit();
                  return;
                }
                // Chronological Check (Next Step)
                if (!validateDates(workflowUpdates)) return;

                // Work Started Validation
                if (!validateWorkStarted()) return;

                // --- STRICT WORKFLOW VALIDATION ---
                let tempVisibleCount = 1;
                for (let i = 0; i < workflowUpdates.length - 1; i++) {
                  if (workflowUpdates[i].value === 'Yes' && workflowUpdates[i].date) {
                    tempVisibleCount++;
                  } else if (project.type === 'CONSULTANCY' && workflowUpdates[i].stepName === 'Technical Sanction') {
                    tempVisibleCount++;
                  } else {
                    break;
                  }
                }

                const activeWorkflows = workflowUpdates.slice(0, tempVisibleCount);
                let isValid = true;
                for (const w of activeWorkflows) {
                  if (project.type === 'CONSULTANCY' && w.stepName === 'Technical Sanction') continue;

                  if (w.value === 'Yes' && !w.date) {
                    alert(`Dhyan dein: "${getStepDisplayName(w.stepName)}" ke liye Date of Achievement mention karna anivarya hai.`);
                    isValid = false;
                    break;
                  }
                  if (w.value === 'No') {
                    if (!w.reason || w.reason.trim().length < 5) {
                      alert(`Dhyan dein: "${getStepDisplayName(w.stepName)}" ke liye Reason for Delay mention karna anivarya hai (at least 5 characters).`);
                      isValid = false;
                      break;
                    }
                  }
                }

                if (!isValid) return;

                // Determine next step
                const lastStage = activeWorkflows[activeWorkflows.length - 1];
                if (lastStage.value === 'Yes' && lastStage.date) {
                  if (project.type === 'EXECUTION') setStep(3);
                  else if (project.type === 'CONSULTANCY') handleFinalSubmit();
                  else setStep(4);
                } else {
                  alert(`Pripaya "${getStepDisplayName(lastStage.stepName)}" ko "Yes" karein aur date bharein aage badhne ke liye, ya delay reason provide karein agar kaam ruka hai.`);
                }
              }}
            >
              Next Step
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderStep3 = () => {
    const totalCalc = calculateOverallProgress(pertUpdates);

    return (
      <div className="fade-in">
        <h4>Step 3: PERT Activity Progress</h4>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.8rem' }}>
          Update progress for each activity. Overall project progress is calculated automatically.
        </p>

        <div className="glass-card" style={{ padding: '1rem', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.05)' }}>
          <p style={{ color: 'var(--success)', fontWeight: 600 }}>Effect on Physical Progress: {totalCalc}%</p>
        </div>

        {pertUpdates.map((p, idx) => (
          <div key={idx} className="glass-card" style={{ marginBottom: '1rem', padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ fontWeight: 600 }}>{p.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({p.weightage}%)</span></span>
              <span style={{ color: 'var(--success)', fontWeight: 700 }}>{p.progress}%</span>
            </div>
            <input type="range" min="0" max="100" value={p.progress} onChange={e => {
              const next = [...pertUpdates];
              next[idx].progress = e.target.value;
              setPertUpdates(next);
              // Also update the overall physical progress in Step 4
              setStatusUpdate({ ...statusUpdate, physicalProgress: calculateOverallProgress(next) });
            }} style={{ width: '100%', accentColor: 'var(--success)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              <span>Start: {formatDate(p.startDate)}</span>
              <span>Deadline: {formatDate(p.endDate)}</span>
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
          <button className="btn btn-ghost" onClick={() => setStep(2)}>Back</button>
          {(userRole === 'DEO' || userRole === 'ADMIN' || userRole === 'ENGINEER') && (
            <button className="btn" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.2)' }} onClick={() => handleFinalSubmit(true)}>
              Quick Save
            </button>
          )}
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStep(4)}>Confirm & Next</button>
        </div>
      </div>
    );
  };

  const renderStep4 = () => (
    <div className="fade-in">
      <h4>Step 4: Overall Progress Stats</h4>
      <div className="input-group">
        <label>Physical Progress (%) — Calculated from PERT</label>
        <input type="number" readOnly value={statusUpdate.physicalProgress} style={{ background: 'rgba(255,255,255,0.05)', cursor: 'not-allowed' }} />
      </div>
      <div className="input-group">
        <label>Financial Progress (%)</label>
        <input type="number" value={statusUpdate.financialProgress} onChange={e => setStatusUpdate({ ...statusUpdate, financialProgress: e.target.value })} />
      </div>
      {renderDynamicFields('UPDATE_PROGRESS')}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
        <button className="btn btn-ghost" onClick={() => setStep(project.type === 'EXECUTION' ? 3 : 2)}>Back</button>
        {(userRole === 'DEO' || userRole === 'ADMIN' || userRole === 'ENGINEER') && (
          <button className="btn" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.2)' }} onClick={() => handleFinalSubmit(true)}>
            Quick Save
          </button>
        )}
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStep(5)}>Next: Overall Status</button>
      </div>
    </div>
  );

  const renderStep5 = () => {
    return (
      <div className="fade-in">
        <h4>Step 5: Overall Project Status</h4>

        <StatusToggle value={statusUpdate.overallStatus} onChange={val => setStatusUpdate({ ...statusUpdate, overallStatus: val })} />

        {statusUpdate.overallStatus === 'On Hold' && (
          <div className="input-group fade-in">
            <label>Reason for Hold (Mandatory)</label>
            <textarea
              value={statusUpdate.statusHoldReason}
              onChange={e => setStatusUpdate({ ...statusUpdate, statusHoldReason: e.target.value })}
              placeholder="Why is the project on hold?"
              style={{ minHeight: '60px', padding: '0.5rem' }}
            />
          </div>
        )}

        {statusUpdate.overallStatus === 'Delay' && (
          <div className="glass-card fade-in" style={{ padding: '1rem', marginBottom: '1.5rem', border: '1px solid var(--warning)' }}>
            <label style={{ display: 'block', textAlign: 'center', marginBottom: '1.5rem', fontWeight: 900, fontSize: '1rem', color: 'var(--text-primary)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Reason for Delay</label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              marginBottom: '2rem'
            }}>
              {[
                { label: 'Land Acquisition', icon: <MapIcon size={18} /> },
                { label: 'Utility Shifting', icon: <Zap size={18} /> },
                { label: 'Encroachment', icon: <ShieldAlert size={18} /> },
                { label: 'NOC (Forest/Pollution/Other)', icon: <FileCheck size={18} /> },
                { label: 'Court Case/Stay', icon: <Gavel size={18} /> },
                { label: 'Any Other', icon: <MoreHorizontal size={18} /> }
              ].map(item => {
                const isSelected = (statusUpdate.statusDelayReasons || []).includes(item.label);
                return (
                  <div key={item.label} style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.6rem',
                    padding: '1rem',
                    borderRadius: '16px',
                    background: isSelected 
                      ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)' 
                      : 'rgba(255,255,255,0.02)',
                    border: `1.5px solid ${isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.05)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: isSelected ? 'translateY(-4px)' : 'translateY(0)',
                    textAlign: 'center',
                    position: 'relative',
                    minHeight: '100px'
                  }} onClick={() => {
                    const current = statusUpdate.statusDelayReasons || [];
                    if (current.includes(item.label)) {
                      setStatusUpdate({ ...statusUpdate, statusDelayReasons: current.filter(r => r !== item.label) });
                    } else {
                      setStatusUpdate({ ...statusUpdate, statusDelayReasons: [...current, item.label] });
                    }
                  }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isSelected ? 'white' : 'var(--text-muted)',
                      transition: 'all 0.3s ease'
                    }}>
                      {item.icon}
                    </div>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      fontWeight: 700, 
                      color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' 
                    }}>
                      {item.label}
                    </span>
                    {isSelected && (
                      <div style={{ 
                        position: 'absolute', top: '6px', right: '6px', 
                        background: 'var(--success)', color: 'white', 
                        borderRadius: '50%', width: '16px', height: '16px', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center' 
                      }}>
                        <CheckCircle2 size={10} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Brief Reason for Delay (Mandatory)</label>
              <textarea
                value={statusUpdate.statusDelayBrief}
                onChange={e => setStatusUpdate({ ...statusUpdate, statusDelayBrief: e.target.value })}
                placeholder="Provide brief details about the delay..."
                style={{ minHeight: '60px', padding: '0.5rem' }}
              />
            </div>
          </div>
        )}

        <div className="input-group">
          <label>Today's Update Note (Mandatory)</label>
          <textarea
            value={statusUpdate.todaysUpdateNote}
            onChange={e => setStatusUpdate({ ...statusUpdate, todaysUpdateNote: e.target.value })}
            placeholder="Brief note about the progress till today..."
            style={{ minHeight: '60px', padding: '0.5rem' }}
          />
        </div>

        {project.type === 'EXECUTION' && !config?.fields?.some(f => f.location === 'UPDATE_STATUS' && f.fieldKey.includes('QUALITY')) && (
          <>
            <YesNoToggle
              label="Quality Sampling as per norms"
              value={statusUpdate.qualitySampling}
              onChange={val => setStatusUpdate({ ...statusUpdate, qualitySampling: val })}
            />

            {statusUpdate.qualitySampling === 'No' && (
              <div className="input-group fade-in">
                <label style={{ color: '#f87171' }}>Reason for No Quality Sampling (Mandatory)</label>
                <textarea
                  value={statusUpdate.qualitySamplingReason}
                  onChange={e => setStatusUpdate({ ...statusUpdate, qualitySamplingReason: e.target.value })}
                  placeholder="Please provide a valid reason why quality sampling was not done..."
                  style={{ minHeight: '60px', padding: '0.5rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                />
              </div>
            )}
          </>
        )}

        <div className="input-group">
          <label>Expected Date of Project Completion (Mandatory)</label>
          <input
            type="date"
            min="1900-01-01"
            max="2099-12-31"
            value={formatDateForInput(statusUpdate.expectedCompletionDate)}
            onChange={e => setStatusUpdate({ ...statusUpdate, expectedCompletionDate: e.target.value })}
          />
        </div>

        {!config?.fields?.some(f => f.location === 'UPDATE_STATUS' && f.fieldKey.includes('EXTENSION')) && (
          <YesNoToggle
            label="Time Extension Taken?"
            value={statusUpdate.timeExtension}
            onChange={val => setStatusUpdate({ ...statusUpdate, timeExtension: val })}
            style={{ marginBottom: '1.5rem' }}
          />
        )}

        {renderDynamicFields('UPDATE_STATUS')}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '2rem' }}>
          <button className="btn btn-ghost" onClick={() => setStep(4)}>Back</button>
          {(userRole === 'DEO' || userRole === 'ADMIN' || userRole === 'ENGINEER') && (
            <button className="btn" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.2)' }} onClick={() => handleFinalSubmit(true)}>
              Quick Save
            </button>
          )}
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => {
            if (!statusUpdate.overallStatus) { alert("Please select an overall status."); return; }
            if (statusUpdate.overallStatus === 'On Hold' && !statusUpdate.statusHoldReason) { alert("Reason for hold is mandatory."); return; }
            if (statusUpdate.overallStatus === 'Delay') {
              if (!statusUpdate.statusDelayReasons || statusUpdate.statusDelayReasons.length === 0) { alert("Please select at least one reason for delay."); return; }
              if (!statusUpdate.statusDelayBrief) { alert("Brief reason for delay is mandatory."); return; }
            }
            if (!statusUpdate.todaysUpdateNote) { alert("Today's update note is mandatory."); return; }
            if (project.type === 'EXECUTION' && statusUpdate.qualitySampling === 'No' && !statusUpdate.qualitySamplingReason) { alert("Reason for no quality sampling is mandatory."); return; }
            if (!statusUpdate.expectedCompletionDate) { alert("Expected date of completion is mandatory."); return; }

            // Time Extension validation: Mandatory if Expected > Stipulated
            const expTime = statusUpdate.expectedCompletionDate ? new Date(statusUpdate.expectedCompletionDate).getTime() : 0;
            const stipTime = statusUpdate.stipulatedCompletionDate ? new Date(statusUpdate.stipulatedCompletionDate).getTime() : 0;
            if (expTime > stipTime && !statusUpdate.timeExtension) {
              alert("Dhyan dein: Expected Completion Date contract ki Stipulated Date se aage hai. Kripya Time Extension (Yes/No) record karein.");
              return;
            }

            // Skip Evidence for Consultancy
            if (project.type === 'CONSULTANCY') {
              handleFinalSubmit();
              return;
            }

            setStep(6);
          }}>Next: Evidence</button>
        </div>
      </div>
    );
  };

  const renderStep6 = () => {
    const hasEvidenceRights = userRole === 'ENGINEER' || userRole === 'DEO';

    return (
      <div className="fade-in">
        <h4>Step 6: Geo-Tag & Visuals</h4>

        {!hasEvidenceRights && (
          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '1rem', border: '1px solid rgba(99, 102, 241, 0.2)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <Info size={24} color="var(--primary)" />
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <strong>Notice:</strong> Visual evidence and site coordinates are locked. Only the <strong>Field Engineer</strong> or <strong>DEO</strong> can update these details. Existing evidence will be preserved.
            </p>
          </div>
        )}

        <div className="input-group">
          {hasEvidenceRights ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={captureGPS}
              style={{ width: '100%', height: '4rem', fontSize: '1.1rem', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', boxShadow: '0 8px 20px rgba(37, 99, 235, 0.4)', borderRadius: '1rem' }}
            >
              <MapPin size={24} /> {statusUpdate.gpsLat !== null ? 'LOCATION LOCKED' : 'SYNC SITE COORDINATES'}
            </button>
          ) : (
            <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.03)', borderRadius: '1rem', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <MapPin size={20} color="var(--text-muted)" />
              <div>
                <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Locked Coordinates</p>
                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>{project.gpsLat || '---'}, {project.gpsLong || '---'}</p>
              </div>
            </div>
          )}

          {hasEvidenceRights && statusUpdate.gpsLat !== null && <p style={{ fontSize: '0.7rem', marginTop: '0.5rem' }}>{statusUpdate.gpsLat}, {statusUpdate.gpsLong}</p>}

          {userRole === 'DEO' && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255,165,0,0.1)', borderRadius: '8px', border: '1px solid rgba(255,165,0,0.2)' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--warning)' }}>Manual Coordinates Override</label>
              <div className="responsive-input-grid" style={{ gap: '1rem' }}>
                <input
                  type="number"
                  step="any"
                  placeholder="Latitude (e.g., 0)"
                  value={statusUpdate.gpsLat !== null ? statusUpdate.gpsLat : ''}
                  onChange={(e) => setStatusUpdate({ ...statusUpdate, gpsLat: e.target.value === '' ? null : parseFloat(e.target.value) })}
                  style={{
                    padding: '0.6rem 1rem', borderRadius: '8px',
                    border: '1px solid var(--warning)', background: 'var(--input-bg)',
                    color: 'var(--text-primary)', width: '100%', fontSize: '0.9rem'
                  }}
                />
                <input
                  type="number"
                  step="any"
                  placeholder="Longitude (e.g., 0)"
                  value={statusUpdate.gpsLong !== null ? statusUpdate.gpsLong : ''}
                  onChange={(e) => setStatusUpdate({ ...statusUpdate, gpsLong: e.target.value === '' ? null : parseFloat(e.target.value) })}
                  style={{
                    padding: '0.6rem 1rem', borderRadius: '8px',
                    border: '1px solid var(--warning)', background: 'var(--input-bg)',
                    color: 'var(--text-primary)', width: '100%', fontSize: '0.9rem'
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="input-group">
          <label style={{ color: 'var(--primary)', fontWeight: 700 }}>
            {userRole === 'ENGINEER' ? 'CAPTURE SITE PHOTOS (CAMERA ONLY - 2 REQ.)' : 'UPLOAD SITE PHOTOS (2 REQ.)'}
          </label>

          {hasEvidenceRights ? (
            userRole === 'ENGINEER' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setShowCamera(true)}
                  style={{ width: '100%', height: '3.5rem', background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '0.75rem' }}
                >
                  <Camera size={20} /> LAUNCH LIVE CAMERA
                </button>

                {showCamera && (
                  <LiveCameraModal
                    onClose={() => setShowCamera(false)}
                    onCapture={(img) => {
                      const nextPhotos = [...statusUpdate.photos, img].slice(0, 4);
                      setStatusUpdate({ ...statusUpdate, photos: nextPhotos });
                      setShowCamera(false);
                    }}
                  />
                )}
              </div>
            ) : (
              <input
                type="file"
                multiple
                accept="image/*"
                capture="environment"
                required
                onChange={(e) => {
                  const fileList = Array.from(e.target.files);
                  const currentPhotos = statusUpdate.photos || [];
                  const nextPhotos = [...currentPhotos, ...fileList].slice(0, 4);
                  setStatusUpdate({ ...statusUpdate, photos: nextPhotos });
                }}
              />
            )
          ) : (
            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '1rem', border: '1px solid var(--glass-border)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <Camera size={24} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
              <p style={{ margin: 0 }}>Existing photographs from the latest field update will be used.</p>
            </div>
          )}
          {statusUpdate.photos.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--success)', marginBottom: '0.5rem' }}>
                {statusUpdate.photos.length} site evidence photos captured:
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {statusUpdate.photos.map((img, idx) => (
                  <div key={idx} style={{ position: 'relative', width: '100px', height: '100px', borderRadius: '12px', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.05)', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
                    <img
                      src={typeof img === 'string' && img.startsWith('data:') ? img : (typeof img === 'string' ? img : URL.createObjectURL(img))}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = statusUpdate.photos.filter((_, i) => i !== idx);
                        setStatusUpdate({ ...statusUpdate, photos: next });
                      }}
                      style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(239, 68, 68, 0.8)', border: 'none', color: 'white', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="input-group">
          <label>Final Remarks</label>
          <textarea value={statusUpdate.remarks} onChange={e => setStatusUpdate({ ...statusUpdate, remarks: e.target.value })} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '2rem' }}>
          <button className="btn btn-ghost" onClick={() => setStep(5)}>Back</button>
          <button className="btn btn-primary" style={{ flex: 1, disabled: load }} onClick={handleFinalSubmit}>
            {load ? 'Saving Lifecycle...' : 'Finish & Submit Update'}
          </button>
        </div>
      </div>
    );
  };

  const wizardRef = useRef(null);

  useEffect(() => {
    if (wizardRef.current) wizardRef.current.scrollTo(0, 0);
  }, [step]);

  if (submitted) {
    return (
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        className="fade-in"
      >
        <div
          className="glass-card"
          style={{ width: '100%', maxWidth: '480px', textAlign: 'center', padding: '3.5rem 2rem', position: 'relative', overflow: 'hidden' }}
        >
          <button
            onClick={onSuccess}
            style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', zIndex: 10 }}
          >
            <X size={24} />
          </button>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'var(--success)' }}></div>
          <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2.5rem' }}>
            <CheckCircle2 size={56} color="var(--success)" />
          </div>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.75rem' }}>Update Committed</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem', lineHeight: '1.6', fontSize: '1rem' }}>
            The project lifecycle state, pre-execution milestones, and field evidence have been successfully synchronized with the central authority database.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button className="btn btn-primary" style={{ width: '100%', height: '3.5rem' }} onClick={onSuccess}>
              Return to Dashboard
            </button>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Transaction ID: DRISHTI-TXN-{Date.now().toString().slice(-6)}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div
        className="glass-card modal-content fade-in-up"
        style={{ padding: '2.5rem 1.5rem' }}
        ref={wizardRef}
      >
        <button
          onClick={onClose}
          style={{ position: 'absolute', right: '1.25rem', top: '1.25rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', zIndex: 10 }}
        >
          <X size={24} />
        </button>
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.5rem', flexShrink: 0 }}>
          {[1, 2, 3, 4, 5, 6].map(s => <div key={s} style={{ flex: 1, height: '4px', background: step >= s ? 'var(--primary)' : 'var(--glass-bg)', borderRadius: 2 }}></div>)}
        </div>
        <div style={{ flex: 1 }}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {project.type === 'EXECUTION' && (
            <>
              {step === 3 && renderStep3()}
              {step === 4 && renderStep4()}
              {step === 5 && renderStep5()}
              {step === 6 && renderStep6()}
            </>
          )}
          {project.type === 'CONSULTANCY' && step > 2 && (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <p>Project milestones are complete. Please return to Step 1 or 2 to finalize master changes.</p>
              <button className="btn btn-primary" onClick={() => setStep(1)}>Back to Step 1</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
