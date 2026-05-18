import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { api } from '../services/api';
import { CONFIG } from '../config';
import { formatDateForInput, normalizeDate } from '../utils/dateUtils';
import { getStepDisplayName, sortWorkflows } from '../utils/workflowUtils';
import { renderDynamicFields, YesNoToggle } from '../components/common/UIHelpers';
import { 
  sanitizeProjectInput, 
  sanitizeName, 
  sanitizeMobile, 
  validateProjectText, 
  validateMobile, 
  blockInvalidNumberKeys 
} from '../utils/validation';

export default function NewProject() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '', type: 'EXECUTION', brief: '', fundingAgency: CONFIG.DEFAULT_AGENCY, customFundingAgency: '', estimatedCost: '',
    inchargeName: '', inchargeMobile: '', creatorId: user?.id,
    consultantName: '', consultantMobile: '', contractorName: '', contractorMobile: '',
    actualStartDate: '', stipulatedCompletionDate: '', expectedCompletionDate: '',
    workStarted: 'No', delayReasons: [], delayBrief: '',
    consultancySource: 'NIT',
    fieldData: {}
  });
  const [load, setLoad] = useState(false);

  const [workflows, setWorkflows] = useState([]);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    api.get('/config/latest').then(res => {
      setConfig(res.data);
      if (res.data && res.data.stages) {
        const mapped = res.data.stages.map(s => ({
          stageKey: s.stageKey,
          stepName: s.displayName,
          isCompleted: false,
          value: 'No',
          reason: '',
          date: ''
        }));
        setWorkflows(sortWorkflows(mapped));
      }
    });
  }, []);

  const [pert, setPert] = useState([
    { name: '', weightage: '', startDate: '', endDate: '' }
  ]);
  const [validationErrors, setValidationErrors] = useState([]);

  const addPertRow = () => setPert([...pert, { name: '', weightage: '', startDate: '', endDate: '' }]);
  const removePertRow = (idx) => setPert(pert.filter((_, i) => i !== idx));

  const validateWorkStarted = () => {
    if (formData.workStarted === 'No') {
      if (!formData.delayReasons || formData.delayReasons.length === 0) {
        alert("Mandatory: Please select at least one 'Reason for Delay' because work has not started at site.");
        return false;
      }
      if (!formData.delayBrief || formData.delayBrief.trim().length < 5) {
        alert("Mandatory: Please provide a 'Brief Reason for Delay' (min. 5 characters) because work has not started at site.");
        return false;
      }
    } else if (formData.workStarted === 'Yes') {
      if (!formData.actualStartDate || !formData.stipulatedCompletionDate) {
        alert("Mandatory: Please provide the Work Start Date and Stipulated Completion Date because work has started at site.");
        return false;
      }
      if (new Date(formData.actualStartDate) > new Date(formData.stipulatedCompletionDate)) {
        alert('Critical Error: Work Start Date cannot be later than the Stipulated Completion Date.');
        return false;
      }
    }
    return true;
  };

  const validateStep1 = () => {
    const errors = [];
    if (!formData.name) errors.push('name');
    if (!formData.brief) errors.push('brief');
    if (!formData.estimatedCost) errors.push('estimatedCost');
    if (!formData.inchargeName) errors.push('inchargeName');
    if (!formData.inchargeMobile) errors.push('inchargeMobile');
    if (formData.fundingAgency === 'Any other' && !formData.customFundingAgency) errors.push('customFundingAgency');

    setValidationErrors(errors);

    if (errors.length > 0) {
      alert('Mandatory Fields: Please enter all required project details to proceed.');
      setTimeout(() => {
        const first = document.querySelector(`.input-error`);
        if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return false;
    }

    if (!validateProjectText(formData.name, 'Project Name')) return false;
    if (!validateProjectText(formData.brief, 'Project Description')) return false;
    if (!validateProjectText(formData.fundingAgency === 'Any other' ? formData.customFundingAgency : formData.fundingAgency, 'Funding Agency')) return false;
    if (!validateProjectText(formData.inchargeName, 'Incharge Name')) return false;
    if (formData.type === 'EXECUTION' && formData.consultantName && !validateProjectText(formData.consultantName, 'Consultant Name')) return false;

    if (formData.inchargeMobile && !validateMobile(formData.inchargeMobile, 'Executive Engineer Mobile')) return false;
    if (formData.type === 'EXECUTION' && formData.consultantMobile && !validateMobile(formData.consultantMobile, 'Consultant Mobile')) return false;

    if (parseFloat(formData.estimatedCost) < 0) {
      alert('Estimated Cost cannot be negative.');
      return false;
    }
    return true;
  };

  const handleSave = async (final = false) => {
    if (!validateStep1()) return;
    if (step >= 2 && !validateWorkStarted()) return;

    if (final && step >= 2) {
      let visibleCount = 1;
      for (let i = 0; i < workflows.length - 1; i++) {
        if (workflows[i].value === 'Yes' && workflows[i].date) {
          visibleCount++;
        } else if (formData.type === 'CONSULTANCY' && workflows[i].stepName === 'Technical Sanction') {
          visibleCount++;
        } else {
          break;
        }
      }

      const activeWorkflows = workflows.slice(0, visibleCount);
      for (const w of activeWorkflows) {
        if (formData.type === 'CONSULTANCY' && w.stepName === 'Technical Sanction') continue;

        if (w.value === 'No') {
          if (!w.reason || w.reason.trim().length < 5) {
            alert(`Dhyan dein: "${getStepDisplayName(w.stepName)}" ke liye Reason for Delay mention karna anivarya hai (at least 5 characters).`);
            setLoad(false);
            return;
          }
        }
        if (w.value === 'Yes' && !w.date) {
          alert(`Dhyan dein: "${getStepDisplayName(w.stepName)}" ke liye Date of Achievement mention karna anivarya hai.`);
          setLoad(false);
          return;
        }
      }

      const sortedWorkflows = sortWorkflows(workflows);
      for (let i = 0; i < sortedWorkflows.length; i++) {
        const cur = sortedWorkflows[i];
        if (formData.type === 'CONSULTANCY' && cur.stepName === 'Technical Sanction') continue;

        if (cur.value === 'Yes' && cur.date) {
          for (let j = i - 1; j >= 0; j--) {
            const pr = sortedWorkflows[j];
            if (formData.type === 'CONSULTANCY' && pr.stepName === 'Technical Sanction') continue;
            if (pr.value === 'Yes' && pr.date) {
              const dCur = normalizeDate(cur.date);
              const dPr = normalizeDate(pr.date);
              if (dCur && dPr && dCur < dPr) {
                window.alert(`Conflict: "${getStepDisplayName(cur.stepName)}" (${dCur}) cannot be before "${getStepDisplayName(pr.stepName)}" (${dPr}).`);
                return;
              }
              break;
            }
          }
          for (let k = i + 1; k < sortedWorkflows.length; k++) {
            const nx = sortedWorkflows[k];
            if (formData.type === 'CONSULTANCY' && nx.stepName === 'Technical Sanction') continue;
            if (nx.value === 'Yes' && nx.date) {
              const dCur = normalizeDate(cur.date);
              const dNx = normalizeDate(nx.date);
              if (dCur && dNx && dCur > dNx) {
                window.alert(`Conflict: "${getStepDisplayName(cur.stepName)}" (${dCur}) cannot be after "${getStepDisplayName(nx.stepName)}" (${dNx}).`);
                return;
              }
              break;
            }
          }
        }
      }
    }

    if (final && formData.type === 'EXECUTION' && step >= 3) {
      for (const p of pert) {
        if (!p.name || !p.weightage || !p.startDate || !p.endDate) {
          alert('Please carefully fill out Name, Weightage, Start Date, and Completion Date for every PERT activity before finalization.');
          return;
        }
      }
      const totalWeight = pert.reduce((sum, p) => sum + parseFloat(p.weightage || 0), 0);
      if (Math.abs(totalWeight - 100) > 0.01) {
        alert('PERT weightage must be 100% for finalization');
        return;
      }
    }

    try {
      setLoad(true);
      const payload = { ...formData };
      if (payload.fundingAgency === 'Any other') {
        payload.fundingAgency = payload.customFundingAgency;
      }
      delete payload.customFundingAgency;
      delete payload.creatorId;

      if (payload.actualStartDate && payload.stipulatedCompletionDate) {
        if (new Date(payload.stipulatedCompletionDate) < new Date(payload.actualStartDate)) {
          alert('Timeline Conflict: Stipulated Completion Date cannot be earlier than Work Start Date.');
          setLoad(false);
          return false;
        }
      }

      if (final && payload.actualStartDate && !payload.expectedCompletionDate) {
        alert('Expected Date of Project Completion is mandatory once work has started.');
        setLoad(false);
        return false;
      }

      if (payload.inchargeMobile && !validateMobile(payload.inchargeMobile, 'Executive Engineer Mobile')) { setLoad(false); return; }
      if (payload.type === 'EXECUTION' && payload.contractorMobile && !validateMobile(payload.contractorMobile, 'Contractor Mobile')) { setLoad(false); return; }
      if (payload.type === 'EXECUTION' && payload.consultantMobile && !validateMobile(payload.consultantMobile, 'Consultant Mobile')) { setLoad(false); return; }
      if (payload.type === 'CONSULTANCY' && payload.consultantMobile && !validateMobile(payload.consultantMobile, 'Consultant Mobile')) { setLoad(false); return; }
      if (payload.type === 'CONSULTANCY' && payload.contractorMobile && !validateMobile(payload.contractorMobile, 'Contractor Mobile')) { setLoad(false); return; }

      await api.post('/projects', {
        projectBaseData: {
          ...payload,
          fieldData: JSON.stringify(payload.fieldData)
        },
        workflows: step >= 2 ? workflows : [],
        pertActivities: (step >= 3 && formData.type === 'EXECUTION') ? pert : []
      });
      alert(`Project ${final ? 'Finalized' : 'Master Instance Created'} Successfully!`);
      navigate('/projects');
      return true;
    } catch (err) {
      alert(err.message || 'Creation failed');
      return false;
    } finally {
      setLoad(false);
    }
  };

  const renderStep1 = () => (
    <div className="fade-in">
      <h2 style={{ marginBottom: '1.5rem' }}>Project Master</h2>
      {renderDynamicFields(config, 'TOP', formData, setFormData)}
      <div className="input-group">
        <label>Work Type</label>
        <select value={formData.type} onChange={e => {
          const nextType = e.target.value;
          setFormData({ ...formData, type: nextType });
          if (nextType === 'CONSULTANCY') {
            const milestones = formData.consultancySource === 'SINGLE_SOURCE' ? [
              { stageKey: 'AF_SANCTION', stepName: 'A&F Received', isCompleted: false, value: 'No', reason: '', date: '' },
              { stageKey: 'WORK_ORDER', stepName: 'Work Order Issued', isCompleted: false, value: 'No', reason: '', date: '' },
              { stageKey: 'DRAFT_DPR_SUBMITTED', stepName: 'Draft DPR Submitted', isCompleted: false, value: 'No', reason: '', date: '' },
              { stageKey: 'DRAFT_DPR_APPROVED', stepName: 'Draft DPR Approved', isCompleted: false, value: 'No', reason: '', date: '' },
              { stageKey: 'FINAL_DPR_SUBMITTED', stepName: 'Final DPR Submitted', isCompleted: false, value: 'No', reason: '', date: '' },
              { stageKey: 'FINAL_DPR_APPROVED', stepName: 'Final DPR Approved', isCompleted: false, value: 'No', reason: '', date: '' }
            ] : [
              { stageKey: 'AF_SANCTION', stepName: 'A&F Received', isCompleted: false, value: 'No', reason: '', date: '' },
              { stageKey: 'NIT_PUBLISHED', stepName: 'NIT Published', isCompleted: false, value: 'No', reason: '', date: '' },
              { stageKey: 'TENDER_OPENED', stepName: 'Tender Opened', isCompleted: false, value: 'No', reason: '', date: '' },
              { stageKey: 'WORK_ORDER', stepName: 'Work Order Issued', isCompleted: false, value: 'No', reason: '', date: '' },
              { stageKey: 'DRAFT_DPR_SUBMITTED', stepName: 'Draft DPR Submitted', isCompleted: false, value: 'No', reason: '', date: '' },
              { stageKey: 'DRAFT_DPR_APPROVED', stepName: 'Draft DPR Approved', isCompleted: false, value: 'No', reason: '', date: '' },
              { stageKey: 'FINAL_DPR_SUBMITTED', stepName: 'Final DPR Submitted', isCompleted: false, value: 'No', reason: '', date: '' },
              { stageKey: 'FINAL_DPR_APPROVED', stepName: 'Final DPR Approved', isCompleted: false, value: 'No', reason: '', date: '' }
            ];
            setWorkflows(milestones);
          } else {
            setWorkflows([
              { stageKey: 'AF_SANCTION', stepName: 'A&F Received', isCompleted: false, value: 'No', reason: '', date: '' },
              { stageKey: 'TECH_SANCTION', stepName: 'Technical Sanction', isCompleted: false, value: 'No', reason: '', date: '' },
              { stageKey: 'NIT_PUBLISHED', stepName: 'NIT Published', isCompleted: false, value: 'No', reason: '', date: '' },
              { stageKey: 'TENDER_OPENED', stepName: 'Tender Opened', isCompleted: false, value: 'No', reason: '', date: '' },
              { stageKey: 'WORK_ORDER', stepName: 'Work Order Issued', isCompleted: false, value: 'No', reason: '', date: '' }
            ]);
          }
        }}>
          <option value="EXECUTION">Execution Work</option>
          <option value="CONSULTANCY">Consultancy Work</option>
        </select>
      </div>

      <div className="input-group">
        <label>Project Name</label>
        <input
          value={formData.name}
          className={validationErrors.includes('name') ? 'input-error' : ''}
          onChange={e => setFormData({ ...formData, name: sanitizeProjectInput(e.target.value) })}
          placeholder="Enter project name"
          required
        />
      </div>
      {renderDynamicFields(config, 'AFTER_NAME', formData, setFormData)}
      <div className="input-group">
        <label>Project Brief Description</label>
        <textarea
          value={formData.brief}
          className={validationErrors.includes('brief') ? 'input-error' : ''}
          onChange={e => setFormData({ ...formData, brief: sanitizeProjectInput(e.target.value) })}
          required
          style={{ minHeight: '60px', padding: '0.5rem', width: '100%', borderRadius: '8px', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
          placeholder="Enter project description..."
        />
      </div>
      {renderDynamicFields(config, 'MASTER', formData, setFormData)}
      <div className="input-group">
        <label>Funding Agency</label>
        <select value={formData.fundingAgency} onChange={e => setFormData({ ...formData, fundingAgency: e.target.value })}>
          <option value="KDA">KDA</option>
          <option value="Any other">Any other</option>
        </select>
      </div>
      {formData.fundingAgency === 'Any other' && (
        <div className="input-group fade-in">
          <label>Name of Funding Agency</label>
          <input
            value={formData.customFundingAgency}
            className={validationErrors.includes('customFundingAgency') ? 'input-error' : ''}
            onChange={e => setFormData({ ...formData, customFundingAgency: sanitizeProjectInput(e.target.value) })}
            placeholder="Enter funding agency name"
            required
          />
        </div>
      )}
      {renderDynamicFields(config, 'AFTER_FUNDING', formData, setFormData)}
      <div className="input-group">
        <label>Estimated Cost (₹ Lakhs)</label>
        <input
          type="number"
          step="0.01"
          min="0"
          onKeyDown={blockInvalidNumberKeys}
          className={validationErrors.includes('estimatedCost') ? 'input-error' : ''}
          value={formData.estimatedCost}
          onChange={e => {
            const val = e.target.value;
            setFormData({ ...formData, estimatedCost: val === '' ? '' : Math.max(0, parseFloat(val) || 0) });
          }}
          placeholder="Enter amount"
          required
        />
      </div>
      {renderDynamicFields(config, 'FINANCIAL', formData, setFormData)}
      <div className="responsive-input-grid" style={{ gap: '1rem' }}>
        <div className="input-group">
          <label>Executive Engineer Name</label>
          <input
            className={validationErrors.includes('inchargeName') ? 'input-error' : ''}
            value={formData.inchargeName}
            onChange={e => setFormData({ ...formData, inchargeName: sanitizeName(e.target.value) })}
          />
        </div>
        <div className="input-group">
          <label>Executive Engineer Mobile</label>
          <input
            className={validationErrors.includes('inchargeMobile') ? 'input-error' : ''}
            maxLength="10"
            placeholder="Required 10-digit mobile"
            value={formData.inchargeMobile}
            onChange={e => setFormData({ ...formData, inchargeMobile: sanitizeMobile(e.target.value) })}
          />
        </div>
      </div>
      {renderDynamicFields(config, 'AFTER_EE', formData, setFormData)}
      {formData.type === 'EXECUTION' && (
        <div className="responsive-input-grid" style={{ gap: '1rem' }}>
          <div className="input-group">
            <label>Consultant Name</label>
            <input value={formData.consultantName} onChange={e => setFormData({ ...formData, consultantName: sanitizeName(e.target.value) })} />
          </div>
          <div className="input-group">
            <label>Consultant Mobile</label>
            <input maxLength="10" value={formData.consultantMobile} onChange={e => setFormData({ ...formData, consultantMobile: sanitizeMobile(e.target.value) })} />
          </div>
        </div>
      )}
      {renderDynamicFields(config, 'AFTER_CONSULTANT', formData, setFormData)}
      {renderDynamicFields(config, 'AFTER_CONTRACTOR', formData, setFormData)}
      {renderDynamicFields(config, 'AFTER_DATES', formData, setFormData)}
      {renderDynamicFields(config, 'BOTTOM', formData, setFormData)}

      <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem' }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleSave(false)}>Save Progress & Exit</button>
        <button
          className="btn btn-primary"
          style={{ flex: 1, background: 'var(--success)', opacity: (formData.name && formData.brief && formData.estimatedCost && formData.inchargeName && (formData.fundingAgency !== 'Any other' || formData.customFundingAgency)) ? 1 : 0.5 }}
          onClick={async () => {
            if (validateStep1()) {
              setStep(2);
            }
          }}
        >
          Next: Add Milestones
        </button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="fade-in">
      <h2 style={{ marginBottom: '1rem' }}>Workflow Status</h2>

      <div className="glass-card fade-in" style={{ marginBottom: '2rem', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>{formData.name || 'Untitled Project'}</h4>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <span style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'var(--primary)', color: 'white', fontWeight: 700 }}>{formData.type}</span>
              <span style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'var(--glass-bg)', color: 'var(--text-secondary)' }}>₹{formData.estimatedCost || '0'} Lakhs</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--primary)' }}>
              {workflows.length > 0 ? ((workflows.filter(w => w.value === 'Yes').length / workflows.length) * 100).toFixed(1) : 0}%
            </div>
            <div style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Projected Start</div>
          </div>
        </div>
        <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden', marginTop: '1rem' }}>
          <div
            style={{
              height: '100%',
              width: `${workflows.length > 0 ? (workflows.filter(w => w.value === 'Yes').length / workflows.length) * 100 : 0}%`,
              background: 'var(--primary)',
              transition: 'width 0.4s ease'
            }}
          />
        </div>
      </div>

      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Define initial pre-execution milestone states</p>
      {(() => {
        let visibleCount = 1;
        for (let i = 0; i < workflows.length - 1; i++) {
          if (workflows[i].value === 'Yes' && workflows[i].date) {
            visibleCount++;
          } else if (formData.type === 'CONSULTANCY' && workflows[i].stepName === 'Technical Sanction') {
            visibleCount++; // Technical Sanction is optional/skipped for consultancy
          } else {
            break;
          }
        }
        return workflows.slice(0, visibleCount);
      })().map((w, idx) => {
        if (formData.type === 'CONSULTANCY' && w.stepName === 'Technical Sanction') return null;

        const isDPR = ['Draft DPR Submitted', 'Draft DPR Approved', 'Final DPR Submitted', 'Final DPR Approved'].includes(w.stepName);
        const isWOLocked = formData.type === 'CONSULTANCY' && isDPR && workflows.find(item => item.stepName === 'Work Order Issued')?.value !== 'Yes';

        return (
          <React.Fragment key={idx}>
            <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem', opacity: isWOLocked ? 0.5 : 1, pointerEvents: isWOLocked ? 'none' : 'auto', cursor: isWOLocked ? 'not-allowed' : 'default' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>{getStepDisplayName(w.stepName)}</span>
                <YesNoToggle
                  value={w.value}
                  onChange={val => {
                    // Prevent skipping milestones
                    if (val === 'Yes') {
                      for (let i = 0; i < idx; i++) {
                        if (workflows[i].value !== 'Yes') {
                          alert(`Sequence Violation: You must first complete "${getStepDisplayName(workflows[i].stepName)}" before marking this stage as Yes.`);
                          return;
                        }
                      }
                    }

                    const dprSteps = ['Draft DPR Submitted', 'Draft DPR Approved', 'Final DPR Submitted', 'Final DPR Approved'];
                    if (formData.type === 'CONSULTANCY' && dprSteps.includes(w.stepName)) {
                      const wo = workflows.find(item => item.stepName === 'Work Order Issued');
                      if (!wo || wo.value !== 'Yes') {
                        alert("You cannot proceed until the Work Start Date (As per Work Order) is recorded.");
                        return;
                      }
                    }
                    const newW = [...workflows];
                    newW[idx].value = val;
                    newW[idx].isCompleted = val === 'Yes';
                    if (val === 'No') {
                      for (let j = idx + 1; j < newW.length; j++) {
                        newW[j].value = 'No';
                        newW[j].isCompleted = false;
                        newW[j].date = '';
                      }
                    }
                    setWorkflows(newW);
                  }}
                />
              </div>
              {w.value === 'Yes' ? (
                <div className="input-group" style={{ marginTop: '1rem', marginBottom: 0 }}>
                  {w.stepName !== 'Work Order Issued' && (
                    <>
                      <label>Date of Achievement</label>
                      <input type="date" min="1900-01-01" max="2099-12-31" value={formatDateForInput(w.date)}
                        onChange={e => {
                          const val = e.target.value;
                          const newW = [...workflows];
                          newW[idx].date = val;
                          setWorkflows(newW);

                          if (val && val.length === 10) {
                            for (let m = 0; m < newW.length; m++) {
                              const cur = newW[m];
                              if (cur.value === 'Yes' && cur.date) {
                                for (let b = m - 1; b >= 0; b--) {
                                  const pr = newW[b];
                                  if (pr.value === 'Yes' && pr.date) {
                                    if (new Date(cur.date).getTime() < new Date(pr.date).getTime()) {
                                      alert(`Order Mismatch: "${getStepDisplayName(cur.stepName)}" before "${getStepDisplayName(pr.stepName)}".`);
                                      return;
                                    }
                                    break;
                                  }
                                }
                                for (let f = m + 1; f < newW.length; f++) {
                                  const nx = newW[f];
                                  if (nx.value === 'Yes' && nx.date) {
                                    if (new Date(cur.date).getTime() > new Date(nx.date).getTime()) {
                                      alert(`Order Mismatch: "${getStepDisplayName(cur.stepName)}" after "${getStepDisplayName(nx.stepName)}".`);
                                      return;
                                    }
                                    break;
                                  }
                                }
                              }
                            }
                          }
                        }}
                      />
                    </>
                  )}

                  {w.stepName === 'Work Order Issued' && (
                    <>
                      <div className="responsive-input-grid" style={{ gap: '1rem', marginTop: '1rem' }}>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                          <label>Work Start Date (As per Work Order)</label>
                          <input
                            type="date"
                            min="1900-01-01"
                            max="2099-12-31"
                            value={formatDateForInput(formData.actualStartDate)}
                            onChange={e => {
                              const val = e.target.value;
                              setFormData({ ...formData, actualStartDate: val });
                              const newW = [...workflows];
                              newW[idx].date = val;
                              setWorkflows(newW);
                            }}
                          />
                        </div>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                          <label>Stipulated Completion Date</label>
                          <input
                            type="date"
                            min={formatDateForInput(formData.actualStartDate) || "1900-01-01"}
                            max="2099-12-31"
                            value={formatDateForInput(formData.stipulatedCompletionDate)}
                            onChange={e => {
                              const val = e.target.value;
                              setFormData(prev => ({
                                ...prev,
                                stipulatedCompletionDate: val,
                                expectedCompletionDate: prev.expectedCompletionDate || val
                              }));
                            }}
                          />
                          {formData.actualStartDate && formData.stipulatedCompletionDate &&
                            new Date(formData.stipulatedCompletionDate) < new Date(formData.actualStartDate) && (
                              <p style={{ color: 'var(--error)', fontSize: '0.7rem', marginTop: '0.3rem', fontWeight: 600 }}>
                                Cannot be earlier than Work Start Date
                              </p>
                            )}
                        </div>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                          <label>Expected Date of Project Completion (Mandatory)</label>
                          <input
                            type="date"
                            min={formatDateForInput(formData.actualStartDate) || "1900-01-01"}
                            max="2099-12-31"
                            value={formatDateForInput(formData.expectedCompletionDate)}
                            onChange={e => setFormData({ ...formData, expectedCompletionDate: e.target.value })}
                          />
                        </div>
                      </div>

                      {formData.type === 'EXECUTION' && (
                        <div className="responsive-input-grid" style={{ gap: '1rem', marginTop: '1rem' }}>
                          <div className="input-group" style={{ marginBottom: 0 }}>
                            <label>Name of Contractor</label>
                            <input
                              className={validationErrors.includes('contractorName') ? 'input-error' : ''}
                              value={formData.contractorName}
                              onChange={e => setFormData({ ...formData, contractorName: sanitizeName(e.target.value) })}
                            />
                          </div>
                          <div className="input-group" style={{ marginBottom: 0 }}>
                            <label>Contractor Mobile</label>
                            <input
                              className={(formData.contractorMobile && formData.contractorMobile.length !== 10) ? 'input-error' : ''}
                              maxLength="10"
                              placeholder="10-digit mobile"
                              value={formData.contractorMobile}
                              onChange={e => setFormData({ ...formData, contractorMobile: sanitizeMobile(e.target.value) })}
                            />
                            {formData.contractorMobile && formData.contractorMobile.length !== 10 && (
                              <p style={{ color: 'var(--error)', fontSize: '0.7rem', marginTop: '0.3rem', fontWeight: 600 }}>Must be exactly 10 digits</p>
                            )}
                          </div>
                        </div>
                      )}

                      {formData.type === 'CONSULTANCY' && (
                        <div className="responsive-input-grid" style={{ gap: '1rem', marginTop: '1rem' }}>
                          <div className="input-group" style={{ marginBottom: 0 }}>
                            <label>Name of Consultant</label>
                            <input
                              className={validationErrors.includes('consultantName') ? 'input-error' : ''}
                              value={formData.consultantName}
                              onChange={e => setFormData({ ...formData, consultantName: sanitizeName(e.target.value) })}
                            />
                          </div>
                          <div className="input-group" style={{ marginBottom: 0 }}>
                            <label>Consultant Mobile</label>
                            <input
                              className={(formData.consultantMobile && formData.consultantMobile.length !== 10) ? 'input-error' : ''}
                              maxLength="10"
                              placeholder="10-digit mobile"
                              value={formData.consultantMobile}
                              onChange={e => setFormData({ ...formData, consultantMobile: sanitizeMobile(e.target.value) })}
                            />
                            {formData.consultantMobile && formData.consultantMobile.length !== 10 && (
                              <p style={{ color: 'var(--error)', fontSize: '0.7rem', marginTop: '0.3rem', fontWeight: 600 }}>Must be exactly 10 digits</p>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="glass-card" style={{ background: 'rgba(255,255,255,0.03)', marginTop: '1.5rem', padding: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <YesNoToggle
                          label="Has Project Work Officially Started at Site?"
                          value={formData.workStarted || 'No'}
                          onChange={val => setFormData({ ...formData, workStarted: val })}
                        />

                        {formData.workStarted === 'No' && (
                          <div className="fade-in" style={{ marginTop: '1rem', background: 'rgba(255,0,0,0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,0,0,0.1)' }}>
                            <label style={{ display: 'block', marginBottom: '1rem', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', letterSpacing: '0.5px' }}>Reason for Delay</label>
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
                                    const current = formData.delayReasons || [];
                                    if (current.includes(reason)) {
                                      setFormData({ ...formData, delayReasons: current.filter(r => r !== reason) });
                                    } else {
                                      setFormData({ ...formData, delayReasons: [...current, reason] });
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
                                    checked={(formData.delayReasons || []).includes(reason)}
                                    onChange={(e) => {
                                      const current = formData.delayReasons || [];
                                      if (e.target.checked) {
                                        setFormData({ ...formData, delayReasons: [...current, reason] });
                                      } else {
                                        setFormData({ ...formData, delayReasons: current.filter(r => r !== reason) });
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
                                  placeholder="Please provide specific details about the delay (minimum 5 characters)..."
                                  value={formData.delayBrief || ''}
                                  onChange={e => setFormData({ ...formData, delayBrief: e.target.value })}
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
                    </>
                  )}
                </div>
              ) : (
                <div className="input-group" style={{ marginTop: '1rem', marginBottom: 0 }}>
                  <label>Reason for Delay (Mandatory)</label>
                  <textarea
                    placeholder="Enter delay justification..."
                    value={w.reason}
                    onChange={e => {
                      const newW = [...workflows];
                      newW[idx].reason = e.target.value;
                      setWorkflows(newW);
                    }}
                    style={{ minHeight: '60px', padding: '0.5rem' }}
                  />
                </div>
              )}
            </div>

            {formData.type === 'CONSULTANCY' && w.stepName === 'A&F Received' && (
              <div className="glass-card fade-in" style={{ padding: '1.25rem', marginBottom: '1.5rem', background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '0.5rem', display: 'block' }}>Consultancy Selection Source</label>
                <select
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                  value={formData.consultancySource}
                  onChange={e => {
                    const source = e.target.value;
                    setFormData({ ...formData, consultancySource: source });

                    const base = [workflows[0]];
                    let tail = [];
                    if (source === 'SINGLE_SOURCE') {
                      tail = [
                        { stepName: 'Work Order Issued', isCompleted: false, value: 'No', reason: '', date: '' },
                        { stepName: 'Draft DPR Submitted', isCompleted: false, value: 'No', reason: '', date: '' },
                        { stepName: 'Draft DPR Approved', isCompleted: false, value: 'No', reason: '', date: '' },
                        { stepName: 'Final DPR Submitted', isCompleted: false, value: 'No', reason: '', date: '' },
                        { stepName: 'Final DPR Approved', isCompleted: false, value: 'No', reason: '', date: '' }
                      ];
                    } else {
                      tail = [
                        { stepName: 'NIT Published', isCompleted: false, value: 'No', reason: '', date: '' },
                        { stepName: 'Tender Opened', isCompleted: false, value: 'No', reason: '', date: '' },
                        { stepName: 'Work Order Issued', isCompleted: false, value: 'No', reason: '', date: '' },
                        { stepName: 'Draft DPR Submitted', isCompleted: false, value: 'No', reason: '', date: '' },
                        { stepName: 'Draft DPR Approved', isCompleted: false, value: 'No', reason: '', date: '' },
                        { stepName: 'Final DPR Submitted', isCompleted: false, value: 'No', reason: '', date: '' },
                        { stepName: 'Final DPR Approved', isCompleted: false, value: 'No', reason: '', date: '' }
                      ];
                    }
                    setWorkflows([...base, ...tail]);
                  }}
                >
                  <option value="NIT">NIT (Public Tender)</option>
                  <option value="SINGLE_SOURCE">Single Source / Direct Nomination</option>
                </select>
              </div>
            )}
          </React.Fragment>
        );
      })}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
        <button className="btn btn-ghost" onClick={() => setStep(1)}>Back</button>
        <button className="btn" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.2)' }} onClick={() => handleSave(false)}>
          Quick Save
        </button>
        {formData.type === 'EXECUTION' && formData.workStarted === 'Yes' ? (
          <button className="btn btn-primary" style={{ flex: 1, background: 'var(--success)', color: 'white' }} onClick={() => {
            if (workflows.find(w => w.stepName === 'Work Order Issued')?.value === 'Yes') {
              if (!formData.actualStartDate || !formData.stipulatedCompletionDate) {
                alert('Please provide the Work Start Date (As per Work Order) and Stipulated Completion Date.');
                return;
              }
              if (new Date(formData.actualStartDate) > new Date(formData.stipulatedCompletionDate)) {
                alert('Critical Error: Work Start Date (As per Work Order) cannot be later than the Stipulated Completion Date.');
                return;
              }

              if (formData.type === 'EXECUTION') {
                if (!formData.contractorName || !formData.contractorMobile) {
                  alert('Please provide Name of Contractor and Contractor Mobile number.');
                  return;
                }
                if (!validateMobile(formData.contractorMobile, 'Contractor Mobile')) return;
              }
              if (formData.type === 'CONSULTANCY') {
                if (!formData.consultantName || !formData.consultantMobile) {
                  alert('Please provide Name of Consultant and Consultant Mobile number.');
                  return;
                }
                if (!validateMobile(formData.consultantMobile, 'Consultant Mobile')) return;
              }
            }
            if (!validateWorkStarted()) return;

            // --- STRICT WORKFLOW VALIDATION ---
            let visibleCount = 1;
            for (let i = 0; i < workflows.length - 1; i++) {
              if (workflows[i].value === 'Yes' && workflows[i].date) {
                visibleCount++;
              } else if (formData.type === 'CONSULTANCY' && workflows[i].stepName === 'Technical Sanction') {
                visibleCount++;
              } else {
                break;
              }
            }

            const visibleWorkflows = workflows.slice(0, visibleCount);
            for (const w of visibleWorkflows) {
              if (formData.type === 'CONSULTANCY' && w.stepName === 'Technical Sanction') continue;

              if (w.value === 'Yes' && !w.date) {
                alert(`Dhyan dein: "${getStepDisplayName(w.stepName)}" ke liye Date of Achievement mention karna anivarya hai.`);
                return;
              }
              if (w.value === 'No') {
                if (!w.reason || w.reason.trim().length < 5) {
                  alert(`Dhyan dein: "${getStepDisplayName(w.stepName)}" ke liye Reason for Delay mention karna anivarya hai (at least 5 characters).`);
                  return;
                }
              }
            }

            setStep(3);
          }}>Next: Define PERT Schedule</button>
        ) : (
          <button className="btn btn-primary" style={{ flex: 1, background: 'var(--primary)' }} onClick={() => {
            handleSave(true);
          }}>
            Finalize Registration
          </button>
        )}
      </div>
    </div>
  );

  const renderStep3 = () => {
    const totalW = pert.reduce((s, p) => s + (parseFloat(p.weightage) || 0), 0);
    const isValid = Math.abs(totalW - 100) < 0.01;

    return (
      <div className="fade-in">
        <h2 style={{ marginBottom: '1.5rem' }}>Step 3: Define PERT Activities</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Create your project schedule by adding activities and their specific timelines.</p>

        <div className="glass-card" style={{ marginBottom: '1.5rem', background: isValid ? 'rgba(76,175,80,0.1)' : 'rgba(255,152,0,0.1)', border: isValid ? '1px solid var(--success)' : '1px solid var(--warning)' }}>
          <p style={{ fontWeight: 600, color: isValid ? 'var(--success)' : 'var(--warning)', textAlign: 'center', margin: '0.5rem' }}>
            Total Weightage: {totalW}% {isValid ? ' (Ready for Finalization)' : ' (Must be exactly 100%)'}
          </p>
        </div>

        {pert.map((p, idx) => (
          <div key={idx} className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem', position: 'relative', background: 'var(--bg-deep)' }}>
            {pert.length > 1 && (
              <button
                onClick={() => removePertRow(idx)}
                title="Remove Row"
                style={{ position: 'absolute', right: '1rem', top: '1rem', background: 'rgba(255,100,100,0.1)', border: 'none', color: 'var(--error)', cursor: 'pointer', borderRadius: '4px', padding: '0.25rem 0.5rem' }}
              >
                Remove Item
              </button>
            )}

            <div className="input-group">
              <label>Activity Name (Project Specific)</label>
              <input value={p.name} onChange={e => {
                const n = [...pert];
                n[idx].name = e.target.value;
                setPert(n);
              }} placeholder="Describe the activity..." />
            </div>

            <div className="responsive-grid-auto" style={{ gap: '1rem' }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Weightage (%)</label>
                <input type="number" value={p.weightage} onChange={e => {
                  const n = [...pert];
                  n[idx].weightage = e.target.value;
                  setPert(n);
                }} placeholder="e.g. 25" />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Calendar size={14} color="var(--primary)" /> Work Start Date (As per Work Order)
                </label>
                <input type="date" min="1900-01-01" max="2099-12-31" value={formatDateForInput(p.startDate)} onChange={e => {
                  const n = [...pert];
                  n[idx].startDate = e.target.value;
                  setPert(n);
                }} />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Calendar size={14} color="var(--primary)" /> Date of Completion
                </label>
                <input
                  type="date"
                  min={formatDateForInput(p.startDate) || "1900-01-01"}
                  max="2099-12-31"
                  value={formatDateForInput(p.endDate)}
                  onChange={e => {
                    const n = [...pert];
                    n[idx].endDate = e.target.value;
                    setPert(n);
                  }}
                />
                {p.startDate && p.endDate && new Date(p.endDate) < new Date(p.startDate) && (
                  <p style={{ color: 'var(--error)', fontSize: '0.7rem', marginTop: '0.3rem', fontWeight: 600 }}>
                    Completion cannot be before Start
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}

        <button
          className="btn"
          style={{ width: '100%', marginBottom: '2rem', border: '1px dashed rgba(255,255,255,0.2)', background: 'none', color: 'var(--text-muted)' }}
          onClick={addPertRow}
        >
          + Add New Activity Row
        </button>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-ghost" onClick={() => setStep(2)}>Back</button>
          <button className="btn" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.2)' }} onClick={() => handleSave(false)}>
            Quick Save
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 1, background: isValid ? 'var(--success)' : 'var(--btn-ghost-bg)', color: isValid ? 'white' : 'var(--text-muted)', opacity: isValid ? 1 : 0.7 }}
            onClick={() => {
              if (!isValid) return alert(`Total weightage is ${totalW}%. It must be exactly 100%.`);

              for (const p of pert) {
                if (new Date(p.startDate) > new Date(p.endDate)) {
                  alert(`Error in Activity "${p.name}": Start Date cannot be later than Completion Date.`);
                  return;
                }
              }

              handleSave(true);
            }}
          >
            Finalize and Create Project Schedule
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem 1rem 4rem 1rem' }}>
      <div
        className="glass-card fade-in-up"
        style={{
          width: '100%',
          maxWidth: '680px',
          padding: '2.5rem 2rem'
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2.5rem', position: 'sticky', top: 0, background: 'var(--card-bg)', zIndex: 10, paddingBottom: '1rem' }}>
          {[1, 2, 3].map(s => <div key={s} style={{ flex: 1, height: '4px', borderRadius: 2, background: step >= s ? 'var(--primary)' : 'var(--glass-bg)' }}></div>)}
        </div>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </div>
    </div>
  );
}
