import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TelemetryData } from '../types';

export const generateInspectionCertificate = (data: TelemetryData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Primary Header Banner
  doc.setFillColor(11, 15, 25); // Dark blue / slate
  doc.rect(0, 0, pageWidth, 40, 'F');

  // Title
  doc.setTextColor(6, 182, 212); // Cyan
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('AQUASURE WATER QUALITY AUDIT', 14, 20);

  doc.setTextColor(200, 200, 200);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Low-Cost Multi-Sensor Edge Anomaly Detection & Screening System', 14, 28);

  // Metadata block
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(10);
  doc.text(`Generated Timestamp: ${new Date().toLocaleString()}`, 14, 50);
  doc.text(`Edge Controller: ESP32 DevKit V1 (240MHz, ADC1 Calibrated)`, 14, 56);
  doc.text(`Hardware Node ID: ${data.device_id}`, 14, 62);

  // Verdict Stamp
  const isPass = data.state === 'NORMAL';
  const verdictText = isPass ? 'VERDICT: PASS (NOMINAL BASELINE)' : `VERDICT: ${data.state} DETECTED`;
  const verdictColor: [number, number, number] = isPass ? [16, 185, 129] : [244, 63, 94];

  doc.setFillColor(...verdictColor);
  doc.roundedRect(pageWidth - 90, 48, 76, 18, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(verdictText, pageWidth - 86, 59);

  // Executive Summary
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(13);
  doc.text('1. Telemetry & Anomaly Metrics', 14, 76);

  // Table of sensor measurements
  autoTable(doc, {
    startY: 82,
    head: [['Parameter', 'Measured Value', 'Baseline Target', 'Normalized Deviation (Z)', 'Status']],
    body: [
      ['Optical Turbidity', `${data.turbidity_ntu.toFixed(1)} NTU`, '< 5.0 NTU', `z = ${data.z_turb.toFixed(2)}`, data.z_turb > 2.0 ? 'ELEVATED' : 'PASS'],
      ['TDS / Conductivity', `${data.tds_ppm.toFixed(1)} ppm`, '50 - 300 ppm', `z = ${data.z_tds.toFixed(2)}`, data.z_tds > 2.0 ? 'ELEVATED' : 'PASS'],
      ['Water Temperature', `${data.temp_c.toFixed(1)} °C`, '25.0 °C Ref', `z = ${data.z_temp.toFixed(2)}`, 'STABLE'],
      ['Composite Anomaly (S)', `${data.anomaly_score.toFixed(2)}`, 'S < 1.50', 'Euclidean Fusion', data.anomaly_score >= 1.5 ? 'ANOMALY' : 'NORMAL'],
      ['Water Quality Index (WQI)', `${data.wqi.toFixed(1)} / 100`, 'WQI >= 90 (Grade A)', data.wqi_grade, data.wqi >= 75 ? 'NOMINAL' : 'ALERT'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 4 },
  });

  // Diagnostic Fingerprint Section
  const finalY = (doc as any).lastAutoTable.finalY + 14;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Smart Contaminant Diagnosis', 14, finalY);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(`Identified Signature: ${data.contaminant_signature}`, 14, finalY + 8);
  doc.text(
    'Classification Rationale: Algorithmic cross-correlation of optical transmittance and AC conductivity front-ends distinguishes physical sediment/silt particulate suspension from ionic mineral/saline ingress.',
    14,
    finalY + 15,
    { maxWidth: pageWidth - 28 }
  );

  // Regulatory Disclaimer (from JalRakshak Spec Section 1)
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  const disclaimerY = finalY + 36;
  doc.text(
    'SAFETY AND TECHNICAL LIMITATION NOTICE:\nAquaSure is an embedded engineering instrument designed for comparative screening and anomaly detection relative to established baselines. It does not certify official potability or microbiological compliance under ISO/BIS standards. Official potability determination requires certified laboratory analysis.',
    14,
    disclaimerY,
    { maxWidth: pageWidth - 28 }
  );

  // Signature Block
  const sigY = disclaimerY + 28;
  doc.setDrawColor(180, 180, 180);
  doc.line(14, sigY, 70, sigY);
  doc.line(pageWidth - 70, sigY, pageWidth - 14, sigY);

  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  doc.text('Inspecting Engineer / Operator', 14, sigY + 6);
  doc.text('Client Representative / Buyer', pageWidth - 70, sigY + 6);

  // Save PDF
  doc.save(`AquaSure_Audit_Certificate_${Date.now()}.pdf`);
};
