import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { ReverseGeocode } from '../common/UIHelpers';
import { getProjectStage } from '../../utils/workflowUtils';
import html2pdf from 'html2pdf.js';

const reportTableThStyle = { border: '1px solid #000', padding: '8px 10px', textAlign: 'left', fontWeight: '800', color: '#000', fontSize: '9pt', textTransform: 'uppercase', background: '#f3f4f6' };
const reportTableTdStyle = { border: '1px solid #000', padding: '8px 10px', textAlign: 'left', color: '#000', fontSize: '9.5pt', lineHeight: '1.4' };
const sectionHeaderStyle = { fontSize: '11pt', fontWeight: '900', borderBottom: '2px solid #000', paddingBottom: '0.4rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.5px' };

export default function OfficialReportView({ projects, onClose }) {
  const isConsolidated = projects.length > 1;
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const [scale, setScale] = useState(1);
  const [reportHeight, setReportHeight] = useState(1122);

  useEffect(() => {
    const updateLayout = () => {
      const containerWidth = 794;
      const availableWidth = window.innerWidth - 20;
      if (availableWidth < containerWidth) {
        setScale(availableWidth / containerWidth);
      } else {
        setScale(1);
      }

      const el = document.getElementById("official-report-container");
      if (el) setReportHeight(el.scrollHeight);
    };

    updateLayout();
    const timer = setTimeout(updateLayout, 500);
    window.addEventListener('resize', updateLayout);
    return () => {
      window.removeEventListener('resize', updateLayout);
      clearTimeout(timer);
    };
  }, [projects]);

  useEffect(() => {
    const handlePrintPrepare = () => {
      const el = document.getElementById("official-report-container");
      if (el) {
        const A4_HEIGHT = 1122;
        const contentHeight = el.scrollHeight;
        const scalePrint = Math.min(1, A4_HEIGHT / contentHeight);
        el.dataset.printScale = scalePrint;
      }
    };
    handlePrintPrepare();
  }, [projects]);

  const renderDynamicReportFields = (project, locations = ['MASTER', 'AFTER_NAME', 'AFTER_BRIEF', 'AFTER_FUNDING', 'AFTER_COST', 'AFTER_EE', 'AFTER_CONSULTANT', 'AFTER_CONTRACTOR', 'AFTER_DATES', 'BOTTOM', 'UPDATE_PROGRESS', 'UPDATE_STATUS']) => {
    if (!project || !project.configVersion || !project.configVersion.fields) return null;
    try {
      const fieldData = typeof project.fieldData === 'string' ? JSON.parse(project.fieldData || '{}') : (project.fieldData || {});
      const fields = project.configVersion.fields.filter(f => f.isActive && locations.includes(f.location) && fieldData[f.fieldKey]);
      if (fields.length === 0) return null;

      return (
        <div className="report-section" style={{ marginBottom: '1.5rem', breakInside: 'avoid' }}>
          <h4 style={sectionHeaderStyle}>ADDITIONAL PROJECT PARAMETERS</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt' }}>
            <tbody>
              {Array.from({ length: Math.ceil(fields.length / 2) }).map((_, rowIndex) => (
                <tr key={rowIndex}>
                  <td style={{ ...reportTableTdStyle, width: '25%', fontWeight: 'bold', background: '#f9fafb' }}>{fields[rowIndex * 2].displayName}</td>
                  <td style={{ ...reportTableTdStyle, width: '25%' }}>{fieldData[fields[rowIndex * 2].fieldKey]}</td>
                  {fields[rowIndex * 2 + 1] ? (
                    <>
                      <td style={{ ...reportTableTdStyle, width: '25%', fontWeight: 'bold', background: '#f9fafb' }}>{fields[rowIndex * 2 + 1].displayName}</td>
                      <td style={{ ...reportTableTdStyle, width: '25%' }}>{fieldData[fields[rowIndex * 2 + 1].fieldKey]}</td>
                    </>
                  ) : (
                    <><td style={reportTableTdStyle}></td><td style={reportTableTdStyle}></td></>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    } catch (e) { return null; }
  };

  return (
    <div className="report-overlay" style={{
      position: 'fixed', inset: 0, background: '#f1f5f9', zIndex: 3000,
      overflowY: 'auto', overflowX: 'hidden', paddingBottom: '4rem'
    }}>
      <div className="no-print" style={{
        position: 'sticky', top: '0.5rem', left: 0, right: 0,
        display: 'flex', justifyContent: 'center', gap: '0.4rem',
        zIndex: 3100, padding: '0.4rem', margin: '0 auto', width: 'fit-content',
        background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(10px)',
        borderRadius: '2rem', boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <button className="btn" style={{
          background: '#3b82f6', color: 'white', fontWeight: 'bold',
          fontSize: '0.65rem', padding: '0.35rem 0.7rem', minWidth: 'auto', borderRadius: '1.5rem', border: 'none'
        }} onClick={() => window.print()}>PRINT</button>

        <button className="btn" style={{
          background: '#10b981', color: 'white', fontWeight: 'bold',
          fontSize: '0.65rem', padding: '0.35rem 0.7rem', minWidth: 'auto', borderRadius: '1.5rem', border: 'none'
        }} onClick={() => {
          const element = document.getElementById('official-report-container');
          if (html2pdf) {
            const opt = {
              margin: [10, 10, 10, 10],
              filename: `KDA_Report_${new Date().toISOString().split('T')[0]}.pdf`,
              image: { type: 'jpeg', quality: 0.98 },
              html2canvas: { scale: 2, useCORS: true, width: 794, windowWidth: 794 },
              jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            html2pdf().set(opt).from(element).save();
          } else {
            alert('PDF Library not loaded');
          }
        }}>PDF</button>

        <button className="btn" style={{
          background: '#ef4444', color: 'white', fontWeight: 'bold',
          fontSize: '0.65rem', padding: '0.35rem 0.7rem', minWidth: 'auto', borderRadius: '1.5rem', border: 'none'
        }} onClick={onClose}>EXIT</button>
      </div>

      <div style={{
        width: '100%', display: 'flex', justifyContent: 'center',
        padding: scale < 1 ? '0' : '1.5rem', boxSizing: 'border-box'
      }}>
        <div id="official-report-container" style={{
          width: '794px', minHeight: '1122px', background: '#ffffff',
          color: '#000',
          padding: '40px', position: 'relative',
          borderRadius: '0', boxSizing: 'border-box',
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          boxShadow: scale < 1 ? 'none' : '0 0 40px rgba(0,0,0,0.1)',
          marginBottom: scale < 1 ? `calc(${reportHeight}px * (1 - ${scale}) * -1)` : '0'
        }}>
          <style dangerouslySetInnerHTML={{
            __html: `
            #official-report-container table { display: table !important; width: 100% !important; border-collapse: collapse !important; margin-bottom: 1rem !important; background: transparent !important; }
            #official-report-container tr { display: table-row !important; border: none !important; padding: 0 !important; }
            #official-report-container td, #official-report-container th { display: table-cell !important; padding: 8px !important; border: 1px solid #000 !important; color: #000 !important; text-align: left !important; }
            #official-report-container * { color: #000 !important; }
            @media screen and (max-width: 768px) {
              #official-report-container { width: 100% !important; transform: none !important; min-height: auto !important; padding: 15px !important; margin-bottom: 40px !important; }
              #official-report-container table { display: block !important; overflow-x: auto !important; white-space: nowrap !important; }
              .report-overlay { overflow-x: hidden !important; padding-bottom: 2rem !important; }
              .report-header-container { flex-direction: column !important; align-items: flex-start !important; gap: 1rem !important; }
              .report-header-left { gap: 0.5rem !important; }
              .report-header-logo { height: 40px !important; }
              .report-header-title { font-size: 13pt !important; line-height: 1.2 !important; }
              .report-header-subtitle { font-size: 7.5pt !important; white-space: normal !important; }
              .report-header-doc { font-size: 10.5pt !important; }
              .report-header-meta { text-align: left !important; }
            }
            @media print {
              body { background: white !important; margin: 0 !important; padding: 0 !important; }
              body * { visibility: hidden !important; }
              #official-report-container, #official-report-container * { visibility: visible !important; }
              #official-report-container { 
                position: absolute !important; 
                left: 0 !important; 
                top: 0 !important; 
                width: 100% !important; 
                transform: none !important; 
                margin: 0 !important; 
                padding: 10px !important; 
                box-shadow: none !important; 
              }
              .no-print { display: none !important; }
            }
          `}} />

          <div className="report-header-container" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '2px solid #000', paddingBottom: '1rem', marginBottom: '1rem'
          }}>
            <div className="report-header-left" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <img className="report-header-logo" src="/logo.png" alt="KDA Logo" style={{ height: '70px', width: 'auto' }} />
              <div style={{ textAlign: 'left' }}>
                <h1 className="report-header-title" style={{ margin: 0, fontSize: '20pt', fontWeight: '800', textTransform: 'uppercase', color: '#000' }}>Kota Development Authority</h1>
                <p className="report-header-subtitle" style={{ margin: 0, fontSize: '9pt', color: '#444' }}>Drishti - Project Monitoring & Evaluation System</p>
                <h2 className="report-header-doc" style={{ margin: '0.25rem 0 0 0', fontSize: '13pt', fontWeight: '700', color: '#000', textDecoration: 'underline' }}>Official Project Progress Report</h2>
              </div>
            </div>
            <div className="report-header-meta" style={{ textAlign: 'right', color: '#000' }}>
              <p style={{ margin: 0, fontSize: '9pt', fontWeight: 'bold', color: '#000' }}>Report ID: KDA/D/2026/2883</p>
              <p style={{ margin: 0, fontSize: '9pt', color: '#000' }}>Date: {today}</p>
            </div>
          </div>

          <div style={{
            background: '#f3f4f6', padding: '0.75rem', border: '1px solid #d1d5db',
            borderRadius: '4px', textAlign: 'center', marginBottom: '1.5rem'
          }}>
            <h3 style={{ margin: 0, fontSize: '13pt', fontWeight: '800', color: '#111827', textTransform: 'uppercase' }}>
              PROJECT: {isConsolidated ? 'CONSOLIDATED ADMINISTRATIVE SUMMARY' : projects[0].name}
            </h3>
          </div>

          {isConsolidated && (
            <div className="report-section" style={{ marginBottom: '1.5rem' }}>
              <p style={{ fontSize: '10pt', fontStyle: 'italic', color: '#444' }}>
                This document provides a consolidated progress assessment for {projects.length} selected projects under Kota Development Authority as of {today}.
              </p>
            </div>
          )}

          {isConsolidated && (
            <section style={{ marginBottom: '4rem' }}>
              <h3 style={{ fontSize: '14pt', fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: '0.5rem', marginBottom: '1rem' }}>I. EXECUTIVE SUMMARY TABLE</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11pt' }}>
                <thead>
                  <tr>
                    <th style={reportTableThStyle}>S.No</th>
                    <th style={reportTableThStyle}>Project Name</th>
                    <th style={reportTableThStyle}>Cost (Lakhs)</th>
                    <th style={reportTableThStyle}>Phys. Progress (%)</th>
                    <th style={reportTableThStyle}>Fin. Progress (%)</th>
                    <th style={reportTableThStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p, idx) => (
                    <tr key={p.id}>
                      <td style={reportTableTdStyle}>{idx + 1}</td>
                      <td style={reportTableTdStyle}>{p.name}</td>
                      <td style={reportTableTdStyle}>{p.estimatedCost}</td>
                      <td style={reportTableTdStyle}>{p.currentProgress}%</td>
                      <td style={reportTableTdStyle}>{p.financialProgress || '0'}%</td>
                      <td style={reportTableTdStyle}>{p.status === 'COMPLETED' ? 'COMPLETED' : (p.overallStatus || 'On Track')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {projects.map((p, idx) => (
            <div key={p.id} style={{ marginBottom: '2rem', pageBreakAfter: (idx < projects.length - 1) ? 'always' : 'auto' }}>
              <div style={{ marginBottom: '2.5rem', borderBottom: '1px solid #eee', paddingBottom: '2.5rem' }}>
                {isConsolidated && (
                  <h3 style={{
                    fontSize: '14pt', fontWeight: '900', background: '#334155', color: '#fff',
                    padding: '0.5rem 1rem', marginBottom: '1.5rem', borderRadius: '4px'
                  }}>
                    {idx + 1}. {p.name}
                  </h3>
                )}

                <div className="report-section" style={{ marginBottom: '1.5rem', breakInside: 'avoid' }}>
                  <h4 style={sectionHeaderStyle}>1. BASIC PROJECT INFORMATION</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
                    <tbody>
                      <tr>
                        <td style={{ ...reportTableTdStyle, width: '25%', fontWeight: 'bold' }}>Project ID</td>
                        <td style={{ ...reportTableTdStyle, width: '25%' }}>KDA-P-{p.id}</td>
                        <td style={{ ...reportTableTdStyle, width: '25%', fontWeight: 'bold' }}>Funding Agency</td>
                        <td style={{ ...reportTableTdStyle, width: '25%' }}>{p.fundingAgency || 'KDA'}</td>
                      </tr>
                      <tr>
                        <td style={{ ...reportTableTdStyle, width: '25%', fontWeight: 'bold' }}>Project Type</td>
                        <td style={{ ...reportTableTdStyle, width: '25%' }}>{p.type}</td>
                        <td style={{ ...reportTableTdStyle, width: '25%', fontWeight: 'bold' }}>Estimated Cost</td>
                        <td style={{ ...reportTableTdStyle, width: '25%' }}>INR {p.estimatedCost} Lakhs</td>
                      </tr>
                      <tr>
                        <td style={{ ...reportTableTdStyle, fontWeight: 'bold' }}>Location</td>
                        <td style={reportTableTdStyle} colSpan="3">{(() => {
                          const lat = p.gpsLat || (p.updates && p.updates[0]?.gpsLat);
                          const lon = p.gpsLong || (p.updates && p.updates[0]?.gpsLong);
                          return (lat !== null && lat !== undefined && lon !== null && lon !== undefined)
                            ? <ReverseGeocode lat={lat} lon={lon} />
                            : (p.type === 'EXECUTION' ? 'Rawatbhata Road, Kota, Ladpura Tehsil, Kota, Rajasthan, 324001, India' : 'Official Records, Kota')
                        })()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {renderDynamicReportFields(p)}

                <div className="report-section" style={{ marginBottom: '1.5rem', breakInside: 'avoid' }}>
                  <h4 style={sectionHeaderStyle}>2. KEY STAKEHOLDERS</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
                    <tbody>
                      <tr>
                        <td style={{ ...reportTableTdStyle, width: '25%', fontWeight: 'bold' }}>Executive Engineer</td>
                        <td style={{ ...reportTableTdStyle, width: '25%' }}>{p.inchargeName}</td>
                        <td style={{ ...reportTableTdStyle, width: '25%', fontWeight: 'bold' }}>Contact</td>
                        <td style={{ ...reportTableTdStyle, width: '25%' }}>{p.inchargeMobile}</td>
                      </tr>
                      <tr>
                        <td style={{ ...reportTableTdStyle, width: '25%', fontWeight: 'bold' }}>Technical Consultant</td>
                        <td style={{ ...reportTableTdStyle, width: '25%' }}>{p.consultantName || 'Internal'}</td>
                        <td style={{ ...reportTableTdStyle, width: '25%', fontWeight: 'bold' }}>Consultant Contact</td>
                        <td style={{ ...reportTableTdStyle, width: '25%' }}>{p.consultantMobile || '-'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="report-section" style={{ marginBottom: '1.5rem', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                  <h4 style={sectionHeaderStyle}>3. APPROVAL & MILESTONES</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        <th style={reportTableThStyle}>MILESTONE</th>
                        <th style={reportTableThStyle}>DATE</th>
                        <th style={reportTableThStyle}>REMARKS / DETAILS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const sorted = [...(p.workflows || [])].sort((a, b) => a.id - b.id);
                        const list = [];
                        sorted.forEach(w => {
                          list.push({
                            label: w.stepName,
                            date: (w.stageKey === 'WORK_ORDER' || w.stepName === 'Work Order Issued') ? (w.value === 'Yes' ? 'Yes' : 'No') : (w.value === 'Yes' && w.date ? new Date(w.date).toLocaleDateString('en-GB') : 'PENDING'),
                            remarks: w.value === 'Yes' ? 'Completed' : (w.reason ? `Pending: ${w.reason}` : 'Pending')
                          });

                          if (w.stageKey === 'WORK_ORDER' || w.stepName === 'Work Order Issued') {
                            list.push({
                              label: 'Work Start Date (As per Work Order)',
                              date: p.actualStartDate ? new Date(p.actualStartDate).toLocaleDateString('en-GB') : 'PENDING',
                              remarks: 'Master Record'
                            });
                          }
                        });
                        list.push({
                          label: 'Stipulated Completion Date',
                          date: p.stipulatedCompletionDate ? new Date(p.stipulatedCompletionDate).toLocaleDateString('en-GB') : 'PENDING',
                          remarks: 'Contractual Deadline'
                        });
                        return list;
                      })().map((m, i) => (
                        <tr key={i}>
                          <td style={reportTableTdStyle}>{m.label}</td>
                          <td style={reportTableTdStyle}>{m.date}</td>
                          <td style={reportTableTdStyle}>{m.remarks || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {p.type === 'EXECUTION' && (
                  <div className="report-section" style={{ marginBottom: '1.5rem', breakInside: 'avoid' }}>
                    <h4 style={sectionHeaderStyle}>4. PROGRESS STATUS</h4>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
                      <tbody>
                        <tr>
                          <td style={{ ...reportTableTdStyle, width: '25%', fontWeight: 'bold' }}>Physical Progress</td>
                          <td style={{ ...reportTableTdStyle, width: '25%' }}>{p.currentProgress}%</td>
                          <td style={{ ...reportTableTdStyle, width: '25%', fontWeight: 'bold' }}>Financial Progress</td>
                          <td style={{ ...reportTableTdStyle, width: '25%' }}>{p.financialProgress || '0'}%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="report-section" style={{ marginBottom: '1.5rem', breakInside: 'avoid' }}>
                  <h4 style={sectionHeaderStyle}>5. OVERALL OBSERVATIONS</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
                    <tbody>
                      <tr>
                        <td style={{ ...reportTableTdStyle, width: '25%', fontWeight: 'bold', background: (p.overallStatus === 'Delay' || p.overallStatus === 'On Hold') ? '#fef2f2' : 'transparent' }}>Current Status</td>
                        <td style={reportTableTdStyle}>{p.overallStatus || 'On Track'}</td>
                      </tr>
                      <tr>
                        <td style={{ ...reportTableTdStyle, width: '25%', fontWeight: 'bold' }}>Quality Sampling</td>
                        <td style={reportTableTdStyle}>
                          {(() => {
                            const fd = typeof p.fieldData === 'string' ? JSON.parse(p.fieldData || '{}') : (p.fieldData || {});
                            return fd.QUALITY_SAMPLING || p.qualitySampling || 'Not Recorded';
                          })()}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ ...reportTableTdStyle, width: '25%', fontWeight: 'bold' }}>Time Extension</td>
                        <td style={reportTableTdStyle}>
                          {(() => {
                            const fd = typeof p.fieldData === 'string' ? JSON.parse(p.fieldData || '{}') : (p.fieldData || {});
                            return fd.TIME_EXTENSION || p.timeExtension || 'No';
                          })()}
                        </td>
                      </tr>
                      {(p.overallStatus === 'Delay' || p.overallStatus === 'On Hold' || p.workStarted === 'No') && (
                        <>
                          <tr>
                            <td style={{ ...reportTableTdStyle, fontWeight: 'bold', background: '#fef2f2' }}>Reason for Delay</td>
                            <td style={reportTableTdStyle}>
                              <div style={{ fontWeight: '600' }}>
                                {p.statusDelayBrief || p.statusHoldReason || p.delayBrief || 'Awaiting initiation.'}
                              </div>
                            </td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="report-section" style={{ marginBottom: '1.5rem', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                  <h4 style={sectionHeaderStyle}>6. ANALYTIC PROJECT ASSESSMENT</h4>
                  <div style={{
                    background: '#f9fafb',
                    padding: '1.25rem', borderRadius: '4px', border: '1px solid #d1d5db',
                    lineHeight: 1.6, fontSize: '10pt', color: '#111827', textAlign: 'justify'
                  }}>
                    <p style={{ margin: 0 }}>
                      <strong>Executive Summary:</strong> As of {today}, the project <strong>"{p.name}"</strong> is
                      {p.overallStatus === 'Delay' ? (
                        <span> <strong> IN DELAY</strong>. {p.statusDelayBrief || p.delayBrief || "Specific delay reason not provided in system records."}</span>
                      ) : p.overallStatus === 'On Hold' ? (
                        <span> <strong> ON HOLD</strong>. {p.statusHoldReason || "Hold reason not recorded."}</span>
                      ) : p.currentProgress >= 100 ? (
                        <span> <strong> FULLY COMPLETED</strong>. Transitioned to maintenance phase.</span>
                      ) : (
                        <>
                          <span> currently in the <strong>{getProjectStage(p)}</strong> stage and is progressing as per the schedule.</span>
                          {p.type === 'EXECUTION' && (
                            <span style={{ display: 'block', marginTop: '0.4rem' }}> Current physical completion: {p.currentProgress}%.</span>
                          )}
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="signature-block" style={{ marginTop: '2.5rem', breakInside: 'avoid' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div style={{ borderTop: '1px solid #000', paddingTop: '0.5rem', width: '220px' }}>
                      <p style={{ margin: 0, fontWeight: 'bold', fontSize: '9.5pt' }}>{p.inchargeName}</p>
                      <p style={{ margin: 0, fontSize: '8.5pt' }}>{p.inchargeDesignation || 'Executive Engineer'}</p>
                      <p style={{ margin: 0, fontSize: '8pt', color: '#444' }}>Kota Development Authority</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontSize: '8.5pt', color: '#444' }}>Page generated by Drishti System</p>
                      <p style={{ margin: 0, fontSize: '8.5pt', color: '#444' }}>{today}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
