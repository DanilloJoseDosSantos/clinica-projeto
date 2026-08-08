import { useEffect, useState } from "react";
import TvCalls from "./TvCalls";
import { addMedicalRecordAttachment, callAppointment, callTriage, checkInAppointment, createAppointment, createGuide, createPatient, createPrescription, createStockItem, createUser, downloadGlobalGuidePrintHistoryCsv, downloadGuidePdf, getAdminSummary, getAppointments, getAuditDocuments, getCalls, getCurrentUser, getGlobalGuidePrintHistory, getGuidePrintData, getGuidePrintHistory, getGuides, getMedicalRecords, getPatients, getPrescriptions, getProfessionals, getPublicCalls, getReports, getStockItems, getTreasuryEntries, getUsers, getWorkflowBoard, loginUser, registerStockMovement, saveMedicalRecord, saveTreasuryEntry, saveTriage } from "./api";

function getDigits(value) {
  return value.replace(/\D/g, "");
}

function formatCpf(value) {
  const digits = getDigits(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatPhone(value) {
  const digits = getDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)})${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)})${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)})${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatBirthDate(value) {
  const digits = getDigits(value).slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseBirthDate(value) {
  const digits = getDigits(value);
  if (digits.length !== 8) return null;
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) return null;
  return date;
}

function isAdult(value) {
  const birthDate = parseBirthDate(value);
  if (!birthDate) return false;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  const dayDiff = today.getDate() - birthDate.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }
  return age >= 18;
}

const SESSION_STORAGE_KEY = "clinicaSistemaSessionToken";

export default function App() {
  const [isTvRoute, setIsTvRoute] = useState(window.location.hash === "#tv");
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [patients, setPatients] = useState([]);
  const [calls, setCalls] = useState([]);
  const [reports, setReports] = useState([]);
  const [auditDocuments, setAuditDocuments] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [guides, setGuides] = useState([]);
  const [guideHistoryById, setGuideHistoryById] = useState({});
  const [globalGuideAuditLogs, setGlobalGuideAuditLogs] = useState([]);
  const [globalGuideAuditFilter, setGlobalGuideAuditFilter] = useState({
    start_date: "",
    end_date: "",
    printed_by: "",
    action: "all",
    guide_id: "",
    page_size: "20",
  });
  const [globalGuideAuditMeta, setGlobalGuideAuditMeta] = useState({
    page: 1,
    page_size: 20,
    total_items: 0,
    total_pages: 1,
  });
  const [professionals, setProfessionals] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [records, setRecords] = useState([]);
  const [treasuryEntries, setTreasuryEntries] = useState([]);
  const [users, setUsers] = useState([]);
  const [publicQueue, setPublicQueue] = useState([]);
  const [adminSummary, setAdminSummary] = useState(null);
  const [stockItems, setStockItems] = useState([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(null);
  const [workflowError, setWorkflowError] = useState("");
  const [activeView, setActiveView] = useState("overview");
  const [unitFilter, setUnitFilter] = useState("all");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [form, setForm] = useState({
    name: "",
    cpf: "",
    phone: "",
    birth_date: "",
    address: "",
    consent_lgpd: true,
    responsible_name: "",
  });
  const [receptionForm, setReceptionForm] = useState({
    chief_complaint: "",
    plan_name: "",
    guide_code: "",
    signed_at_reception: false,
  });
  const [appointmentForm, setAppointmentForm] = useState({
    patient_id: "",
    professional_id: "",
    scheduled_at: "",
    unit_name: "Unidade Centro",
    shift: "manha",
    specialty: "",
    notes: "",
  });
  const [checkInPriority, setCheckInPriority] = useState("normal");
  const [callRoom, setCallRoom] = useState("");
  const [recordForm, setRecordForm] = useState({
    chief_complaint: "",
    anamnesis: "",
    vital_signs: "",
    allergies: "",
    physical_exam: "",
    current_medications: "",
    icd10_code: "",
    diagnosis: "",
    care_plan: "",
    prescriptions_summary: "",
    evolution_type: "evolucao",
    evolution_note: "",
    status: "finalizado",
  });
  const [triageForm, setTriageForm] = useState({
    chief_complaint: "",
    blood_pressure: "",
    heart_rate: "",
    temperature_c: "",
    oxygen_saturation: "",
    respiratory_rate: "",
    weight_kg: "",
    allergies: "",
    current_medications: "",
    triage_note: "",
  });
  const [attachmentForm, setAttachmentForm] = useState({
    title: "",
    category: "imagem",
    reference_url: "",
  });
  const [treasuryForm, setTreasuryForm] = useState({
    description: "",
    amount_cents: "",
    payment_method: "pix",
    status: "pendente",
    due_date: "",
    paid_at: "",
  });
  const [employeeForm, setEmployeeForm] = useState({
    name: "",
    username: "",
    password: "",
    role: "reception",
    cpf: "",
    address: "",
    labor_registry: "",
    crm: "",
    cre: "",
    contract_type: "CLT",
    admission_date: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    lgpd_consent: true,
    active: true,
  });
  const [stockForm, setStockForm] = useState({
    name: "",
    category: "medicamento",
    unit: "un",
    quantity: "0",
    min_quantity: "0",
  });
  const [stockMovementForm, setStockMovementForm] = useState({
    item_id: "",
    movement_type: "saida",
    amount: "1",
    note: "",
  });

  useEffect(() => {
    const handleHashChange = () => {
      setIsTvRoute(window.location.hash === "#tv");
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    const storedToken = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (storedToken) {
      setToken(storedToken);
      loadData(storedToken);
    }
  }, []);

  // Se a URL terminar com #tv, exibe diretamente a tela de chamados da TV
  if (isTvRoute) {
    return <TvCalls />;
  }

  const permissions = new Set(user?.permissions || []);
  const hasPermission = (...items) => items.some((item) => permissions.has(item));
  const isAdmin = user?.role === "admin";

  const viewOptions = [
    { key: "overview", label: "Visão geral", visible: true },
  ].filter((item) => item.visible);

  const safeFetch = async (loader, fallback) => {
    try {
      const data = await loader();
      return data?.detail ? fallback : data;
    } catch {
      return fallback;
    }
  };

  const loadData = async (authToken) => {
    const currentUser = await getCurrentUser(authToken);
    if (currentUser?.detail) {
      handleLogout(false);
      return;
    }
    setUser(currentUser);

    const userPermissions = new Set(currentUser.permissions || []);
    const can = (...items) => items.some((item) => userPermissions.has(item));

    const [patientData, callData, reportData, auditData, prescriptionData, guideData, appointmentData, professionalData, recordData, treasuryData, workflowData, usersData, summaryData, stockData, publicQueueData] = await Promise.all([
      can("patients:view") ? safeFetch(() => getPatients(authToken), []) : Promise.resolve([]),
      can("appointments:view") ? safeFetch(() => getCalls(authToken), []) : Promise.resolve([]),
      can("reports:view") ? safeFetch(() => getReports(authToken), []) : Promise.resolve([]),
      can("audit:view") ? safeFetch(() => getAuditDocuments(authToken), []) : Promise.resolve([]),
      can("documents:issue", "records:view") ? safeFetch(() => getPrescriptions(authToken), []) : Promise.resolve([]),
      can("documents:issue", "records:view") ? safeFetch(() => getGuides(authToken), []) : Promise.resolve([]),
      can("appointments:view") ? safeFetch(() => getAppointments(authToken), []) : Promise.resolve([]),
      can("appointments:view", "appointments:create") ? safeFetch(() => getProfessionals(authToken), []) : Promise.resolve([]),
      can("records:view") ? safeFetch(() => getMedicalRecords(authToken), []) : Promise.resolve([]),
      can("treasury:view") ? safeFetch(() => getTreasuryEntries(authToken), []) : Promise.resolve([]),
      can("appointments:view") ? safeFetch(() => getWorkflowBoard(authToken), []) : Promise.resolve([]),
      can("users:view") ? safeFetch(() => getUsers(authToken), []) : Promise.resolve([]),
      can("users:view") ? safeFetch(() => getAdminSummary(authToken), null) : Promise.resolve(null),
      can("stock:view") ? safeFetch(() => getStockItems(authToken), []) : Promise.resolve([]),
      can("appointments:view") ? safeFetch(() => getPublicCalls(), []) : Promise.resolve([]),
    ]);
    setPatients(patientData);
    setCalls(callData);
    setReports(reportData);
    setAuditDocuments(auditData);
    setPrescriptions(prescriptionData);
    setGuides(guideData);
    setAppointments(Array.isArray(workflowData) && workflowData.length > 0 ? workflowData : appointmentData);
    setProfessionals(Array.isArray(professionalData) ? professionalData : []);
    setRecords(Array.isArray(recordData) ? recordData : []);
    setTreasuryEntries(Array.isArray(treasuryData) ? treasuryData : []);
    setUsers(Array.isArray(usersData) ? usersData : []);
    setAdminSummary(summaryData && !summaryData.detail ? summaryData : null);
    setStockItems(Array.isArray(stockData) ? stockData : []);
    setPublicQueue(Array.isArray(publicQueueData) ? publicQueueData : []);
  };

  const selectedAppointment = appointments.find((item) => item.id === selectedAppointmentId) || appointments[0] || null;

  const units = Array.from(new Set(appointments.map((item) => item.unit_name).filter(Boolean)));

  const syncAppointment = (updatedAppointment) => {
    setAppointments((prev) => {
      const exists = prev.some((item) => item.id === updatedAppointment.id);
      if (!exists) {
        return [...prev, updatedAppointment];
      }
      return prev.map((item) => item.id === updatedAppointment.id ? updatedAppointment : item);
    });
    setSelectedAppointmentId(updatedAppointment.id);
  };

  const refreshOperationalViews = async (authToken) => {
    const [workflowData, callData, recordData, treasuryData, patientData, publicQueueData] = await Promise.all([
      hasPermission("appointments:view") ? safeFetch(() => getWorkflowBoard(authToken), []) : Promise.resolve([]),
      hasPermission("appointments:view") ? safeFetch(() => getCalls(authToken), []) : Promise.resolve([]),
      hasPermission("records:view") ? safeFetch(() => getMedicalRecords(authToken), []) : Promise.resolve([]),
      hasPermission("treasury:view") ? safeFetch(() => getTreasuryEntries(authToken), []) : Promise.resolve([]),
      hasPermission("patients:view") ? safeFetch(() => getPatients(authToken), []) : Promise.resolve([]),
      hasPermission("appointments:view") ? safeFetch(() => getPublicCalls(), []) : Promise.resolve([]),
    ]);
    setAppointments(workflowData);
    setCalls(callData);
    setRecords(recordData);
    setTreasuryEntries(treasuryData);
    setPatients(patientData);
    setPublicQueue(Array.isArray(publicQueueData) ? publicQueueData : []);
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    const data = await loginUser(username, password);
    if (data.token) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, data.token);
      setToken(data.token);
      setUser(data.user);
      loadData(data.token);
    }
  };

  const handleLogout = (clearHash = true) => {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    setToken("");
    setUser(null);
    setPatients([]);
    setCalls([]);
    setReports([]);
    setAuditDocuments([]);
    setPrescriptions([]);
    setGuides([]);
    setGuideHistoryById({});
    setGlobalGuideAuditLogs([]);
    setGlobalGuideAuditFilter({
      start_date: "",
      end_date: "",
      printed_by: "",
      action: "all",
      guide_id: "",
      page_size: "20",
    });
    setGlobalGuideAuditMeta({
      page: 1,
      page_size: 20,
      total_items: 0,
      total_pages: 1,
    });
    setProfessionals([]);
    setAppointments([]);
    setRecords([]);
    setTreasuryEntries([]);
    setUsers([]);
    setPublicQueue([]);
    setAdminSummary(null);
    setStockItems([]);
    setSelectedAppointmentId(null);
    setWorkflowError("");
    setActiveView("overview");
    setUsername("");
    setPassword("");
    if (clearHash) {
      window.location.hash = "";
    }
  };

  const handlePatientSubmit = async (event) => {
    event.preventDefault();
    const normalizedBirthDate = formatBirthDate(form.birth_date);
    const adult = isAdult(normalizedBirthDate);
    const payload = {
      ...form,
      cpf: formatCpf(form.cpf),
      phone: formatPhone(form.phone),
      birth_date: normalizedBirthDate,
      responsible_name: adult ? "Maior de 18 anos" : form.responsible_name,
    };
    const patient = await createPatient(token, payload);
    if (patient.detail) {
      setWorkflowError(patient.detail);
      return;
    }
    setPatients((prev) => [patient, ...prev]);
    const triageNotes = [
      `Queixa principal: ${receptionForm.chief_complaint || "Não informada"}`,
      receptionForm.plan_name ? `Convênio: ${receptionForm.plan_name}` : "Atendimento particular",
      receptionForm.guide_code ? `Guia: ${receptionForm.guide_code}` : "Sem guia informada",
    ].join(" | ");

    setAppointmentForm((prev) => ({ ...prev, patient_id: String(patient.id), notes: triageNotes }));
    setWorkflowError("");

    if (receptionForm.plan_name) {
      const guide = await createGuide(token, {
        patient_id: patient.id,
        plan_name: receptionForm.plan_name,
        guide_code: receptionForm.guide_code,
        signed_at_reception: receptionForm.signed_at_reception,
      });
      if (!guide.detail) {
        setGuides((prev) => [guide, ...prev]);
      }
    }

    setForm({
      name: "",
      cpf: "",
      phone: "",
      birth_date: "",
      address: "",
      consent_lgpd: true,
      responsible_name: "",
    });
    setReceptionForm({
      chief_complaint: "",
      plan_name: "",
      guide_code: "",
      signed_at_reception: false,
    });
  };

  const updateFormField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleBirthDateBlur = () => {
    const formattedBirthDate = formatBirthDate(form.birth_date);
    const adult = isAdult(formattedBirthDate);
    setForm((prev) => ({
      ...prev,
      birth_date: formattedBirthDate,
      responsible_name: adult ? "Maior de 18 anos" : (prev.responsible_name === "Maior de 18 anos" ? "" : prev.responsible_name),
    }));
  };

  const handleCallSubmit = async (event) => {
    event.preventDefault();
    if (!selectedAppointment || !callRoom) return;
    const result = await callAppointment(token, selectedAppointment.id, { room: callRoom });
    if (result.detail) {
      setWorkflowError(result.detail);
      return;
    }
    syncAppointment(result);
    setWorkflowError("");
    setCallRoom("");
    await refreshOperationalViews(token);
  };

  const handleTriageCallSubmit = async (event) => {
    event.preventDefault();
    if (!selectedAppointment || !callRoom) return;
    const result = await callTriage(token, selectedAppointment.id, { room: callRoom });
    if (result.detail) {
      setWorkflowError(result.detail);
      return;
    }
    syncAppointment(result);
    setWorkflowError("");
    setCallRoom("");
    await refreshOperationalViews(token);
  };

  const handleTriageSubmit = async (event) => {
    event.preventDefault();
    if (!selectedAppointment) return;
    const payload = {
      ...triageForm,
      chief_complaint: triageForm.chief_complaint || selectedAppointment.notes || "Sem queixa informada",
    };
    const result = await saveTriage(token, selectedAppointment.id, payload);
    if (result.detail) {
      setWorkflowError(result.detail);
      return;
    }
    syncAppointment(result);
    setWorkflowError("");
    setTriageForm({
      chief_complaint: "",
      blood_pressure: "",
      heart_rate: "",
      temperature_c: "",
      oxygen_saturation: "",
      respiratory_rate: "",
      weight_kg: "",
      allergies: "",
      current_medications: "",
      triage_note: "",
    });
    await refreshOperationalViews(token);
  };

  const handlePrescriptionSubmit = async (event) => {
    event.preventDefault();
    const patientId = selectedAppointment?.patient_id || patients[0]?.id;
    if (!patientId) return;
    const prescription = await createPrescription(token, patientId, user?.name || "Médico");
    setPrescriptions((prev) => [...prev, prescription]);
  };

  const handleGuideSubmit = async (event) => {
    event.preventDefault();
    const patientId = selectedAppointment?.patient_id || patients[0]?.id;
    if (!patientId) return;
    const guide = await createGuide(token, {
      patient_id: patientId,
      plan_name: receptionForm.plan_name,
      guide_code: receptionForm.guide_code,
      signed_at_reception: receptionForm.signed_at_reception,
    });
    setGuides((prev) => [...prev, guide]);
  };

  const buildGuidePrintHtml = (data) => {
    return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Guia de Consulta - ${data.plan?.guide_code || "SEM-CODIGO"}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #111827; margin: 24px; }
      .sheet { max-width: 820px; margin: 0 auto; border: 1px solid #d1d5db; padding: 24px; }
      h1 { margin: 0 0 8px 0; font-size: 20px; }
      h2 { margin: 18px 0 8px 0; font-size: 15px; }
      p { margin: 4px 0; font-size: 13px; }
      .line { height: 1px; background: #d1d5db; margin: 14px 0; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .box { border: 1px solid #d1d5db; border-radius: 6px; padding: 10px; }
      .signatures { margin-top: 36px; display: grid; grid-template-columns: 1fr 1fr; gap: 36px; }
      .sig-line { border-top: 1px solid #111827; padding-top: 8px; font-size: 12px; text-align: center; }
      .footer { margin-top: 26px; font-size: 11px; color: #6b7280; }
      @media print { body { margin: 0; } .sheet { border: none; } }
    </style>
  </head>
  <body>
    <main class="sheet">
      <h1>Guia de Consulta - Convênio</h1>
      <p><strong>Data/Hora de emissão:</strong> ${data.generated_at}</p>
      <p><strong>Clínica:</strong> ${data.clinic?.name || ""} | <strong>CNPJ:</strong> ${data.clinic?.cnpj || ""} | <strong>Unidade:</strong> ${data.clinic?.unit || ""}</p>

      <div class="line"></div>

      <h2>Dados do Paciente</h2>
      <div class="grid">
        <div class="box">
          <p><strong>Nome:</strong> ${data.patient?.name || ""}</p>
          <p><strong>CPF:</strong> ${data.patient?.cpf || ""}</p>
          <p><strong>Nascimento:</strong> ${data.patient?.birth_date || ""}</p>
        </div>
        <div class="box">
          <p><strong>Telefone:</strong> ${data.patient?.phone || ""}</p>
          <p><strong>Plano:</strong> ${data.plan?.name || "NÃO INFORMADO"}</p>
          <p><strong>Número da guia:</strong> ${data.plan?.guide_code || ""}</p>
        </div>
      </div>

      <h2>Declaração</h2>
      <p>Declaro que fui atendido(a) na unidade acima e autorizo o faturamento da consulta junto ao convênio informado nesta guia.</p>
      <p><strong>Guia assinada na recepção:</strong> ${data.signed_at_reception ? "SIM" : "NÃO"}</p>

      <div class="signatures">
        <div class="sig-line">Assinatura do Paciente</div>
        <div class="sig-line">Assinatura da Recepção (${data.issued_by || ""})</div>
      </div>

      <p class="footer">Documento operacional da clínica para registro e faturamento de consulta por convênio.</p>
    </main>
  </body>
</html>`;
  };

  const handlePrintGuide = async (guideId) => {
    const data = await getGuidePrintData(token, guideId);
    if (data.detail) {
      setWorkflowError(data.detail);
      return;
    }

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      setWorkflowError("Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-up.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(buildGuidePrintHtml(data));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();

    await handleLoadGuideHistory(guideId);
  };

  const handleDownloadGuidePdf = async (guideId) => {
    const response = await downloadGuidePdf(token, guideId);
    if (!response.ok) {
      const errorData = await response.json();
      setWorkflowError(errorData?.detail || "Falha ao gerar PDF da guia");
      return;
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    const contentDisposition = response.headers.get("Content-Disposition") || "";
    const filenameMatch = contentDisposition.match(/filename=([^;]+)/i);
    const fileName = filenameMatch ? filenameMatch[1].trim() : `guia-${guideId}.pdf`;

    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);

    await handleLoadGuideHistory(guideId);
  };

  const handleLoadGuideHistory = async (guideId) => {
    const data = await getGuidePrintHistory(token, guideId);
    if (data?.detail) {
      setWorkflowError(data.detail);
      return;
    }

    setGuideHistoryById((prev) => ({
      ...prev,
      [guideId]: Array.isArray(data) ? data : [],
    }));
  };

  const handleLoadGlobalGuideAudit = async (event, pageOverride = 1) => {
    if (event) event.preventDefault();
    const data = await getGlobalGuidePrintHistory(token, {
      ...globalGuideAuditFilter,
      page: pageOverride,
      page_size: Number(globalGuideAuditFilter.page_size || 20),
    });
    if (data?.detail) {
      setWorkflowError(data.detail);
      return;
    }
    setWorkflowError("");
    setGlobalGuideAuditLogs(Array.isArray(data?.items) ? data.items : []);
    setGlobalGuideAuditMeta({
      page: data?.page || 1,
      page_size: data?.page_size || Number(globalGuideAuditFilter.page_size || 20),
      total_items: data?.total_items || 0,
      total_pages: data?.total_pages || 1,
    });
  };

  const handleExportGlobalGuideAuditCsv = async () => {
    const response = await downloadGlobalGuidePrintHistoryCsv(token, globalGuideAuditFilter);
    if (!response.ok) {
      const errorData = await response.json();
      setWorkflowError(errorData?.detail || "Falha ao exportar CSV da auditoria");
      return;
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    const contentDisposition = response.headers.get("Content-Disposition") || "";
    const filenameMatch = contentDisposition.match(/filename=([^;]+)/i);
    const fileName = filenameMatch ? filenameMatch[1].trim() : "auditoria_guias.csv";

    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  };

  const refreshAdminViews = async (authToken) => {
    const [usersData, summaryData, stockData] = await Promise.all([
      hasPermission("users:view") ? safeFetch(() => getUsers(authToken), []) : Promise.resolve([]),
      hasPermission("users:view") ? safeFetch(() => getAdminSummary(authToken), null) : Promise.resolve(null),
      hasPermission("stock:view") ? safeFetch(() => getStockItems(authToken), []) : Promise.resolve([]),
    ]);
    setUsers(usersData);
    setAdminSummary(summaryData && !summaryData.detail ? summaryData : null);
    setStockItems(stockData);
  };

  const handleEmployeeSubmit = async (event) => {
    event.preventDefault();
    const normalizedEmployee = {
      ...employeeForm,
      cpf: formatCpf(employeeForm.cpf),
      emergency_contact_phone: formatPhone(employeeForm.emergency_contact_phone),
      crm: employeeForm.crm.trim(),
      cre: employeeForm.cre.trim(),
    };

    if (normalizedEmployee.role === "doctor" && !normalizedEmployee.crm) {
      setWorkflowError("CRM é obrigatório para cadastro de médico");
      return;
    }
    if (normalizedEmployee.role === "nurse" && !normalizedEmployee.cre) {
      setWorkflowError("CRE é obrigatório para cadastro de enfermagem");
      return;
    }

    const result = await createUser(token, normalizedEmployee);
    if (result.detail) {
      setWorkflowError(result.detail);
      return;
    }
    setWorkflowError("");
    setEmployeeForm({
      name: "",
      username: "",
      password: "",
      role: "reception",
      cpf: "",
      address: "",
      labor_registry: "",
      crm: "",
      cre: "",
      contract_type: "CLT",
      admission_date: "",
      emergency_contact_name: "",
      emergency_contact_phone: "",
      lgpd_consent: true,
      active: true,
    });
    await refreshAdminViews(token);
  };

  const handleCreateStockItem = async (event) => {
    event.preventDefault();
    const result = await createStockItem(token, {
      ...stockForm,
      quantity: Number(stockForm.quantity),
      min_quantity: Number(stockForm.min_quantity),
    });
    if (result.detail) {
      setWorkflowError(result.detail);
      return;
    }
    setWorkflowError("");
    setStockForm({
      name: "",
      category: "medicamento",
      unit: "un",
      quantity: "0",
      min_quantity: "0",
    });
    await refreshAdminViews(token);
  };

  const handleStockMovement = async (event) => {
    event.preventDefault();
    if (!stockMovementForm.item_id) return;
    const result = await registerStockMovement(token, Number(stockMovementForm.item_id), {
      movement_type: stockMovementForm.movement_type,
      amount: Number(stockMovementForm.amount),
      note: stockMovementForm.note,
    });
    if (result.detail) {
      setWorkflowError(result.detail);
      return;
    }
    setWorkflowError("");
    setStockMovementForm((prev) => ({ ...prev, amount: "1", note: "" }));
    await refreshAdminViews(token);
  };

  const handleAppointmentSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      ...appointmentForm,
      patient_id: Number(appointmentForm.patient_id),
      professional_id: Number(appointmentForm.professional_id),
    };
    const appointment = await createAppointment(token, payload);
    if (!appointment.detail) {
      syncAppointment(appointment);
      await refreshOperationalViews(token);
    }
    setAppointmentForm({
      patient_id: "",
      professional_id: "",
      scheduled_at: "",
      unit_name: "Unidade Centro",
      shift: "manha",
      specialty: "",
      notes: "",
    });
  };

  const handleCheckIn = async () => {
    if (!selectedAppointment) return;
    const result = await checkInAppointment(token, selectedAppointment.id, { priority: checkInPriority });
    if (result.detail) {
      setWorkflowError(result.detail);
      return;
    }
    syncAppointment(result);
    setWorkflowError("");
    await refreshOperationalViews(token);
  };

  const handleRecordSubmit = async (event) => {
    event.preventDefault();
    if (!selectedAppointment) return;
    const result = await saveMedicalRecord(token, selectedAppointment.id, recordForm);
    if (result.detail) {
      setWorkflowError(result.detail);
      return;
    }
    syncAppointment(result);
    setWorkflowError("");
    await refreshOperationalViews(token);
  };

  const handleAttachmentSubmit = async (event) => {
    event.preventDefault();
    if (!selectedAppointment) return;
    const result = await addMedicalRecordAttachment(token, selectedAppointment.id, attachmentForm);
    if (result.detail) {
      setWorkflowError(result.detail);
      return;
    }
    syncAppointment(result);
    setWorkflowError("");
    setAttachmentForm({
      title: "",
      category: "imagem",
      reference_url: "",
    });
    await refreshOperationalViews(token);
  };

  const handleTreasurySubmit = async (event) => {
    event.preventDefault();
    if (!selectedAppointment) return;
    const result = await saveTreasuryEntry(token, selectedAppointment.id, {
      ...treasuryForm,
      amount_cents: Number(treasuryForm.amount_cents),
    });
    if (result.detail) {
      setWorkflowError(result.detail);
      return;
    }
    syncAppointment(result);
    setWorkflowError("");
    await refreshOperationalViews(token);
  };

  const openAppointment = (appointment) => {
    setSelectedAppointmentId(appointment.id);
    setCallRoom(appointment.ticket?.room || "");
    setTriageForm({
      chief_complaint: appointment.medical_record?.chief_complaint || "",
      blood_pressure: "",
      heart_rate: "",
      temperature_c: "",
      oxygen_saturation: "",
      respiratory_rate: "",
      weight_kg: "",
      allergies: appointment.medical_record?.allergies || "",
      current_medications: appointment.medical_record?.current_medications || "",
      triage_note: "",
    });
    setRecordForm({
      chief_complaint: appointment.medical_record?.chief_complaint || "",
      anamnesis: appointment.medical_record?.anamnesis || "",
      vital_signs: appointment.medical_record?.vital_signs || "",
      allergies: appointment.medical_record?.allergies || "",
      physical_exam: appointment.medical_record?.physical_exam || "",
      current_medications: appointment.medical_record?.current_medications || "",
      icd10_code: appointment.medical_record?.icd10_code || "",
      diagnosis: appointment.medical_record?.diagnosis || "",
      care_plan: appointment.medical_record?.care_plan || "",
      prescriptions_summary: appointment.medical_record?.prescriptions_summary || "",
      evolution_type: "evolucao",
      evolution_note: "",
      status: appointment.medical_record?.status || "finalizado",
    });
    setAttachmentForm({
      title: "",
      category: "imagem",
      reference_url: "",
    });
    setTreasuryForm({
      description: appointment.treasury?.description || `Consulta ${appointment.specialty}`,
      amount_cents: appointment.treasury?.amount_cents || "",
      payment_method: appointment.treasury?.payment_method || "pix",
      status: appointment.treasury?.status || "pendente",
      due_date: appointment.treasury?.due_date || appointment.scheduled_at.slice(0, 10),
      paid_at: appointment.treasury?.paid_at || "",
    });
  };

  const statusCounts = appointments.reduce((acc, appointment) => {
    acc.total += 1;
    if (["em espera", "aguardando triagem", "em triagem", "aguardando medico"].includes(appointment.status)) acc.waiting += 1;
    if (["em atendimento", "atendido"].includes(appointment.status)) acc.inCare += 1;
    if (appointment.treasury?.status === "pago") acc.paid += 1;
    return acc;
  }, { total: 0, waiting: 0, inCare: 0, paid: 0 });

  const visibleAppointments = appointments.filter((appointment) => {
    if (user?.role === "doctor") return appointment.professional_id === user.id;
    return true;
  });

  const filteredAppointments = visibleAppointments.filter((appointment) => {
    const matchesUnit = unitFilter === "all" || appointment.unit_name === unitFilter;
    const matchesShift = shiftFilter === "all" || appointment.shift === shiftFilter;
    return matchesUnit && matchesShift;
  });

  const selectedScopedAppointment = filteredAppointments.find((item) => item.id === selectedAppointmentId) || filteredAppointments[0] || null;

  const doctorQueue = filteredAppointments.filter((item) => ["aguardando medico", "em atendimento", "em triagem"].includes(item.status));
  const doctorCompleted = filteredAppointments.filter((item) => item.medical_record?.updated_at);
  const queueBoard = publicQueue.filter((item) => ["aguardando", "chamado_triagem", "aguardando_medico", "chamado"].includes(item.status));
  const getTriageValue = (vitalSigns, label) => {
    if (!vitalSigns) return "Nao informado";
    const parts = String(vitalSigns).split(";").map((item) => item.trim()).filter(Boolean);
    const match = parts.find((item) => item.toLowerCase().startsWith(label.toLowerCase()));
    return match ? match.replace(new RegExp(`^${label}\\s*`, "i"), "") : "Nao informado";
  };

  if (!token) {
    return (
      <div className="app flex h-screen w-screen flex-col items-center justify-center bg-slate-100">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
          <h1 className="text-2xl font-bold text-slate-800">Acesso restrito</h1>
          <p className="mt-1 text-slate-600">Somente funcionários autorizados.</p>
          <form onSubmit={handleLogin} className="mt-6 flex flex-col gap-4">
            <input className="rounded-lg border border-slate-300 p-3" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Usuário" />
            <input className="rounded-lg border border-slate-300 p-3" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" type="password" />
            <button className="rounded-lg bg-blue-600 p-3 font-semibold text-white transition hover:bg-blue-700" type="submit">Entrar</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_48%,_#e2e8f0)] p-6 text-slate-800">
      <div className="mx-auto max-w-7xl rounded-[28px] bg-white/95 p-6 shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Operação Clínica Integrada</h1>
            <p className="mt-2 text-slate-600">Bem-vindo, {user?.name} ({user?.role_label || user?.role})</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-900 ring-1 ring-cyan-200">
              {user?.role_label || user?.role}
            </div>
            <a href="#tv" target="_blank" rel="noreferrer" className="rounded-xl bg-slate-800 px-4 py-2 font-medium text-white transition hover:bg-slate-700">
              Abrir Painel TV 📺
            </a>
            <button type="button" onClick={() => handleLogout()} className="rounded-xl bg-rose-600 px-4 py-2 font-medium text-white transition hover:bg-rose-700">
              Sair
            </button>
          </div>
        </div>

        <section className="mt-6 flex flex-wrap gap-3">
          {viewOptions.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveView(item.key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeView === item.key ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"}`}
            >
              {item.label}
            </button>
          ))}
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-slate-900 p-4 text-white">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Consultas do dia</p>
            <p className="mt-3 text-4xl font-bold">{statusCounts.total}</p>
          </div>
          <div className="rounded-2xl bg-amber-50 p-4 text-amber-900 ring-1 ring-amber-200">
            <p className="text-sm uppercase tracking-[0.2em] text-amber-600">Em espera</p>
            <p className="mt-3 text-4xl font-bold">{statusCounts.waiting}</p>
          </div>
          <div className="rounded-2xl bg-cyan-50 p-4 text-cyan-900 ring-1 ring-cyan-200">
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-700">Em atendimento</p>
            <p className="mt-3 text-4xl font-bold">{statusCounts.inCare}</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-900 ring-1 ring-emerald-200">
            <p className="text-sm uppercase tracking-[0.2em] text-emerald-700">Pagas</p>
            <p className="mt-3 text-4xl font-bold">{statusCounts.paid}</p>
          </div>
        </section>

        {(activeView === "overview" || activeView === "reception") && hasPermission("patients:create") && !isAdmin ? <section className="mt-6 rounded-2xl border border-slate-200 p-4">
          <h2 className="text-xl font-medium">Cadastro de pacientes</h2>
          <form onSubmit={handlePatientSubmit} className="mt-4 grid gap-3 md:grid-cols-2">
            <input className="rounded-lg border border-slate-300 p-2" value={form.name} onChange={(e) => updateFormField("name", e.target.value)} placeholder="Nome" />
            <input className="rounded-lg border border-slate-300 p-2" value={form.cpf} onChange={(e) => updateFormField("cpf", e.target.value)} onBlur={() => updateFormField("cpf", formatCpf(form.cpf))} placeholder="CPF" />
            <input className="rounded-lg border border-slate-300 p-2" value={form.phone} onChange={(e) => updateFormField("phone", e.target.value)} onBlur={() => updateFormField("phone", formatPhone(form.phone))} placeholder="Telefone" />
            <input className="rounded-lg border border-slate-300 p-2" value={form.birth_date} onChange={(e) => updateFormField("birth_date", e.target.value)} onBlur={handleBirthDateBlur} placeholder="Data de nascimento" />
            <input className="rounded-lg border border-slate-300 p-2 md:col-span-2" value={form.address} onChange={(e) => updateFormField("address", e.target.value)} placeholder="Endereço" />
            <input className="rounded-lg border border-slate-300 p-2 md:col-span-2" value={receptionForm.chief_complaint} onChange={(e) => setReceptionForm({ ...receptionForm, chief_complaint: e.target.value })} placeholder="Queixa principal informada na recepção" />
            <input className="rounded-lg border border-slate-300 p-2" value={form.responsible_name} onChange={(e) => updateFormField("responsible_name", e.target.value)} placeholder={isAdult(form.birth_date) ? "Maior de 18 anos" : "Responsável"} disabled={isAdult(form.birth_date)} />
            <label className="flex items-center gap-2 rounded-lg border border-slate-300 p-2">
              <input type="checkbox" checked={form.consent_lgpd} onChange={(e) => updateFormField("consent_lgpd", e.target.checked)} />
              Consentimento LGPD
            </label>
            <input className="rounded-lg border border-slate-300 p-2" value={receptionForm.plan_name} onChange={(e) => setReceptionForm({ ...receptionForm, plan_name: e.target.value })} placeholder="Plano de saúde (deixe vazio para particular)" />
            <input className="rounded-lg border border-slate-300 p-2" value={receptionForm.guide_code} onChange={(e) => setReceptionForm({ ...receptionForm, guide_code: e.target.value })} placeholder="Número da guia de consulta" />
            <label className="flex items-center gap-2 rounded-lg border border-slate-300 p-2 md:col-span-2">
              <input type="checkbox" checked={receptionForm.signed_at_reception} onChange={(e) => setReceptionForm({ ...receptionForm, signed_at_reception: e.target.checked })} />
              Guia impressa e assinada pelo paciente na recepção
            </label>
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-white md:col-span-2" type="submit">Salvar paciente</button>
          </form>
        </section> : null}

        {(activeView === "overview" || activeView === "reception" || activeView === "care" || activeView === "treasury") && hasPermission("appointments:view") ? <section className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-medium">Agenda e fluxo operacional</h2>
                <p className="mt-1 text-sm text-slate-600">Selecione uma consulta para fazer check-in, chamar para o consultório, registrar prontuário e finalizar a tesouraria.</p>
              </div>
            </div>
            {hasPermission("appointments:create") && !isAdmin ? <form onSubmit={handleAppointmentSubmit} className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
              <select className="rounded-lg border border-slate-300 p-2" value={appointmentForm.patient_id} onChange={(e) => setAppointmentForm({ ...appointmentForm, patient_id: e.target.value })}>
                <option value="">Paciente</option>
                {patients.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              <select className="rounded-lg border border-slate-300 p-2" value={appointmentForm.professional_id} onChange={(e) => setAppointmentForm({ ...appointmentForm, professional_id: e.target.value })}>
                <option value="">Profissional</option>
                {professionals.filter((item) => item.role === "doctor").map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              <input className="rounded-lg border border-slate-300 p-2" value={appointmentForm.scheduled_at} onChange={(e) => setAppointmentForm({ ...appointmentForm, scheduled_at: e.target.value })} placeholder="2026-08-08 14:00" />
              <select className="rounded-lg border border-slate-300 p-2" value={appointmentForm.unit_name} onChange={(e) => setAppointmentForm({ ...appointmentForm, unit_name: e.target.value })}>
                <option value="Unidade Centro">Unidade Centro</option>
                <option value="Unidade Norte">Unidade Norte</option>
                <option value="Unidade Sul">Unidade Sul</option>
              </select>
              <select className="rounded-lg border border-slate-300 p-2" value={appointmentForm.shift} onChange={(e) => setAppointmentForm({ ...appointmentForm, shift: e.target.value })}>
                <option value="manha">Manhã</option>
                <option value="tarde">Tarde</option>
                <option value="noite">Noite</option>
              </select>
              <input className="rounded-lg border border-slate-300 p-2 md:col-span-2 lg:col-span-2" value={appointmentForm.specialty} onChange={(e) => setAppointmentForm({ ...appointmentForm, specialty: e.target.value })} placeholder="Especialidade" />
              <button className="rounded-lg bg-cyan-700 px-4 py-2 text-white" type="submit">Agendar consulta</button>
              <input className="rounded-lg border border-slate-300 p-2 md:col-span-2 lg:col-span-5" value={appointmentForm.notes} onChange={(e) => setAppointmentForm({ ...appointmentForm, notes: e.target.value })} placeholder="Observações" />
            </form> : null}

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <select className="rounded-lg border border-slate-300 bg-white p-2" value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)}>
                <option value="all">Todas as unidades</option>
                {units.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
              <select className="rounded-lg border border-slate-300 bg-white p-2" value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)}>
                <option value="all">Todos os turnos</option>
                <option value="manha">Manhã</option>
                <option value="tarde">Tarde</option>
                <option value="noite">Noite</option>
              </select>
              <div className="rounded-xl bg-slate-50 px-4 py-2 text-sm text-slate-600 ring-1 ring-slate-200">Agenda filtrada: {filteredAppointments.length} consultas</div>
              <div className="rounded-xl bg-slate-50 px-4 py-2 text-sm text-slate-600 ring-1 ring-slate-200">Plantão: {shiftFilter === "all" ? "Todos" : shiftFilter}</div>
            </div>

            <div className="mt-4 grid gap-3">
              {filteredAppointments.map((appointment) => (
                <button
                  key={appointment.id}
                  type="button"
                  onClick={() => openAppointment(appointment)}
                  className={`rounded-2xl border p-4 text-left transition ${selectedScopedAppointment?.id === appointment.id ? "border-cyan-500 bg-cyan-50 shadow-md" : "border-slate-200 bg-slate-50 hover:border-slate-300"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">{appointment.patient_name}</p>
                      <p className="text-sm text-slate-600">{appointment.scheduled_at} • {appointment.professional_name} • {appointment.specialty}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{appointment.unit_name} • {appointment.shift}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide">
                      <span className="rounded-full bg-slate-900 px-3 py-1 text-white">{appointment.status}</span>
                      {appointment.ticket?.code ? <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">{appointment.ticket.code}</span> : null}
                      {appointment.ticket?.room ? <span className="rounded-full bg-cyan-100 px-3 py-1 text-cyan-900">{appointment.ticket.room}</span> : null}
                      {appointment.treasury?.status ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-900">Tesouraria {appointment.treasury.status}</span> : null}
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{appointment.notes || "Sem observações registradas."}</p>
                </button>
              ))}
              {filteredAppointments.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Nenhuma consulta encontrada para os filtros aplicados.</div> : null}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 p-4">
              <h2 className="text-xl font-medium">Consulta selecionada</h2>
              {selectedScopedAppointment ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl bg-slate-900 p-4 text-white">
                    <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Paciente</p>
                    <p className="mt-2 text-2xl font-bold">{selectedScopedAppointment.patient_name}</p>
                    <p className="mt-1 text-sm text-slate-300">{selectedScopedAppointment.professional_name} • {selectedScopedAppointment.specialty}</p>
                    <p className="mt-1 text-sm text-slate-400">{selectedScopedAppointment.unit_name} • turno {selectedScopedAppointment.shift}</p>
                    <p className="mt-1 text-sm text-slate-300">Status atual: {selectedScopedAppointment.status}</p>
                  </div>

                  {workflowError ? <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200">{workflowError}</div> : null}
                  {isAdmin ? <div className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700 ring-1 ring-slate-200">Perfil de administração em modo de visualização operacional. O cadastro disponível nesta área é apenas de funcionários.</div> : null}

                  {hasPermission("queue:checkin") && !isAdmin ? <div className="grid gap-3 md:grid-cols-2">
                    <select className="rounded-lg border border-slate-300 p-2" value={checkInPriority} onChange={(e) => setCheckInPriority(e.target.value)}>
                      <option value="normal">Senha normal</option>
                      <option value="prioritario">Prioritário</option>
                    </select>
                    <button type="button" onClick={handleCheckIn} className="rounded-lg bg-amber-500 px-4 py-2 font-semibold text-white">Fazer check-in / gerar senha</button>
                  </div> : null}

                  {hasPermission("triage:call") && !isAdmin ? <form onSubmit={handleTriageCallSubmit} className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <input className="rounded-lg border border-slate-300 p-2" value={callRoom} onChange={(e) => setCallRoom(e.target.value)} placeholder="Sala de triagem" />
                    <button className="rounded-lg bg-indigo-700 px-4 py-2 text-white" type="submit">Chamar para triagem</button>
                  </form> : null}

                  {hasPermission("triage:edit") && !isAdmin ? <form onSubmit={handleTriageSubmit} className="grid gap-3 rounded-2xl bg-indigo-50 p-4 ring-1 ring-indigo-200">
                    <h3 className="text-lg font-semibold text-indigo-900">Triagem de enfermagem</h3>
                    <input className="rounded-lg border border-indigo-200 p-2" value={triageForm.chief_complaint} onChange={(e) => setTriageForm({ ...triageForm, chief_complaint: e.target.value })} placeholder="Queixa principal" />
                    <p className="text-sm font-medium text-indigo-900">Sinais vitais</p>
                    <div className="grid gap-3 md:grid-cols-3">
                      <input className="rounded-lg border border-indigo-200 p-2" value={triageForm.blood_pressure} onChange={(e) => setTriageForm({ ...triageForm, blood_pressure: e.target.value })} placeholder="Pressão arterial (mmHg, ex: 120/80)" />
                      <input className="rounded-lg border border-indigo-200 p-2" value={triageForm.heart_rate} onChange={(e) => setTriageForm({ ...triageForm, heart_rate: e.target.value })} placeholder="Frequência cardíaca" />
                      <input className="rounded-lg border border-indigo-200 p-2" value={triageForm.temperature_c} onChange={(e) => setTriageForm({ ...triageForm, temperature_c: e.target.value })} placeholder="Temperatura (°C)" />
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <input className="rounded-lg border border-indigo-200 p-2" value={triageForm.oxygen_saturation} onChange={(e) => setTriageForm({ ...triageForm, oxygen_saturation: e.target.value })} placeholder="Oximetria / Saturação O2 (%)" />
                      <input className="rounded-lg border border-indigo-200 p-2" value={triageForm.respiratory_rate} onChange={(e) => setTriageForm({ ...triageForm, respiratory_rate: e.target.value })} placeholder="Frequência respiratória" />
                      <input className="rounded-lg border border-indigo-200 p-2" value={triageForm.weight_kg} onChange={(e) => setTriageForm({ ...triageForm, weight_kg: e.target.value })} placeholder="Peso (kg)" />
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <input className="rounded-lg border border-indigo-200 p-2" value={triageForm.allergies} onChange={(e) => setTriageForm({ ...triageForm, allergies: e.target.value })} placeholder="Alergias" />
                      <input className="rounded-lg border border-indigo-200 p-2" value={triageForm.current_medications} onChange={(e) => setTriageForm({ ...triageForm, current_medications: e.target.value })} placeholder="Medicações em uso" />
                    </div>
                    <textarea className="min-h-20 rounded-lg border border-indigo-200 p-2" value={triageForm.triage_note} onChange={(e) => setTriageForm({ ...triageForm, triage_note: e.target.value })} placeholder="Resumo da triagem" />
                    <button className="rounded-lg bg-indigo-700 px-4 py-2 text-white" type="submit">Salvar triagem e encaminhar ao médico</button>
                  </form> : null}

                  {hasPermission("queue:call") && !isAdmin ? <form onSubmit={handleCallSubmit} className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <input className="rounded-lg border border-slate-300 p-2" value={callRoom} onChange={(e) => setCallRoom(e.target.value)} placeholder="Sala ou consultório" />
                    <button className="rounded-lg bg-cyan-700 px-4 py-2 text-white" type="submit">Chamar para consultório</button>
                  </form> : null}

                  {hasPermission("records:edit") && !isAdmin ? <form onSubmit={handleRecordSubmit} className="grid gap-3">
                    <h3 className="text-lg font-semibold">Prontuário</h3>
                    <div className="grid gap-3 md:grid-cols-2">
                      <input className="rounded-lg border border-slate-300 p-2" value={recordForm.chief_complaint} onChange={(e) => setRecordForm({ ...recordForm, chief_complaint: e.target.value })} placeholder="Queixa principal" />
                      <input className="rounded-lg border border-slate-300 p-2 uppercase" value={recordForm.icd10_code} onChange={(e) => setRecordForm({ ...recordForm, icd10_code: e.target.value.toUpperCase() })} placeholder="CID-10" />
                    </div>
                    <textarea className="min-h-24 rounded-lg border border-slate-300 p-2" value={recordForm.anamnesis} onChange={(e) => setRecordForm({ ...recordForm, anamnesis: e.target.value })} placeholder="Anamnese" />
                    <div className="grid gap-3 md:grid-cols-2">
                      <input className="rounded-lg border border-slate-300 p-2" value={recordForm.vital_signs} onChange={(e) => setRecordForm({ ...recordForm, vital_signs: e.target.value })} placeholder="Sinais vitais" />
                      <input className="rounded-lg border border-slate-300 p-2" value={recordForm.allergies} onChange={(e) => setRecordForm({ ...recordForm, allergies: e.target.value })} placeholder="Alergias" />
                    </div>
                    <textarea className="min-h-20 rounded-lg border border-slate-300 p-2" value={recordForm.physical_exam} onChange={(e) => setRecordForm({ ...recordForm, physical_exam: e.target.value })} placeholder="Exame físico" />
                    <textarea className="min-h-20 rounded-lg border border-slate-300 p-2" value={recordForm.current_medications} onChange={(e) => setRecordForm({ ...recordForm, current_medications: e.target.value })} placeholder="Medicações em uso" />
                    <input className="rounded-lg border border-slate-300 p-2" value={recordForm.diagnosis} onChange={(e) => setRecordForm({ ...recordForm, diagnosis: e.target.value })} placeholder="Diagnóstico" />
                    <textarea className="min-h-24 rounded-lg border border-slate-300 p-2" value={recordForm.care_plan} onChange={(e) => setRecordForm({ ...recordForm, care_plan: e.target.value })} placeholder="Conduta" />
                    <textarea className="min-h-20 rounded-lg border border-slate-300 p-2" value={recordForm.prescriptions_summary} onChange={(e) => setRecordForm({ ...recordForm, prescriptions_summary: e.target.value })} placeholder="Resumo de prescrições e orientações" />
                    <div className="grid gap-3 md:grid-cols-[180px_1fr]">
                      <select className="rounded-lg border border-slate-300 p-2" value={recordForm.evolution_type} onChange={(e) => setRecordForm({ ...recordForm, evolution_type: e.target.value })}>
                        <option value="triagem">Triagem</option>
                        <option value="evolucao">Evolução</option>
                        <option value="reavaliacao">Reavaliação</option>
                        <option value="alta">Alta</option>
                      </select>
                      <input className="rounded-lg border border-slate-300 p-2" value={recordForm.evolution_note} onChange={(e) => setRecordForm({ ...recordForm, evolution_note: e.target.value })} placeholder="Resumo desta evolução" />
                    </div>
                    <button className="rounded-lg bg-slate-900 px-4 py-2 text-white" type="submit">Salvar prontuário</button>
                  </form> : null}

                  <div className="grid gap-4 xl:grid-cols-2">
                    {hasPermission("records:attach") && !isAdmin ? <form onSubmit={handleAttachmentSubmit} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                      <h3 className="text-lg font-semibold">Anexos</h3>
                      <div className="mt-3 grid gap-3">
                        <input className="rounded-lg border border-slate-300 p-2" value={attachmentForm.title} onChange={(e) => setAttachmentForm({ ...attachmentForm, title: e.target.value })} placeholder="Título do anexo" />
                        <select className="rounded-lg border border-slate-300 p-2" value={attachmentForm.category} onChange={(e) => setAttachmentForm({ ...attachmentForm, category: e.target.value })}>
                          <option value="imagem">Imagem</option>
                          <option value="laboratorio">Laboratório</option>
                          <option value="laudo">Laudo</option>
                          <option value="documento">Documento</option>
                        </select>
                        <input className="rounded-lg border border-slate-300 p-2" value={attachmentForm.reference_url} onChange={(e) => setAttachmentForm({ ...attachmentForm, reference_url: e.target.value })} placeholder="URL ou referência interna do arquivo" />
                        <button className="rounded-lg bg-violet-600 px-4 py-2 text-white" type="submit">Adicionar anexo</button>
                      </div>
                    </form> : <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 text-sm text-slate-600">Seu setor pode visualizar a jornada, mas não anexar documentos.</div>}

                    <div className="rounded-2xl bg-slate-950 p-4 text-white">
                      <h3 className="text-lg font-semibold">Resumo clínico</h3>
                      <div className="mt-4 grid gap-3 text-sm text-slate-200">
                        <div className="rounded-xl bg-white/5 p-3">CID: {selectedScopedAppointment.medical_record?.icd10_code || "Não informado"}</div>
                        <div className="rounded-xl bg-white/5 p-3">Diagnóstico: {selectedScopedAppointment.medical_record?.diagnosis || "Não informado"}</div>
                        <div className="rounded-xl bg-white/5 p-3">Última atualização: {selectedScopedAppointment.medical_record?.updated_at || "Sem registro"}</div>
                      </div>
                    </div>
                  </div>

                  {hasPermission("records:view") ? <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <h3 className="text-lg font-semibold">Evoluções do atendimento</h3>
                      <div className="mt-4 space-y-3">
                        {(selectedScopedAppointment.medical_record?.evolutions || []).map((item) => (
                          <div key={item.id} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                            <div className="flex items-center justify-between gap-3">
                              <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-900">{item.type}</span>
                              <span className="text-xs text-slate-500">{item.recorded_at}</span>
                            </div>
                            <p className="mt-2 text-sm font-medium text-slate-900">{item.author_name}</p>
                            <p className="mt-1 text-sm text-slate-600">{item.note}</p>
                          </div>
                        ))}
                        {(selectedScopedAppointment.medical_record?.evolutions || []).length === 0 ? <p className="text-sm text-slate-500">Nenhuma evolução lançada.</p> : null}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-4">
                      <h3 className="text-lg font-semibold">Histórico longitudinal</h3>
                      <div className="mt-4 space-y-3">
                        {(selectedScopedAppointment.medical_record?.timeline || []).map((item, index) => (
                          <div key={`${item.appointment_id}-${index}`} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-semibold text-slate-900">{item.updated_at}</span>
                              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">{item.icd10_code || "sem CID"}</span>
                            </div>
                            <p className="mt-1 text-sm text-slate-700">{item.diagnosis}</p>
                            <p className="mt-1 text-xs text-slate-500">{item.author_name} • {item.status}</p>
                          </div>
                        ))}
                        {(selectedScopedAppointment.medical_record?.timeline || []).length === 0 ? <p className="text-sm text-slate-500">Sem histórico prévio.</p> : null}
                      </div>
                    </div>
                  </div> : null}

                  {hasPermission("records:view") ? <div className="rounded-2xl border border-slate-200 p-4">
                    <h3 className="text-lg font-semibold">Anexos do prontuário</h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {(selectedScopedAppointment.medical_record?.attachments || []).map((item) => (
                        <a key={item.id} href={item.reference_url} target="_blank" rel="noreferrer" className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200 transition hover:bg-slate-100">
                          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                          <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{item.category}</p>
                          <p className="mt-2 text-xs text-slate-500">{item.uploaded_by} • {item.created_at}</p>
                        </a>
                      ))}
                      {(selectedScopedAppointment.medical_record?.attachments || []).length === 0 ? <p className="text-sm text-slate-500">Nenhum anexo vinculado.</p> : null}
                    </div>
                  </div> : null}

                  {hasPermission("treasury:edit") && !isAdmin ? <form onSubmit={handleTreasurySubmit} className="grid gap-3">
                    <h3 className="text-lg font-semibold">Tesouraria</h3>
                    <input className="rounded-lg border border-slate-300 p-2" value={treasuryForm.description} onChange={(e) => setTreasuryForm({ ...treasuryForm, description: e.target.value })} placeholder="Descrição do lançamento" />
                    <div className="grid gap-3 md:grid-cols-2">
                      <input className="rounded-lg border border-slate-300 p-2" value={treasuryForm.amount_cents} onChange={(e) => setTreasuryForm({ ...treasuryForm, amount_cents: e.target.value })} placeholder="Valor em centavos" />
                      <select className="rounded-lg border border-slate-300 p-2" value={treasuryForm.payment_method} onChange={(e) => setTreasuryForm({ ...treasuryForm, payment_method: e.target.value })}>
                        <option value="pix">Pix</option>
                        <option value="cartao">Cartão</option>
                        <option value="dinheiro">Dinheiro</option>
                        <option value="convenio">Convênio</option>
                      </select>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <select className="rounded-lg border border-slate-300 p-2" value={treasuryForm.status} onChange={(e) => setTreasuryForm({ ...treasuryForm, status: e.target.value })}>
                        <option value="pendente">Pendente</option>
                        <option value="faturado">Faturado</option>
                        <option value="pago">Pago</option>
                      </select>
                      <input className="rounded-lg border border-slate-300 p-2" value={treasuryForm.due_date} onChange={(e) => setTreasuryForm({ ...treasuryForm, due_date: e.target.value })} placeholder="Vencimento" />
                    </div>
                    <input className="rounded-lg border border-slate-300 p-2" value={treasuryForm.paid_at} onChange={(e) => setTreasuryForm({ ...treasuryForm, paid_at: e.target.value })} placeholder="Pagamento em" />
                    <button className="rounded-lg bg-emerald-600 px-4 py-2 text-white" type="submit">Salvar tesouraria</button>
                  </form> : null}
                </div>
              ) : (
                <p className="mt-4 text-slate-600">Nenhuma consulta disponível.</p>
              )}
            </div>

            {hasPermission("queue:checkin", "queue:call", "triage:call") ? <div className="rounded-2xl border border-slate-200 p-4">
              <h2 className="text-xl font-medium">Fila atual</h2>
              <ul className="mt-4 space-y-2">
                {queueBoard.map((item) => (
                  <li key={item.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                    <span className="font-semibold">{item.ticket_code || "Sem senha"}</span> - {item.patient_name} - {item.destination_type} - {item.destination_label}
                  </li>
                ))}
                {queueBoard.length === 0 ? <li className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Nenhum paciente na fila para os filtros atuais.</li> : null}
              </ul>
            </div> : null}

            {activeView === "overview" && user?.role === "doctor" ? <div className="rounded-2xl border border-slate-200 p-4">
              <h2 className="text-xl font-medium">Painel Médico</h2>
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl bg-cyan-50 p-4 ring-1 ring-cyan-200">
                  <p className="text-sm uppercase tracking-[0.18em] text-cyan-700">Em fila no seu plantão</p>
                  <p className="mt-2 text-3xl font-bold text-cyan-950">{doctorQueue.length}</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
                  <p className="text-sm uppercase tracking-[0.18em] text-emerald-700">Atendimentos com evolução</p>
                  <p className="mt-2 text-3xl font-bold text-emerald-950">{doctorCompleted.length}</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {filteredAppointments.map((appointment) => (
                  <div key={`doctor-${appointment.id}`} className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-slate-900">{appointment.patient_name}</p>
                        <p className="text-sm text-slate-600">{appointment.scheduled_at} • {appointment.unit_name} • {appointment.specialty}</p>
                      </div>
                      <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">{appointment.status}</span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600">
                      <div>Queixa: {appointment.medical_record?.chief_complaint || "Pendente"}</div>
                      <div>Pressao arterial: {getTriageValue(appointment.medical_record?.vital_signs, "PA")}</div>
                      <div>Frequencia cardiaca: {getTriageValue(appointment.medical_record?.vital_signs, "FC")}</div>
                      <div>Temperatura: {getTriageValue(appointment.medical_record?.vital_signs, "Temp")}</div>
                      <div>Oximetria: {getTriageValue(appointment.medical_record?.vital_signs, "SatO2")}</div>
                      <div>Frequencia respiratoria: {getTriageValue(appointment.medical_record?.vital_signs, "FR")}</div>
                      <div>Peso: {getTriageValue(appointment.medical_record?.vital_signs, "Peso")}</div>
                      <div>CID: {appointment.medical_record?.icd10_code || "Não informado"}</div>
                      <div>Última evolução: {appointment.medical_record?.evolutions?.[0]?.note || "Sem evolução registrada"}</div>
                    </div>
                  </div>
                ))}
                {filteredAppointments.length === 0 ? <p className="text-sm text-slate-500">Sem pacientes no filtro atual.</p> : null}
              </div>
            </div> : null}
          </div>
        </section> : null}

        <section className="mt-6 grid gap-6 xl:grid-cols-3">
          {activeView === "overview" && hasPermission("patients:view") ? <div className="rounded-2xl border border-slate-200 p-4">
            <h2 className="text-xl font-medium">Pacientes cadastrados</h2>
            <ul className="mt-3 space-y-2">
              {patients.map((patient) => (
                <li key={patient.id} className="rounded-lg bg-slate-50 p-2">{patient.name} — {patient.cpf} — {patient.status}</li>
              ))}
            </ul>
          </div> : null}

          {activeView === "overview" && hasPermission("appointments:view") ? <div className="rounded-2xl border border-slate-200 p-4">
            <h2 className="text-xl font-medium">Últimos chamados</h2>
            <ul className="mt-3 space-y-2">
              {calls.map((call) => (
                <li key={call.id} className="rounded-lg bg-slate-50 p-2">{call.patient_name} — {call.room} — {call.status}</li>
              ))}
            </ul>
          </div> : null}

          {activeView === "overview" && hasPermission("reports:view") ? <div className="rounded-2xl border border-slate-200 p-4">
            <h2 className="text-xl font-medium">Relatórios</h2>
            <ul className="mt-3 space-y-2">
              {reports.map((report) => (
                <li key={report.id} className="rounded-lg bg-slate-50 p-2">{report.title} — {report.type}</li>
              ))}
            </ul>
            <button className="mt-3 rounded-lg bg-slate-700 px-4 py-2 text-white" onClick={() => window.print()}>Salvar/Imprimir relatório</button>
          </div> : null}

          {activeView === "overview" && hasPermission("audit:view") ? <div className="rounded-2xl border border-slate-200 p-4">
            <h2 className="text-xl font-medium">Documentos para auditoria</h2>
            <ul className="mt-3 space-y-2">
              {auditDocuments.map((document) => (
                <li key={document.id} className="rounded-lg bg-slate-50 p-2">{document.title} — {document.status}</li>
              ))}
            </ul>
          </div> : null}

          {activeView === "overview" && hasPermission("documents:issue", "records:view") && user?.role !== "doctor" && user?.role !== "nurse" ? <div className="rounded-2xl border border-slate-200 p-4">
            <h2 className="text-xl font-medium">Receitas e guias</h2>
            {hasPermission("documents:issue") && !isAdmin ? <form onSubmit={handlePrescriptionSubmit} className="mt-3 flex flex-col gap-2">
              <button className="rounded-lg bg-blue-600 px-4 py-2 text-white" type="submit">Emitir receita</button>
            </form> : null}
            {hasPermission("documents:issue") && !isAdmin ? <form onSubmit={handleGuideSubmit} className="mt-2 flex flex-col gap-2">
              <button className="rounded-lg bg-violet-600 px-4 py-2 text-white" type="submit">Emitir guia</button>
            </form> : null}
            <ul className="mt-3 space-y-2">
              {prescriptions.map((item) => (
                <li key={item.id} className="rounded-lg bg-slate-50 p-2">Receita: {item.patient_name} — {item.issued_by}</li>
              ))}
              {guides.map((item) => (
                <li key={item.id} className="rounded-lg bg-slate-50 p-2">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>Guia: {item.patient_name} — {item.plan_name || "Particular"} — {item.status}</span>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => handlePrintGuide(item.id)} className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-white">Imprimir guia</button>
                        <button type="button" onClick={() => handleDownloadGuidePdf(item.id)} className="rounded-lg bg-cyan-700 px-3 py-1 text-xs font-semibold text-white">Baixar PDF (backend)</button>
                        <button type="button" onClick={() => handleLoadGuideHistory(item.id)} className="rounded-lg bg-emerald-700 px-3 py-1 text-xs font-semibold text-white">Histórico</button>
                      </div>
                    </div>

                    {(guideHistoryById[item.id] || []).length > 0 ? <ul className="space-y-1 rounded-lg bg-white p-2 text-xs text-slate-700 ring-1 ring-slate-200">
                      {(guideHistoryById[item.id] || []).map((log) => (
                        <li key={log.id}>{log.printed_at} — {log.printed_by} — {log.action}</li>
                      ))}
                    </ul> : null}
                  </div>
                </li>
              ))}
            </ul>
          </div> : null}

          {activeView === "overview" && hasPermission("records:view") ? <div className="rounded-2xl border border-slate-200 p-4">
            <h2 className="text-xl font-medium">Prontuários recentes</h2>
            <ul className="mt-3 space-y-2">
              {records.map((item) => (
                <li key={item.id} className="rounded-lg bg-slate-50 p-2">{item.patient_name} — {item.medical_record?.diagnosis || "Sem diagnóstico"} — {item.medical_record?.updated_by || "Sem responsável"}</li>
              ))}
            </ul>
          </div> : null}

          {activeView === "overview" && hasPermission("treasury:view") ? <div className="rounded-2xl border border-slate-200 p-4">
            <h2 className="text-xl font-medium">Tesouraria</h2>
            <ul className="mt-3 space-y-2">
              {treasuryEntries.map((item) => (
                <li key={item.id} className="rounded-lg bg-slate-50 p-2">{item.patient_name} — R$ {(item.treasury?.amount_cents || 0 / 100).toFixed ? ((item.treasury?.amount_cents || 0) / 100).toFixed(2) : "0.00"} — {item.treasury?.status || "sem status"}</li>
              ))}
            </ul>
          </div> : null}

          {activeView === "overview" && hasPermission("users:view") ? <div className="rounded-2xl border border-slate-200 p-4 xl:col-span-3">
            <h2 className="text-xl font-medium">Administração central</h2>
            <p className="mt-1 text-sm text-slate-600">Visão fim-a-fim da rotina clínica, equipe, financeiro e estoque.</p>

            <div className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <h3 className="text-lg font-semibold">Auditoria de impressão de guias</h3>
              <form onSubmit={handleLoadGlobalGuideAudit} className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-6">
                <input className="rounded-lg border border-slate-300 p-2" type="date" value={globalGuideAuditFilter.start_date} onChange={(e) => setGlobalGuideAuditFilter((prev) => ({ ...prev, start_date: e.target.value }))} />
                <input className="rounded-lg border border-slate-300 p-2" type="date" value={globalGuideAuditFilter.end_date} onChange={(e) => setGlobalGuideAuditFilter((prev) => ({ ...prev, end_date: e.target.value }))} />
                <input className="rounded-lg border border-slate-300 p-2" value={globalGuideAuditFilter.printed_by} onChange={(e) => setGlobalGuideAuditFilter((prev) => ({ ...prev, printed_by: e.target.value }))} placeholder="Usuário" />
                <select className="rounded-lg border border-slate-300 p-2" value={globalGuideAuditFilter.action} onChange={(e) => setGlobalGuideAuditFilter((prev) => ({ ...prev, action: e.target.value }))}>
                  <option value="all">Todas as ações</option>
                  <option value="visualizacao">Visualização</option>
                  <option value="download_pdf">Download PDF</option>
                </select>
                <input className="rounded-lg border border-slate-300 p-2" value={globalGuideAuditFilter.guide_id} onChange={(e) => setGlobalGuideAuditFilter((prev) => ({ ...prev, guide_id: e.target.value }))} placeholder="ID guia" />
                <div className="flex gap-2">
                  <button className="rounded-lg bg-slate-900 px-4 py-2 text-white" type="submit">Filtrar auditoria</button>
                  <button className="rounded-lg bg-cyan-700 px-4 py-2 text-white" type="button" onClick={handleExportGlobalGuideAuditCsv}>Exportar CSV</button>
                </div>
              </form>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <label className="flex items-center gap-2">
                  Por página
                  <select className="rounded-lg border border-slate-300 p-1" value={globalGuideAuditFilter.page_size} onChange={(e) => setGlobalGuideAuditFilter((prev) => ({ ...prev, page_size: e.target.value }))}>
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </label>
                <span>Total: {globalGuideAuditMeta.total_items}</span>
                <span>Página {globalGuideAuditMeta.page} de {globalGuideAuditMeta.total_pages}</span>
              </div>

              {globalGuideAuditLogs.length > 0 ? <div className="mt-3 overflow-auto rounded-xl bg-white p-2 ring-1 ring-slate-200">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="p-2">Data/Hora</th>
                      <th className="p-2">Usuário</th>
                      <th className="p-2">Ação</th>
                      <th className="p-2">Guia</th>
                      <th className="p-2">Paciente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {globalGuideAuditLogs.map((log) => (
                      <tr key={log.id} className="border-b border-slate-100">
                        <td className="p-2">{log.printed_at}</td>
                        <td className="p-2">{log.printed_by}</td>
                        <td className="p-2">{log.action}</td>
                        <td className="p-2">{log.guide_official_number} (#{log.guide_id})</td>
                        <td className="p-2">{log.patient_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button type="button" className="rounded-lg border border-slate-300 px-3 py-1 text-sm" onClick={(e) => handleLoadGlobalGuideAudit(e, Math.max(1, globalGuideAuditMeta.page - 1))} disabled={globalGuideAuditMeta.page <= 1}>Anterior</button>
                  <button type="button" className="rounded-lg border border-slate-300 px-3 py-1 text-sm" onClick={(e) => handleLoadGlobalGuideAudit(e, Math.min(globalGuideAuditMeta.total_pages, globalGuideAuditMeta.page + 1))} disabled={globalGuideAuditMeta.page >= globalGuideAuditMeta.total_pages}>Próxima</button>
                </div>
              </div> : <p className="mt-3 text-sm text-slate-500">Nenhum registro carregado. Aplique um filtro ou clique em filtrar para listar tudo.</p>}
            </div>

            {adminSummary ? <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
              <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <p className="text-xs uppercase tracking-wide text-slate-500">Pacientes</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{adminSummary.patients_total}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <p className="text-xs uppercase tracking-wide text-slate-500">Consultas</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{adminSummary.appointments_total}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <p className="text-xs uppercase tracking-wide text-slate-500">Atendidos</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{adminSummary.attended_total}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
                <p className="text-xs uppercase tracking-wide text-emerald-700">Recebido à vista</p>
                <p className="mt-2 text-xl font-bold text-emerald-900">R$ {((adminSummary.financial?.cash_received_cents || 0) / 100).toFixed(2)}</p>
              </div>
              <div className="rounded-xl bg-cyan-50 p-3 ring-1 ring-cyan-200">
                <p className="text-xs uppercase tracking-wide text-cyan-700">Convênios</p>
                <p className="mt-2 text-xl font-bold text-cyan-900">R$ {((adminSummary.financial?.plan_received_cents || 0) / 100).toFixed(2)}</p>
              </div>
            </div> : null}

            <div className="mt-4 grid gap-4 xl:grid-cols-3">
              {hasPermission("users:manage") ? <form onSubmit={handleEmployeeSubmit} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <h3 className="text-lg font-semibold">Cadastro de funcionários</h3>
                <div className="mt-3 grid gap-3">
                  <input className="rounded-lg border border-slate-300 p-2" value={employeeForm.name} onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })} placeholder="Nome completo" />
                  <input className="rounded-lg border border-slate-300 p-2" value={employeeForm.cpf} onChange={(e) => setEmployeeForm({ ...employeeForm, cpf: formatCpf(e.target.value) })} placeholder="CPF" />
                  <input className="rounded-lg border border-slate-300 p-2" value={employeeForm.username} onChange={(e) => setEmployeeForm({ ...employeeForm, username: e.target.value })} placeholder="Usuário" />
                  <input className="rounded-lg border border-slate-300 p-2" type="password" value={employeeForm.password} onChange={(e) => setEmployeeForm({ ...employeeForm, password: e.target.value })} placeholder="Senha" />
                  <input className="rounded-lg border border-slate-300 p-2" value={employeeForm.address} onChange={(e) => setEmployeeForm({ ...employeeForm, address: e.target.value })} placeholder="Endereço completo" />
                  <input className="rounded-lg border border-slate-300 p-2" value={employeeForm.labor_registry} onChange={(e) => setEmployeeForm({ ...employeeForm, labor_registry: e.target.value })} placeholder="Matrícula / registro trabalhista" />
                  <select className="rounded-lg border border-slate-300 p-2" value={employeeForm.role} onChange={(e) => setEmployeeForm({ ...employeeForm, role: e.target.value })}>
                    <option value="doctor">Médico</option>
                    <option value="nurse">Enfermeiro</option>
                    <option value="technician">Técnico de enfermagem</option>
                    <option value="radiologist">Radiologista</option>
                    <option value="reception">Recepcionista</option>
                    <option value="treasury">Tesouraria</option>
                    <option value="services">Auxiliar de serviços gerais</option>
                    <option value="security">Segurança</option>
                  </select>
                  {employeeForm.role === "doctor" ? <input className="rounded-lg border border-slate-300 p-2" value={employeeForm.crm} onChange={(e) => setEmployeeForm({ ...employeeForm, crm: e.target.value.toUpperCase() })} placeholder="CRM" /> : null}
                  {employeeForm.role === "nurse" ? <input className="rounded-lg border border-slate-300 p-2" value={employeeForm.cre} onChange={(e) => setEmployeeForm({ ...employeeForm, cre: e.target.value.toUpperCase() })} placeholder="CRE" /> : null}
                  <select className="rounded-lg border border-slate-300 p-2" value={employeeForm.contract_type} onChange={(e) => setEmployeeForm({ ...employeeForm, contract_type: e.target.value })}>
                    <option value="CLT">CLT</option>
                    <option value="PJ">PJ</option>
                    <option value="Temporario">Temporário</option>
                    <option value="Estagio">Estágio</option>
                  </select>
                  <input className="rounded-lg border border-slate-300 p-2" type="date" value={employeeForm.admission_date} onChange={(e) => setEmployeeForm({ ...employeeForm, admission_date: e.target.value })} />
                  <input className="rounded-lg border border-slate-300 p-2" value={employeeForm.emergency_contact_name} onChange={(e) => setEmployeeForm({ ...employeeForm, emergency_contact_name: e.target.value })} placeholder="Contato de emergência" />
                  <input className="rounded-lg border border-slate-300 p-2" value={employeeForm.emergency_contact_phone} onChange={(e) => setEmployeeForm({ ...employeeForm, emergency_contact_phone: formatPhone(e.target.value) })} placeholder="Telefone de emergência" />
                  <label className="flex items-center gap-2 rounded-lg border border-slate-300 p-2 text-sm">
                    <input type="checkbox" checked={employeeForm.lgpd_consent} onChange={(e) => setEmployeeForm({ ...employeeForm, lgpd_consent: e.target.checked })} />
                    Consentimento LGPD e ciência de tratamento de dados do colaborador
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-slate-300 p-2">
                    <input type="checkbox" checked={employeeForm.active} onChange={(e) => setEmployeeForm({ ...employeeForm, active: e.target.checked })} />
                    Funcionário ativo
                  </label>
                  <button className="rounded-lg bg-slate-900 px-4 py-2 text-white" type="submit">Cadastrar funcionário</button>
                </div>
              </form> : null}

              {hasPermission("users:view") ? <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <h3 className="text-lg font-semibold">Equipe por função</h3>
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  {(adminSummary?.team_by_role || []).map((entry) => (
                    <li key={entry.role} className="rounded-lg bg-white p-2 ring-1 ring-slate-200">{entry.role} - {entry.count}</li>
                  ))}
                </ul>
                <h4 className="mt-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Usuários cadastrados</h4>
                <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-sm text-slate-700">
                  {users.map((entry) => (
                    <li key={entry.id} className="rounded-lg bg-white p-2 ring-1 ring-slate-200">{entry.name} - {entry.role} - CPF {entry.cpf || "não informado"} - {entry.professional_registration_type ? `${entry.professional_registration_type} ${entry.professional_registration_number}` : "sem conselho"} - {entry.active ? "ativo" : "inativo"}</li>
                  ))}
                </ul>
              </div> : null}

              {hasPermission("stock:view") ? <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <h3 className="text-lg font-semibold">Estoque clínico</h3>
                <p className="mt-1 text-sm text-slate-600">Seringas, esparadrapos, gases, medicamentos e demais insumos.</p>

                {hasPermission("stock:edit") ? <form onSubmit={handleCreateStockItem} className="mt-3 grid gap-2">
                  <input className="rounded-lg border border-slate-300 p-2" value={stockForm.name} onChange={(e) => setStockForm({ ...stockForm, name: e.target.value })} placeholder="Item" />
                  <div className="grid grid-cols-2 gap-2">
                    <input className="rounded-lg border border-slate-300 p-2" value={stockForm.category} onChange={(e) => setStockForm({ ...stockForm, category: e.target.value })} placeholder="Categoria" />
                    <input className="rounded-lg border border-slate-300 p-2" value={stockForm.unit} onChange={(e) => setStockForm({ ...stockForm, unit: e.target.value })} placeholder="Unidade" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input className="rounded-lg border border-slate-300 p-2" value={stockForm.quantity} onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })} placeholder="Qtd atual" />
                    <input className="rounded-lg border border-slate-300 p-2" value={stockForm.min_quantity} onChange={(e) => setStockForm({ ...stockForm, min_quantity: e.target.value })} placeholder="Qtd mínima" />
                  </div>
                  <button className="rounded-lg bg-cyan-700 px-4 py-2 text-white" type="submit">Cadastrar item</button>
                </form> : null}

                {hasPermission("stock:edit") ? <form onSubmit={handleStockMovement} className="mt-3 grid gap-2 border-t border-slate-200 pt-3">
                  <select className="rounded-lg border border-slate-300 p-2" value={stockMovementForm.item_id} onChange={(e) => setStockMovementForm({ ...stockMovementForm, item_id: e.target.value })}>
                    <option value="">Selecionar item</option>
                    {stockItems.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <select className="rounded-lg border border-slate-300 p-2" value={stockMovementForm.movement_type} onChange={(e) => setStockMovementForm({ ...stockMovementForm, movement_type: e.target.value })}>
                      <option value="entrada">Entrada</option>
                      <option value="saida">Saída</option>
                    </select>
                    <input className="rounded-lg border border-slate-300 p-2" value={stockMovementForm.amount} onChange={(e) => setStockMovementForm({ ...stockMovementForm, amount: e.target.value })} placeholder="Quantidade" />
                  </div>
                  <input className="rounded-lg border border-slate-300 p-2" value={stockMovementForm.note} onChange={(e) => setStockMovementForm({ ...stockMovementForm, note: e.target.value })} placeholder="Observação" />
                  <button className="rounded-lg bg-emerald-700 px-4 py-2 text-white" type="submit">Registrar movimentação</button>
                </form> : null}

                <ul className="mt-3 max-h-48 space-y-2 overflow-auto text-sm text-slate-700">
                  {stockItems.map((item) => (
                    <li key={item.id} className="rounded-lg bg-white p-2 ring-1 ring-slate-200">{item.name} - {item.quantity} {item.unit} (mín. {item.min_quantity})</li>
                  ))}
                </ul>
              </div> : null}
            </div>

            {(adminSummary?.low_stock || []).length > 0 ? <div className="mt-4 rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-200">
              <h3 className="text-lg font-semibold text-rose-900">Alertas de estoque baixo</h3>
              <ul className="mt-2 space-y-1 text-sm text-rose-800">
                {(adminSummary.low_stock || []).map((item) => (
                  <li key={`low-${item.id}`}>{item.name}: {item.quantity} {item.unit} (mínimo {item.min_quantity})</li>
                ))}
              </ul>
            </div> : null}
          </div> : null}
        </section>
      </div>
    </div>
  );
}