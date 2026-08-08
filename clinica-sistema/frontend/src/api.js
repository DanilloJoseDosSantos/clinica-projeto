const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export async function loginUser(username, password) {
  const response = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return response.json();
}

export async function getCurrentUser(token) {
  const response = await fetch(`${API_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function getPatients(token) {
  const response = await fetch(`${API_URL}/patients`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function createPatient(token, patient) {
  const response = await fetch(`${API_URL}/patients`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(patient),
  });
  return response.json();
}

export async function getCalls(token) {
  const response = await fetch(`${API_URL}/calls`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function getPublicCalls() {
  const response = await fetch(`${API_URL}/public/calls`);
  return response.json();
}

export async function createCall(token, patientId, room) {
  const response = await fetch(`${API_URL}/calls?patient_id=${encodeURIComponent(patientId)}&room=${encodeURIComponent(room)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function getReports(token) {
  const response = await fetch(`${API_URL}/reports`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function getAuditDocuments(token) {
  const response = await fetch(`${API_URL}/audit-documents`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function getPrescriptions(token) {
  const response = await fetch(`${API_URL}/prescriptions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function getGuides(token) {
  const response = await fetch(`${API_URL}/guides`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function getGuidePrintData(token, guideId) {
  const response = await fetch(`${API_URL}/guides/${guideId}/print-data`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function downloadGuidePdf(token, guideId) {
  const response = await fetch(`${API_URL}/guides/${guideId}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response;
}

export async function getGuidePrintHistory(token, guideId) {
  const response = await fetch(`${API_URL}/guides/${guideId}/print-history`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function getGlobalGuidePrintHistory(token, filters = {}) {
  const params = new URLSearchParams();
  if (filters.start_date) params.set("start_date", filters.start_date);
  if (filters.end_date) params.set("end_date", filters.end_date);
  if (filters.printed_by) params.set("printed_by", filters.printed_by);
  if (filters.action) params.set("action", filters.action);
  if (filters.guide_id) params.set("guide_id", String(filters.guide_id));
  if (filters.page) params.set("page", String(filters.page));
  if (filters.page_size) params.set("page_size", String(filters.page_size));

  const queryString = params.toString();
  const response = await fetch(`${API_URL}/guides/print-history/global${queryString ? `?${queryString}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function downloadGlobalGuidePrintHistoryCsv(token, filters = {}) {
  const params = new URLSearchParams();
  if (filters.start_date) params.set("start_date", filters.start_date);
  if (filters.end_date) params.set("end_date", filters.end_date);
  if (filters.printed_by) params.set("printed_by", filters.printed_by);
  if (filters.action) params.set("action", filters.action);
  if (filters.guide_id) params.set("guide_id", String(filters.guide_id));

  const queryString = params.toString();
  const response = await fetch(`${API_URL}/guides/print-history/global/csv${queryString ? `?${queryString}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response;
}

export async function getUsers(token) {
  const response = await fetch(`${API_URL}/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function getProfessionals(token) {
  const response = await fetch(`${API_URL}/professionals`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function getAppointments(token) {
  const response = await fetch(`${API_URL}/appointments`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function getWorkflowBoard(token) {
  const response = await fetch(`${API_URL}/workflow/board`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function createAppointment(token, payload) {
  const response = await fetch(`${API_URL}/appointments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function checkInAppointment(token, appointmentId, payload) {
  const response = await fetch(`${API_URL}/appointments/${appointmentId}/check-in`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function callAppointment(token, appointmentId, payload) {
  const response = await fetch(`${API_URL}/appointments/${appointmentId}/call`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function callTriage(token, appointmentId, payload) {
  const response = await fetch(`${API_URL}/appointments/${appointmentId}/triage/call`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function saveTriage(token, appointmentId, payload) {
  const response = await fetch(`${API_URL}/appointments/${appointmentId}/triage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function getMedicalRecords(token) {
  const response = await fetch(`${API_URL}/medical-records`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function saveMedicalRecord(token, appointmentId, payload) {
  const response = await fetch(`${API_URL}/appointments/${appointmentId}/medical-record`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function addMedicalRecordAttachment(token, appointmentId, payload) {
  const response = await fetch(`${API_URL}/appointments/${appointmentId}/attachments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function getTreasuryEntries(token) {
  const response = await fetch(`${API_URL}/treasury`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function saveTreasuryEntry(token, appointmentId, payload) {
  const response = await fetch(`${API_URL}/appointments/${appointmentId}/treasury`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function createPrescription(token, patientId, issuedBy) {
  const response = await fetch(`${API_URL}/prescriptions?patient_id=${encodeURIComponent(patientId)}&issued_by=${encodeURIComponent(issuedBy)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function createGuide(token, payload) {
  const response = await fetch(`${API_URL}/guides`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function createUser(token, payload) {
  const response = await fetch(`${API_URL}/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function getAdminSummary(token) {
  const response = await fetch(`${API_URL}/admin/summary`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function getStockItems(token) {
  const response = await fetch(`${API_URL}/stock-items`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function createStockItem(token, payload) {
  const response = await fetch(`${API_URL}/stock-items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function registerStockMovement(token, itemId, payload) {
  const response = await fetch(`${API_URL}/stock-items/${itemId}/movement`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return response.json();
}
