import csv
from datetime import datetime
from io import BytesIO
from io import StringIO

from fastapi import FastAPI, Header, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from sqlalchemy import func

from app.core.security import create_token, decode_token, hash_password, verify_password
from app.database import SessionLocal
from app.db_setup import init_db
from app.models import Appointment, AuditDocument, Call, EmployeeProfile, Guide, GuidePrintLog, MedicalRecord, MedicalRecordAttachment, MedicalRecordEvolution, Patient, Prescription, QueueTicket, Report, StockItem, TreasuryEntry, User
from app.schemas import AppointmentInput, CallAppointmentInput, CheckInInput, GuideIssueInput, LoginInput, MedicalRecordAttachmentInput, MedicalRecordInput, PatientInput, StockItemInput, StockMovementInput, TreasuryEntryInput, TriageInput, UserCreateInput

app = FastAPI(title="Clínica API")

init_db()

ROLE_LABELS = {
    "admin": "Administração",
    "reception": "Recepção",
    "nurse": "Enfermagem",
    "doctor": "Corpo clínico",
    "treasury": "Tesouraria",
    "technician": "Técnico de enfermagem",
    "radiologist": "Radiologia",
    "services": "Serviços gerais",
    "security": "Segurança",
}

ALLOWED_USER_ROLES = set(ROLE_LABELS.keys())

ROLE_PERMISSIONS = {
    "admin": {
        "patients:view", "patients:create", "appointments:view", "appointments:create", "queue:checkin", "queue:call",
        "records:view", "records:edit", "records:attach", "treasury:view", "treasury:edit", "documents:issue",
        "reports:view", "audit:view", "users:view", "users:manage", "stock:view", "stock:edit", "triage:call", "triage:edit"
    },
    "reception": {
        "patients:view", "patients:create", "appointments:view", "appointments:create", "queue:checkin",
        "records:view", "records:attach", "documents:issue"
    },
    "nurse": {
        "patients:view", "appointments:view", "queue:checkin", "records:view", "records:attach", "triage:call", "triage:edit"
    },
    "doctor": {
        "patients:view", "appointments:view", "queue:call", "records:view", "records:edit", "records:attach", "documents:issue"
    },
    "treasury": {
        "patients:view", "appointments:view", "treasury:view", "treasury:edit", "reports:view"
    },
    "technician": {
        "patients:view", "appointments:view"
    },
    "radiologist": {
        "patients:view", "appointments:view", "records:view"
    },
    "services": set(),
    "security": set(),
}


def normalize_digits(value: str) -> str:
    return "".join(char for char in value if char.isdigit())

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def build_user_context(user: User) -> dict:
    permissions = sorted(ROLE_PERMISSIONS.get(user.role, set()))
    return {
        "username": user.username,
        "role": user.role,
        "role_label": ROLE_LABELS.get(user.role, user.role),
        "name": user.name,
        "id": user.id,
        "permissions": permissions,
    }


def require_auth(authorization: str | None):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token ausente")

    token = authorization.split(" ", 1)[1]
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    session = SessionLocal()
    try:
        user = session.query(User).filter(User.username == payload["sub"], User.active.is_(True)).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário inválido")
        return build_user_context(user)
    finally:
        session.close()


def require_permission(current_user: dict, *permissions: str) -> None:
    user_permissions = set(current_user.get("permissions", []))
    if not any(permission in user_permissions for permission in permissions):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado para este setor")


def sync_patient_status(session, patient_id: int, status_value: str) -> None:
    patient = session.query(Patient).filter(Patient.id == patient_id).first()
    if patient:
        patient.status = status_value


def extract_guide_metadata(guide: Guide) -> tuple[str, str]:
    plan_name = ""
    guide_code = ""
    document_type = guide.document_type or ""

    # Novo formato: guia|plan=...|code=...
    if "|" in document_type:
        for token in document_type.split("|"):
            if token.startswith("plan="):
                plan_name = token.replace("plan=", "", 1).strip()
            elif token.startswith("code="):
                guide_code = token.replace("code=", "", 1).strip()
        return plan_name, guide_code

    # Compatibilidade: guia-PLANO-CODIGO (formato legado)
    legacy_tokens = document_type.split("-")
    if len(legacy_tokens) >= 2:
        plan_name = legacy_tokens[1].strip()
    if len(legacy_tokens) >= 3:
        guide_code = "-".join(legacy_tokens[2:]).strip()

    return plan_name, guide_code


def build_official_guide_number(guide_id: int) -> str:
    current_year = datetime.now().year
    return f"GC-{current_year}-{guide_id:06d}"


def register_guide_print_log(session, guide_id: int, printed_by: str, action: str) -> None:
    session.add(
        GuidePrintLog(
            guide_id=guide_id,
            action=action,
            printed_by=printed_by,
            printed_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
        )
    )


def build_global_guide_history_query(session, start_date: str | None, end_date: str | None, printed_by: str | None, action: str | None, guide_id: int | None):
    query = session.query(GuidePrintLog).join(Guide).join(Patient)

    if start_date:
        query = query.filter(GuidePrintLog.printed_at >= f"{start_date} 00:00")
    if end_date:
        query = query.filter(GuidePrintLog.printed_at <= f"{end_date} 23:59")
    if printed_by:
        query = query.filter(GuidePrintLog.printed_by.ilike(f"%{printed_by}%"))
    if action and action != "all":
        query = query.filter(GuidePrintLog.action == action)
    if guide_id:
        query = query.filter(GuidePrintLog.guide_id == guide_id)

    return query


def serialize_guide_print_log(item: GuidePrintLog) -> dict:
    return {
        "id": item.id,
        "guide_id": item.guide_id,
        "guide_official_number": build_official_guide_number(item.guide_id),
        "patient_name": item.guide.patient.name,
        "action": item.action,
        "printed_by": item.printed_by,
        "printed_at": item.printed_at,
    }


def render_guide_pdf_bytes(print_data: dict) -> bytes:
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 45

    def draw_row(label: str, value: str):
        nonlocal y
        pdf.setFont("Helvetica-Bold", 10)
        pdf.drawString(40, y, f"{label}:")
        pdf.setFont("Helvetica", 10)
        pdf.drawString(160, y, value or "")
        y -= 18

    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(40, y, "GUIA DE CONSULTA - CONVENIO")
    y -= 24

    draw_row("Numero oficial", print_data.get("official_number", ""))
    draw_row("Data/Hora", print_data.get("generated_at", ""))
    draw_row("Clinica", print_data.get("clinic", {}).get("name", ""))
    draw_row("CNPJ", print_data.get("clinic", {}).get("cnpj", ""))
    draw_row("Unidade", print_data.get("clinic", {}).get("unit", ""))
    draw_row("Telefone", print_data.get("clinic", {}).get("phone", ""))
    draw_row("Endereco", print_data.get("clinic", {}).get("address", ""))

    y -= 6
    pdf.line(40, y, width - 40, y)
    y -= 24

    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(40, y, "Dados do Paciente")
    y -= 20
    draw_row("Nome", print_data.get("patient", {}).get("name", ""))
    draw_row("CPF", print_data.get("patient", {}).get("cpf", ""))
    draw_row("Nascimento", print_data.get("patient", {}).get("birth_date", ""))
    draw_row("Telefone", print_data.get("patient", {}).get("phone", ""))

    y -= 8
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(40, y, "Dados do Convenio")
    y -= 20
    draw_row("Plano", print_data.get("plan", {}).get("name", "NAO INFORMADO"))
    draw_row("Codigo da guia", print_data.get("plan", {}).get("guide_code", ""))
    draw_row("Guia assinada na recepcao", "SIM" if print_data.get("signed_at_reception") else "NAO")

    y -= 8
    pdf.setFont("Helvetica", 10)
    pdf.drawString(40, y, "Declaro que fui atendido(a) e autorizo o faturamento da consulta junto ao convenio informado.")

    y -= 46
    pdf.line(60, y, 240, y)
    pdf.line(340, y, 520, y)
    y -= 14
    pdf.setFont("Helvetica", 9)
    pdf.drawString(102, y, "Assinatura do Paciente")
    pdf.drawString(356, y, f"Assinatura da Recepcao ({print_data.get('issued_by', '')})")

    pdf.setFont("Helvetica", 8)
    pdf.drawString(40, 32, "Documento operacional para faturamento de consulta por convenio.")
    pdf.showPage()
    pdf.save()
    return buffer.getvalue()


def serialize_medical_record(session, medical_record: MedicalRecord | None) -> dict:
    if not medical_record:
        return {
            "id": None,
            "status": None,
            "updated_by": None,
            "updated_at": None,
            "chief_complaint": None,
            "anamnesis": None,
            "vital_signs": None,
            "allergies": None,
            "physical_exam": None,
            "current_medications": None,
            "icd10_code": None,
            "diagnosis": None,
            "care_plan": None,
            "prescriptions_summary": None,
            "evolutions": [],
            "attachments": [],
            "timeline": [],
        }

    evolutions = sorted(medical_record.evolutions, key=lambda item: item.recorded_at, reverse=True)
    attachments = sorted(medical_record.attachments, key=lambda item: item.created_at, reverse=True)
    patient_id = medical_record.appointment.patient_id
    timeline_records = session.query(MedicalRecord).join(Appointment).filter(Appointment.patient_id == patient_id).order_by(MedicalRecord.updated_at.desc()).all()

    return {
        "id": medical_record.id,
        "status": medical_record.status,
        "updated_by": medical_record.updated_by,
        "updated_at": medical_record.updated_at,
        "chief_complaint": medical_record.chief_complaint,
        "anamnesis": medical_record.anamnesis,
        "vital_signs": medical_record.vital_signs,
        "allergies": medical_record.allergies,
        "physical_exam": medical_record.physical_exam,
        "current_medications": medical_record.current_medications,
        "icd10_code": medical_record.icd10_code,
        "diagnosis": medical_record.diagnosis,
        "care_plan": medical_record.care_plan,
        "prescriptions_summary": medical_record.prescriptions_summary,
        "evolutions": [
            {
                "id": evolution.id,
                "author_name": evolution.author_name,
                "recorded_at": evolution.recorded_at,
                "type": evolution.evolution_type,
                "note": evolution.note,
            }
            for evolution in evolutions
        ],
        "attachments": [
            {
                "id": attachment.id,
                "title": attachment.title,
                "category": attachment.category,
                "reference_url": attachment.reference_url,
                "uploaded_by": attachment.uploaded_by,
                "created_at": attachment.created_at,
            }
            for attachment in attachments
        ],
        "timeline": [
            {
                "appointment_id": item.appointment_id,
                "updated_at": item.updated_at,
                "diagnosis": item.diagnosis,
                "icd10_code": item.icd10_code,
                "author_name": item.updated_by,
                "status": item.status,
            }
            for item in timeline_records
        ],
    }


def serialize_workflow(session, appointment: Appointment) -> dict:
    queue_ticket = appointment.queue_ticket
    treasury_entry = appointment.treasury_entry
    return {
        "id": appointment.id,
        "patient_id": appointment.patient_id,
        "patient_name": appointment.patient.name,
        "professional_id": appointment.professional_id,
        "professional_name": appointment.professional.name,
        "scheduled_at": appointment.scheduled_at,
        "unit_name": appointment.unit_name,
        "shift": appointment.shift,
        "specialty": appointment.specialty,
        "status": appointment.status,
        "notes": appointment.notes,
        "ticket": {
            "code": queue_ticket.ticket_code if queue_ticket else None,
            "status": queue_ticket.queue_status if queue_ticket else None,
            "priority": queue_ticket.priority if queue_ticket else None,
            "room": queue_ticket.room if queue_ticket else None,
            "called_at": queue_ticket.called_at if queue_ticket else None,
        },
        "medical_record": serialize_medical_record(session, appointment.medical_record),
        "treasury": {
            "id": treasury_entry.id if treasury_entry else None,
            "description": treasury_entry.description if treasury_entry else None,
            "amount_cents": treasury_entry.amount_cents if treasury_entry else None,
            "payment_method": treasury_entry.payment_method if treasury_entry else None,
            "status": treasury_entry.status if treasury_entry else None,
            "due_date": treasury_entry.due_date if treasury_entry else None,
            "paid_at": treasury_entry.paid_at if treasury_entry else None,
        },
    }


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/login")
def login(data: LoginInput):
    session = SessionLocal()
    try:
        user = session.query(User).filter(User.username == data.username, User.active.is_(True)).first()
        if not user or not verify_password(data.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Credenciais inválidas")
        return {"token": create_token(user.username, user.role), "user": build_user_context(user)}
    finally:
        session.close()


@app.get("/me")
def get_me(authorization: str | None = Header(default=None)):
    return require_auth(authorization)


@app.get("/patients")
def list_patients(authorization: str | None = Header(default=None)):
    current_user = require_auth(authorization)
    require_permission(current_user, "patients:view")
    session = SessionLocal()
    try:
        patients = session.query(Patient).all()
        return [
            {
                "id": p.id,
                "name": p.name,
                "cpf": p.cpf,
                "phone": p.phone,
                "birth_date": p.birth_date,
                "address": p.address,
                "consent_lgpd": p.consent_lgpd,
                "responsible_name": p.responsible_name,
                "status": p.status,
            }
            for p in patients
        ]
    finally:
        session.close()


@app.post("/patients", status_code=201)
def create_patient(patient: PatientInput, authorization: str | None = Header(default=None)):
    current_user = require_auth(authorization)
    require_permission(current_user, "patients:create")
    session = SessionLocal()
    try:
        new_patient = Patient(**patient.model_dump(), status="aguardando")
        session.add(new_patient)
        session.commit()
        session.refresh(new_patient)
        return {
            "id": new_patient.id,
            "name": new_patient.name,
            "cpf": new_patient.cpf,
            "phone": new_patient.phone,
            "birth_date": new_patient.birth_date,
            "address": new_patient.address,
            "consent_lgpd": new_patient.consent_lgpd,
            "responsible_name": new_patient.responsible_name,
            "status": new_patient.status,
        }
    finally:
        session.close()


@app.get("/calls")
def list_calls(authorization: str | None = Header(default=None)):
    current_user = require_auth(authorization)
    require_permission(current_user, "appointments:view")
    session = SessionLocal()
    try:
        calls = session.query(Call).all()
        return [{"id": c.id, "patient_id": c.patient_id, "patient_name": c.patient.name, "room": c.room, "status": c.status} for c in calls]
    finally:
        session.close()


@app.get("/public/calls")
def list_public_calls():
    session = SessionLocal()
    try:
        tickets = session.query(QueueTicket).join(Appointment).order_by(QueueTicket.id.desc()).limit(20).all()
        result = []
        for ticket in tickets:
            appointment = ticket.appointment
            queue_status = ticket.queue_status
            destination_type = "Aguardando"
            destination_label = "Aguardando chamada"

            if queue_status == "chamado_triagem":
                destination_type = "Triagem"
                destination_label = ticket.room or "Sala de triagem"
            elif queue_status == "chamado":
                destination_type = "Consultório"
                destination_label = ticket.room or "Consultório"
            elif appointment.treasury_entry and appointment.treasury_entry.status in {"pendente", "faturado"}:
                destination_type = "Tesouraria"
                destination_label = "Tesouraria"
            elif queue_status == "aguardando_medico":
                destination_type = "Aguardando médico"
                destination_label = "Sala de espera"

            result.append(
                {
                    "id": ticket.id,
                    "ticket_code": ticket.ticket_code,
                    "patient_id": appointment.patient_id,
                    "patient_name": appointment.patient.name,
                    "room": ticket.room,
                    "status": queue_status,
                    "called_at": ticket.called_at,
                    "destination_type": destination_type,
                    "destination_label": destination_label,
                }
            )
        return result
    finally:
        session.close()


@app.post("/calls", status_code=201)
def create_call(patient_id: int, room: str, authorization: str | None = Header(default=None)):
    current_user = require_auth(authorization)
    require_permission(current_user, "queue:call")
    session = SessionLocal()
    try:
        patient = session.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Paciente não encontrado")
        new_call = Call(patient_id=patient_id, room=room, status="em andamento")
        session.add(new_call)
        session.commit()
        session.refresh(new_call)
        return {"id": new_call.id, "patient_id": new_call.patient_id, "patient_name": patient.name, "room": new_call.room, "status": new_call.status}
    finally:
        session.close()


@app.get("/reports")
def list_reports(authorization: str | None = Header(default=None)):
    current_user = require_auth(authorization)
    require_permission(current_user, "reports:view")
    session = SessionLocal()
    try:
        reports = session.query(Report).all()
        return [{"id": r.id, "title": r.title, "type": r.report_type, "created_at": r.created_at} for r in reports]
    finally:
        session.close()


@app.get("/audit-documents")
def list_audit_documents(authorization: str | None = Header(default=None)):
    current_user = require_auth(authorization)
    require_permission(current_user, "audit:view")
    session = SessionLocal()
    try:
        documents = session.query(AuditDocument).all()
        return [{"id": d.id, "title": d.title, "category": d.category, "status": d.status} for d in documents]
    finally:
        session.close()


@app.get("/prescriptions")
def list_prescriptions(authorization: str | None = Header(default=None)):
    current_user = require_auth(authorization)
    require_permission(current_user, "documents:issue", "records:view")
    session = SessionLocal()
    try:
        prescriptions = session.query(Prescription).all()
        return [{"id": p.id, "patient_id": p.patient_id, "patient_name": p.patient.name, "issued_by": p.issued_by, "type": p.document_type, "status": p.status} for p in prescriptions]
    finally:
        session.close()


@app.get("/guides")
def list_guides(authorization: str | None = Header(default=None)):
    current_user = require_auth(authorization)
    require_permission(current_user, "documents:issue", "records:view")
    session = SessionLocal()
    try:
        guides = session.query(Guide).all()
        return [
            {
                "id": g.id,
                "patient_id": g.patient_id,
                "patient_name": g.patient.name,
                "type": g.document_type,
                "status": g.status,
                "plan_name": extract_guide_metadata(g)[0],
                "guide_code": extract_guide_metadata(g)[1],
            }
            for g in guides
        ]
    finally:
        session.close()


@app.get("/guides/{guide_id}/print-data")
def get_guide_print_data(guide_id: int, authorization: str | None = Header(default=None)):
    current_user = require_auth(authorization)
    require_permission(current_user, "documents:issue", "records:view")

    session = SessionLocal()
    try:
        guide = session.query(Guide).filter(Guide.id == guide_id).first()
        if not guide:
            raise HTTPException(status_code=404, detail="Guia não encontrada")

        patient = guide.patient
        plan_name, guide_code = extract_guide_metadata(guide)
        is_signed = guide.status == "assinada"

        register_guide_print_log(session, guide.id, current_user["name"], "visualizacao")
        session.commit()

        return {
            "guide_id": guide.id,
            "official_number": build_official_guide_number(guide.id),
            "generated_at": datetime.now().strftime("%d/%m/%Y %H:%M"),
            "clinic": {
                "name": "Clínica Médica Integrada",
                "cnpj": "00.000.000/0001-00",
                "unit": "Unidade Centro",
                "phone": "(11) 3000-0000",
                "address": "Rua Exemplo, 100 - Centro",
            },
            "patient": {
                "id": patient.id,
                "name": patient.name,
                "cpf": patient.cpf,
                "birth_date": patient.birth_date,
                "phone": patient.phone,
            },
            "plan": {
                "name": plan_name or "NÃO INFORMADO",
                "guide_code": guide_code or f"GUIA-{guide.id:06d}",
            },
            "signed_at_reception": is_signed,
            "issued_by": current_user["name"],
        }
    finally:
        session.close()


@app.get("/guides/{guide_id}/pdf")
def get_guide_pdf(guide_id: int, authorization: str | None = Header(default=None)):
    current_user = require_auth(authorization)
    require_permission(current_user, "documents:issue", "records:view")

    session = SessionLocal()
    try:
        guide = session.query(Guide).filter(Guide.id == guide_id).first()
        if not guide:
            raise HTTPException(status_code=404, detail="Guia não encontrada")

        patient = guide.patient
        plan_name, guide_code = extract_guide_metadata(guide)
        print_data = {
            "guide_id": guide.id,
            "official_number": build_official_guide_number(guide.id),
            "generated_at": datetime.now().strftime("%d/%m/%Y %H:%M"),
            "clinic": {
                "name": "Clínica Médica Integrada",
                "cnpj": "00.000.000/0001-00",
                "unit": "Unidade Centro",
                "phone": "(11) 3000-0000",
                "address": "Rua Exemplo, 100 - Centro",
            },
            "patient": {
                "id": patient.id,
                "name": patient.name,
                "cpf": patient.cpf,
                "birth_date": patient.birth_date,
                "phone": patient.phone,
            },
            "plan": {
                "name": plan_name or "NÃO INFORMADO",
                "guide_code": guide_code or f"GUIA-{guide.id:06d}",
            },
            "signed_at_reception": guide.status == "assinada",
            "issued_by": current_user["name"],
        }

        pdf_bytes = render_guide_pdf_bytes(print_data)
        register_guide_print_log(session, guide.id, current_user["name"], "download_pdf")
        session.commit()

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={print_data['official_number']}.pdf"},
        )
    finally:
        session.close()


@app.get("/guides/{guide_id}/print-history")
def get_guide_print_history(guide_id: int, authorization: str | None = Header(default=None)):
    current_user = require_auth(authorization)
    require_permission(current_user, "documents:issue", "records:view")

    session = SessionLocal()
    try:
        guide = session.query(Guide).filter(Guide.id == guide_id).first()
        if not guide:
            raise HTTPException(status_code=404, detail="Guia não encontrada")

        logs = session.query(GuidePrintLog).filter(GuidePrintLog.guide_id == guide_id).order_by(GuidePrintLog.id.desc()).all()
        return [
            {
                "id": item.id,
                "guide_id": item.guide_id,
                "action": item.action,
                "printed_by": item.printed_by,
                "printed_at": item.printed_at,
            }
            for item in logs
        ]
    finally:
        session.close()


@app.get("/guides/print-history/global")
def get_global_guide_print_history(
    authorization: str | None = Header(default=None),
    start_date: str | None = None,
    end_date: str | None = None,
    printed_by: str | None = None,
    action: str | None = None,
    guide_id: int | None = None,
    page: int = 1,
    page_size: int = 20,
):
    current_user = require_auth(authorization)
    require_permission(current_user, "users:view")

    session = SessionLocal()
    try:
        safe_page = max(page, 1)
        safe_page_size = max(min(page_size, 100), 1)

        query = build_global_guide_history_query(session, start_date, end_date, printed_by, action, guide_id)
        total_items = query.count()
        total_pages = (total_items + safe_page_size - 1) // safe_page_size if total_items > 0 else 1
        offset = (safe_page - 1) * safe_page_size

        logs = query.order_by(GuidePrintLog.id.desc()).offset(offset).limit(safe_page_size).all()
        return {
            "items": [serialize_guide_print_log(item) for item in logs],
            "page": safe_page,
            "page_size": safe_page_size,
            "total_items": total_items,
            "total_pages": total_pages,
        }
    finally:
        session.close()


@app.get("/guides/print-history/global/csv")
def export_global_guide_print_history_csv(
    authorization: str | None = Header(default=None),
    start_date: str | None = None,
    end_date: str | None = None,
    printed_by: str | None = None,
    action: str | None = None,
    guide_id: int | None = None,
):
    current_user = require_auth(authorization)
    require_permission(current_user, "users:view")

    session = SessionLocal()
    try:
        query = build_global_guide_history_query(session, start_date, end_date, printed_by, action, guide_id)
        logs = query.order_by(GuidePrintLog.id.desc()).all()

        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(["id", "guide_id", "guide_official_number", "patient_name", "action", "printed_by", "printed_at"])
        for item in logs:
            row = serialize_guide_print_log(item)
            writer.writerow([
                row["id"],
                row["guide_id"],
                row["guide_official_number"],
                row["patient_name"],
                row["action"],
                row["printed_by"],
                row["printed_at"],
            ])

        csv_content = output.getvalue()
        return Response(
            content=csv_content,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename=auditoria_guias_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"},
        )
    finally:
        session.close()


@app.get("/users")
def list_users(authorization: str | None = Header(default=None)):
    current_user = require_auth(authorization)
    require_permission(current_user, "users:view")

    session = SessionLocal()
    try:
        users = session.query(User).all()
        return [
            {
                "id": user.id,
                "name": user.name,
                "username": user.username,
                "role": user.role,
                "active": user.active,
                "cpf": user.profile.cpf if user.profile else "",
                "address": user.profile.address if user.profile else "",
                "labor_registry": user.profile.labor_registry if user.profile else "",
                "professional_registration_type": user.profile.professional_registration_type if user.profile else "",
                "professional_registration_number": user.profile.professional_registration_number if user.profile else "",
                "contract_type": user.profile.contract_type if user.profile else "",
                "admission_date": user.profile.admission_date if user.profile else "",
                "emergency_contact_name": user.profile.emergency_contact_name if user.profile else "",
                "emergency_contact_phone": user.profile.emergency_contact_phone if user.profile else "",
                "lgpd_consent": user.profile.lgpd_consent if user.profile else False,
            }
            for user in users
        ]
    finally:
        session.close()


@app.post("/users", status_code=201)
def create_user(data: UserCreateInput, authorization: str | None = Header(default=None)):
    current_user = require_auth(authorization)
    require_permission(current_user, "users:manage")

    normalized_role = data.role.lower().strip()
    if normalized_role not in ALLOWED_USER_ROLES:
        raise HTTPException(status_code=400, detail="Função inválida para cadastro")

    cpf_digits = normalize_digits(data.cpf)
    if len(cpf_digits) != 11:
        raise HTTPException(status_code=400, detail="CPF do colaborador inválido")

    if not data.lgpd_consent:
        raise HTTPException(status_code=400, detail="Consentimento LGPD é obrigatório para cadastro")

    professional_registration_type = ""
    professional_registration_number = ""
    if normalized_role == "doctor":
        if not data.crm.strip():
            raise HTTPException(status_code=400, detail="CRM é obrigatório para médico")
        professional_registration_type = "CRM"
        professional_registration_number = data.crm.strip().upper()
    elif normalized_role == "nurse":
        if not data.cre.strip():
            raise HTTPException(status_code=400, detail="CRE é obrigatório para enfermagem")
        professional_registration_type = "CRE"
        professional_registration_number = data.cre.strip().upper()

    session = SessionLocal()
    try:
        existing_user = session.query(User).filter(User.username == data.username).first()
        if existing_user:
            raise HTTPException(status_code=409, detail="Usuário já existe")

        new_user = User(
            username=data.username,
            password_hash=hash_password(data.password),
            name=data.name,
            role=normalized_role,
            active=data.active,
        )
        session.add(new_user)
        session.flush()

        session.add(
            EmployeeProfile(
                user_id=new_user.id,
                cpf=cpf_digits,
                address=data.address.strip(),
                labor_registry=data.labor_registry.strip(),
                professional_registration_type=professional_registration_type,
                professional_registration_number=professional_registration_number,
                contract_type=data.contract_type.strip(),
                admission_date=data.admission_date.strip(),
                emergency_contact_name=data.emergency_contact_name.strip(),
                emergency_contact_phone=data.emergency_contact_phone.strip(),
                lgpd_consent=data.lgpd_consent,
            )
        )

        session.commit()
        session.refresh(new_user)
        session.refresh(new_user, ["profile"])
        return {
            "id": new_user.id,
            "name": new_user.name,
            "username": new_user.username,
            "role": new_user.role,
            "active": new_user.active,
            "cpf": new_user.profile.cpf if new_user.profile else "",
            "address": new_user.profile.address if new_user.profile else "",
            "labor_registry": new_user.profile.labor_registry if new_user.profile else "",
            "professional_registration_type": new_user.profile.professional_registration_type if new_user.profile else "",
            "professional_registration_number": new_user.profile.professional_registration_number if new_user.profile else "",
            "contract_type": new_user.profile.contract_type if new_user.profile else "",
            "admission_date": new_user.profile.admission_date if new_user.profile else "",
            "emergency_contact_name": new_user.profile.emergency_contact_name if new_user.profile else "",
            "emergency_contact_phone": new_user.profile.emergency_contact_phone if new_user.profile else "",
            "lgpd_consent": new_user.profile.lgpd_consent if new_user.profile else False,
        }
    finally:
        session.close()


@app.get("/professionals")
def list_professionals(authorization: str | None = Header(default=None)):
    current_user = require_auth(authorization)
    require_permission(current_user, "appointments:view", "appointments:create")
    session = SessionLocal()
    try:
        professionals = session.query(User).filter(User.role.in_(["doctor", "nurse"]), User.active.is_(True)).all()
        return [{"id": user.id, "name": user.name, "role": user.role} for user in professionals]
    finally:
        session.close()


@app.get("/appointments")
def list_appointments(authorization: str | None = Header(default=None)):
    current_user = require_auth(authorization)
    require_permission(current_user, "appointments:view")
    session = SessionLocal()
    try:
        appointments = session.query(Appointment).join(User).order_by(Appointment.scheduled_at.asc()).all()
        return [serialize_workflow(session, appointment) for appointment in appointments]
    finally:
        session.close()


@app.post("/appointments", status_code=201)
def create_appointment(data: AppointmentInput, authorization: str | None = Header(default=None)):
    current_user = require_auth(authorization)
    require_permission(current_user, "appointments:create")

    session = SessionLocal()
    try:
        professional = session.query(User).filter(User.id == data.professional_id, User.active.is_(True)).first()
        if not professional:
            raise HTTPException(status_code=404, detail="Profissional não encontrado")
        patient = session.query(Patient).filter(Patient.id == data.patient_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Paciente não encontrado")

        appointment = Appointment(
            patient_id=data.patient_id,
            professional_id=data.professional_id,
            scheduled_at=data.scheduled_at,
            unit_name=data.unit_name,
            shift=data.shift,
            specialty=data.specialty,
            status="agendado",
            notes=data.notes,
        )
        session.add(appointment)
        session.commit()
        session.refresh(appointment)
        session.refresh(professional)
        return serialize_workflow(session, appointment)
    finally:
        session.close()


@app.post("/appointments/{appointment_id}/check-in")
def check_in_appointment(appointment_id: int, data: CheckInInput, authorization: str | None = Header(default=None)):
    current_user = require_auth(authorization)
    require_permission(current_user, "queue:checkin")

    session = SessionLocal()
    try:
        appointment = session.query(Appointment).join(User).filter(Appointment.id == appointment_id).first()
        if not appointment:
            raise HTTPException(status_code=404, detail="Consulta não encontrada")

        ticket = appointment.queue_ticket
        if not ticket:
            ticket_sequence = session.query(QueueTicket).count() + 1
            ticket = QueueTicket(
                appointment_id=appointment.id,
                ticket_code=f"S{ticket_sequence:03d}",
                queue_status="aguardando",
                priority=data.priority,
            )
            session.add(ticket)
        else:
            ticket.queue_status = "aguardando"
            ticket.priority = data.priority

        appointment.status = "aguardando triagem"
        sync_patient_status(session, appointment.patient_id, "em espera")
        session.commit()
        session.refresh(appointment)
        return serialize_workflow(session, appointment)
    finally:
        session.close()


@app.post("/appointments/{appointment_id}/triage/call")
def call_to_triage(appointment_id: int, data: CallAppointmentInput, authorization: str | None = Header(default=None)):
    current_user = require_auth(authorization)
    require_permission(current_user, "triage:call")

    session = SessionLocal()
    try:
        appointment = session.query(Appointment).join(User).filter(Appointment.id == appointment_id).first()
        if not appointment:
            raise HTTPException(status_code=404, detail="Consulta não encontrada")
        if not appointment.queue_ticket:
            raise HTTPException(status_code=409, detail="Realize o check-in antes de chamar para triagem")

        appointment.queue_ticket.queue_status = "chamado_triagem"
        appointment.queue_ticket.room = data.room
        appointment.queue_ticket.called_at = datetime.now().strftime("%Y-%m-%d %H:%M")
        appointment.status = "em triagem"
        sync_patient_status(session, appointment.patient_id, "em triagem")

        session.add(Call(patient_id=appointment.patient_id, room=data.room, status="em andamento"))
        session.commit()
        session.refresh(appointment)
        return serialize_workflow(session, appointment)
    finally:
        session.close()


@app.post("/appointments/{appointment_id}/triage")
def save_triage(appointment_id: int, data: TriageInput, authorization: str | None = Header(default=None)):
    current_user = require_auth(authorization)
    require_permission(current_user, "triage:edit")

    session = SessionLocal()
    try:
        appointment = session.query(Appointment).join(User).filter(Appointment.id == appointment_id).first()
        if not appointment:
            raise HTTPException(status_code=404, detail="Consulta não encontrada")
        if not appointment.queue_ticket:
            raise HTTPException(status_code=409, detail="Check-in pendente para esta consulta")

        vital_signs = (
            f"PA {data.blood_pressure}; FC {data.heart_rate}; Temp {data.temperature_c} C; "
            f"SatO2 {data.oxygen_saturation or 'N/A'}; FR {data.respiratory_rate or 'N/A'}; Peso {data.weight_kg or 'N/A'}kg"
        )

        record = appointment.medical_record
        if not record:
            record = MedicalRecord(
                appointment_id=appointment.id,
                chief_complaint=data.chief_complaint,
                anamnesis="Triagem inicial realizada pela enfermagem.",
                vital_signs=vital_signs,
                allergies=data.allergies,
                physical_exam="Aguardando avaliação médica.",
                current_medications=data.current_medications,
                icd10_code="",
                diagnosis="Em avaliação médica",
                care_plan="Encaminhar para consulta médica.",
                prescriptions_summary="",
                status="triado",
                updated_by=current_user["name"],
                updated_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
            )
            session.add(record)
            session.flush()
        else:
            record.chief_complaint = data.chief_complaint
            record.vital_signs = vital_signs
            record.allergies = data.allergies
            record.current_medications = data.current_medications
            record.status = "triado"
            record.updated_by = current_user["name"]
            record.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M")

        session.add(MedicalRecordEvolution(
            medical_record_id=record.id,
            appointment_id=appointment.id,
            author_name=current_user["name"],
            recorded_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
            evolution_type="triagem",
            note=data.triage_note,
        ))

        appointment.status = "aguardando medico"
        appointment.queue_ticket.queue_status = "aguardando_medico"
        appointment.queue_ticket.room = None
        sync_patient_status(session, appointment.patient_id, "aguardando médico")

        session.commit()
        session.refresh(appointment)
        return serialize_workflow(session, appointment)
    finally:
        session.close()


@app.post("/appointments/{appointment_id}/call")
def call_appointment(appointment_id: int, data: CallAppointmentInput, authorization: str | None = Header(default=None)):
    current_user = require_auth(authorization)
    require_permission(current_user, "queue:call")

    session = SessionLocal()
    try:
        appointment = session.query(Appointment).join(User).filter(Appointment.id == appointment_id).first()
        if not appointment:
            raise HTTPException(status_code=404, detail="Consulta não encontrada")
        if not appointment.queue_ticket:
            raise HTTPException(status_code=409, detail="Realize o check-in antes do chamado")
        if appointment.status not in {"aguardando medico", "em triagem", "em espera", "aguardando triagem"}:
            raise HTTPException(status_code=409, detail="Paciente ainda não está pronto para chamada médica")

        appointment.queue_ticket.queue_status = "chamado"
        appointment.queue_ticket.room = data.room
        appointment.queue_ticket.called_at = datetime.now().strftime("%Y-%m-%d %H:%M")
        appointment.status = "em atendimento"
        sync_patient_status(session, appointment.patient_id, "em atendimento")

        session.add(Call(patient_id=appointment.patient_id, room=data.room, status="em andamento"))
        session.commit()
        session.refresh(appointment)
        return serialize_workflow(session, appointment)
    finally:
        session.close()


@app.get("/medical-records")
def list_medical_records(authorization: str | None = Header(default=None)):
    current_user = require_auth(authorization)
    require_permission(current_user, "records:view")
    session = SessionLocal()
    try:
        records = session.query(MedicalRecord).join(Appointment).join(User).order_by(MedicalRecord.updated_at.desc()).all()
        return [serialize_workflow(session, record.appointment) for record in records]
    finally:
        session.close()


@app.post("/appointments/{appointment_id}/medical-record")
def save_medical_record(appointment_id: int, data: MedicalRecordInput, authorization: str | None = Header(default=None)):
    current_user = require_auth(authorization)
    require_permission(current_user, "records:edit")

    session = SessionLocal()
    try:
        appointment = session.query(Appointment).join(User).filter(Appointment.id == appointment_id).first()
        if not appointment:
            raise HTTPException(status_code=404, detail="Consulta não encontrada")

        record = appointment.medical_record
        if not record:
            record = MedicalRecord(
                appointment_id=appointment.id,
                chief_complaint=data.chief_complaint,
                anamnesis=data.anamnesis,
                vital_signs=data.vital_signs,
                allergies=data.allergies,
                physical_exam=data.physical_exam,
                current_medications=data.current_medications,
                icd10_code=data.icd10_code,
                diagnosis=data.diagnosis,
                care_plan=data.care_plan,
                prescriptions_summary=data.prescriptions_summary,
                status=data.status,
                updated_by=current_user["name"],
                updated_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
            )
            session.add(record)
        else:
            record.chief_complaint = data.chief_complaint
            record.anamnesis = data.anamnesis
            record.vital_signs = data.vital_signs
            record.allergies = data.allergies
            record.physical_exam = data.physical_exam
            record.current_medications = data.current_medications
            record.icd10_code = data.icd10_code
            record.diagnosis = data.diagnosis
            record.care_plan = data.care_plan
            record.prescriptions_summary = data.prescriptions_summary
            record.status = data.status
            record.updated_by = current_user["name"]
            record.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M")

        session.flush()
        session.add(MedicalRecordEvolution(
            medical_record_id=record.id,
            appointment_id=appointment.id,
            author_name=current_user["name"],
            recorded_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
            evolution_type=data.evolution_type,
            note=data.evolution_note,
        ))

        appointment.status = "atendido"
        sync_patient_status(session, appointment.patient_id, "atendido")
        session.commit()
        session.refresh(appointment)
        return serialize_workflow(session, appointment)
    finally:
        session.close()


@app.post("/appointments/{appointment_id}/attachments")
def add_medical_record_attachment(appointment_id: int, data: MedicalRecordAttachmentInput, authorization: str | None = Header(default=None)):
    current_user = require_auth(authorization)
    require_permission(current_user, "records:attach")

    session = SessionLocal()
    try:
        appointment = session.query(Appointment).join(User).filter(Appointment.id == appointment_id).first()
        if not appointment:
            raise HTTPException(status_code=404, detail="Consulta não encontrada")
        if not appointment.medical_record:
            raise HTTPException(status_code=409, detail="Crie o prontuário antes de anexar documentos")

        session.add(MedicalRecordAttachment(
            medical_record_id=appointment.medical_record.id,
            appointment_id=appointment.id,
            title=data.title,
            category=data.category,
            reference_url=data.reference_url,
            uploaded_by=current_user["name"],
            created_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
        ))
        session.commit()
        session.refresh(appointment)
        return serialize_workflow(session, appointment)
    finally:
        session.close()


@app.get("/treasury")
def list_treasury_entries(authorization: str | None = Header(default=None)):
    current_user = require_auth(authorization)
    require_permission(current_user, "treasury:view")
    session = SessionLocal()
    try:
        entries = session.query(TreasuryEntry).join(Appointment).join(User).order_by(TreasuryEntry.id.desc()).all()
        return [serialize_workflow(session, entry.appointment) for entry in entries]
    finally:
        session.close()


@app.post("/appointments/{appointment_id}/treasury")
def save_treasury_entry(appointment_id: int, data: TreasuryEntryInput, authorization: str | None = Header(default=None)):
    current_user = require_auth(authorization)
    require_permission(current_user, "treasury:edit")

    session = SessionLocal()
    try:
        appointment = session.query(Appointment).join(User).filter(Appointment.id == appointment_id).first()
        if not appointment:
            raise HTTPException(status_code=404, detail="Consulta não encontrada")

        entry = appointment.treasury_entry
        if not entry:
            entry = TreasuryEntry(
                appointment_id=appointment.id,
                description=data.description,
                amount_cents=data.amount_cents,
                payment_method=data.payment_method,
                status=data.status,
                due_date=data.due_date,
                paid_at=data.paid_at,
            )
            session.add(entry)
        else:
            entry.description = data.description
            entry.amount_cents = data.amount_cents
            entry.payment_method = data.payment_method
            entry.status = data.status
            entry.due_date = data.due_date
            entry.paid_at = data.paid_at

        if data.status == "pago":
            appointment.status = "finalizado"
            sync_patient_status(session, appointment.patient_id, "finalizado")

        session.commit()
        session.refresh(appointment)
        return serialize_workflow(session, appointment)
    finally:
        session.close()


@app.get("/workflow/board")
def workflow_board(authorization: str | None = Header(default=None)):
    current_user = require_auth(authorization)
    require_permission(current_user, "appointments:view")
    session = SessionLocal()
    try:
        appointments = session.query(Appointment).join(User).order_by(Appointment.scheduled_at.asc()).all()
        return [serialize_workflow(session, appointment) for appointment in appointments]
    finally:
        session.close()


@app.post("/prescriptions", status_code=201)
def create_prescription(patient_id: int, issued_by: str, authorization: str | None = Header(default=None)):
    current_user = require_auth(authorization)
    require_permission(current_user, "documents:issue")
    session = SessionLocal()
    try:
        patient = session.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Paciente não encontrado")
        new_prescription = Prescription(patient_id=patient_id, issued_by=issued_by, document_type="receita", status="emitida")
        session.add(new_prescription)
        session.commit()
        session.refresh(new_prescription)
        return {"id": new_prescription.id, "patient_id": new_prescription.patient_id, "patient_name": patient.name, "issued_by": new_prescription.issued_by, "type": new_prescription.document_type, "status": new_prescription.status}
    finally:
        session.close()


@app.post("/guides", status_code=201)
def create_guide(data: GuideIssueInput, authorization: str | None = Header(default=None)):
    current_user = require_auth(authorization)
    require_permission(current_user, "documents:issue")
    session = SessionLocal()
    try:
        patient = session.query(Patient).filter(Patient.id == data.patient_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Paciente não encontrado")
        plan_suffix = f"plan={data.plan_name.strip()}" if data.plan_name else "plan="
        guide_suffix = f"code={data.guide_code.strip()}" if data.guide_code else "code="
        status_value = "assinada" if data.signed_at_reception else "emitida"
        new_guide = Guide(patient_id=data.patient_id, document_type=f"guia|{plan_suffix}|{guide_suffix}", status=status_value)
        session.add(new_guide)
        session.commit()
        session.refresh(new_guide)
        return {"id": new_guide.id, "patient_id": new_guide.patient_id, "patient_name": patient.name, "type": new_guide.document_type, "status": new_guide.status}
    finally:
        session.close()


@app.get("/admin/summary")
def admin_summary(authorization: str | None = Header(default=None)):
    current_user = require_auth(authorization)
    require_permission(current_user, "users:view")

    session = SessionLocal()
    try:
        total_patients = session.query(func.count(Patient.id)).scalar() or 0
        total_appointments = session.query(func.count(Appointment.id)).scalar() or 0
        total_attended = session.query(func.count(Appointment.id)).filter(Appointment.status.in_(["atendido", "finalizado"])).scalar() or 0

        paid_cash_cents = session.query(func.coalesce(func.sum(TreasuryEntry.amount_cents), 0)).filter(
            TreasuryEntry.status == "pago", TreasuryEntry.payment_method.in_(["pix", "cartao", "dinheiro"])
        ).scalar() or 0
        paid_plan_cents = session.query(func.coalesce(func.sum(TreasuryEntry.amount_cents), 0)).filter(
            TreasuryEntry.status.in_(["faturado", "pago"]), TreasuryEntry.payment_method == "convenio"
        ).scalar() or 0

        by_role = session.query(User.role, func.count(User.id)).group_by(User.role).all()
        low_stock = session.query(StockItem).filter(StockItem.quantity <= StockItem.min_quantity).all()

        return {
            "patients_total": total_patients,
            "appointments_total": total_appointments,
            "attended_total": total_attended,
            "financial": {
                "cash_received_cents": int(paid_cash_cents),
                "plan_received_cents": int(paid_plan_cents),
            },
            "team_by_role": [{"role": role, "count": count} for role, count in by_role],
            "low_stock": [
                {
                    "id": item.id,
                    "name": item.name,
                    "quantity": item.quantity,
                    "min_quantity": item.min_quantity,
                    "unit": item.unit,
                }
                for item in low_stock
            ],
        }
    finally:
        session.close()


@app.get("/stock-items")
def list_stock_items(authorization: str | None = Header(default=None)):
    current_user = require_auth(authorization)
    require_permission(current_user, "stock:view")

    session = SessionLocal()
    try:
        items = session.query(StockItem).order_by(StockItem.name.asc()).all()
        return [
            {
                "id": item.id,
                "name": item.name,
                "category": item.category,
                "unit": item.unit,
                "quantity": item.quantity,
                "min_quantity": item.min_quantity,
                "last_movement_type": item.last_movement_type,
                "last_movement_amount": item.last_movement_amount,
                "last_movement_note": item.last_movement_note,
                "updated_at": item.updated_at,
            }
            for item in items
        ]
    finally:
        session.close()


@app.post("/stock-items", status_code=201)
def create_stock_item(data: StockItemInput, authorization: str | None = Header(default=None)):
    current_user = require_auth(authorization)
    require_permission(current_user, "stock:edit")

    session = SessionLocal()
    try:
        item = StockItem(
            name=data.name,
            category=data.category,
            unit=data.unit,
            quantity=data.quantity,
            min_quantity=data.min_quantity,
            updated_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
        )
        session.add(item)
        session.commit()
        session.refresh(item)
        return {
            "id": item.id,
            "name": item.name,
            "category": item.category,
            "unit": item.unit,
            "quantity": item.quantity,
            "min_quantity": item.min_quantity,
            "updated_at": item.updated_at,
        }
    finally:
        session.close()


@app.post("/stock-items/{item_id}/movement")
def register_stock_movement(item_id: int, data: StockMovementInput, authorization: str | None = Header(default=None)):
    current_user = require_auth(authorization)
    require_permission(current_user, "stock:edit")

    movement_type = data.movement_type.lower().strip()
    if movement_type not in {"entrada", "saida"}:
        raise HTTPException(status_code=400, detail="Tipo de movimentação deve ser entrada ou saida")

    session = SessionLocal()
    try:
        item = session.query(StockItem).filter(StockItem.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Item não encontrado")

        if movement_type == "entrada":
            item.quantity += data.amount
        else:
            if item.quantity < data.amount:
                raise HTTPException(status_code=409, detail="Estoque insuficiente para a saída")
            item.quantity -= data.amount

        item.last_movement_type = movement_type
        item.last_movement_amount = data.amount
        item.last_movement_note = data.note
        item.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M")

        session.commit()
        session.refresh(item)
        return {
            "id": item.id,
            "name": item.name,
            "quantity": item.quantity,
            "min_quantity": item.min_quantity,
            "unit": item.unit,
            "updated_at": item.updated_at,
        }
    finally:
        session.close()