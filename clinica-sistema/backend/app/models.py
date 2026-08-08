from sqlalchemy import Boolean, Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)
    active = Column(Boolean, default=True)

    appointments = relationship("Appointment", back_populates="professional")
    profile = relationship("EmployeeProfile", back_populates="user", uselist=False)


class EmployeeProfile(Base):
    __tablename__ = "employee_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    cpf = Column(String, nullable=False)
    address = Column(String, nullable=False)
    labor_registry = Column(String, nullable=False)
    professional_registration_type = Column(String, nullable=True)
    professional_registration_number = Column(String, nullable=True)
    contract_type = Column(String, nullable=False)
    admission_date = Column(String, nullable=False)
    emergency_contact_name = Column(String, nullable=False)
    emergency_contact_phone = Column(String, nullable=False)
    lgpd_consent = Column(Boolean, default=True)

    user = relationship("User", back_populates="profile")


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    cpf = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    birth_date = Column(String, nullable=True)
    address = Column(String, nullable=True)
    consent_lgpd = Column(Boolean, default=True)
    responsible_name = Column(String, nullable=True)
    status = Column(String, default="aguardando")

    appointments = relationship("Appointment", back_populates="patient")
    calls = relationship("Call", back_populates="patient")
    prescriptions = relationship("Prescription", back_populates="patient")
    guides = relationship("Guide", back_populates="patient")


class Call(Base):
    __tablename__ = "calls"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    room = Column(String, nullable=False)
    status = Column(String, default="em andamento")

    patient = relationship("Patient", back_populates="calls")


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    report_type = Column(String, nullable=False)
    created_at = Column(String, nullable=False)


class AuditDocument(Base):
    __tablename__ = "audit_documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    category = Column(String, nullable=False)
    status = Column(String, nullable=False)


class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    issued_by = Column(String, nullable=False)
    document_type = Column(String, default="receita")
    status = Column(String, default="emitida")

    patient = relationship("Patient", back_populates="prescriptions")


class Guide(Base):
    __tablename__ = "guides"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    document_type = Column(String, default="guia")
    status = Column(String, default="emitida")

    patient = relationship("Patient", back_populates="guides")
    print_logs = relationship("GuidePrintLog", back_populates="guide")


class GuidePrintLog(Base):
    __tablename__ = "guide_print_logs"

    id = Column(Integer, primary_key=True, index=True)
    guide_id = Column(Integer, ForeignKey("guides.id"), nullable=False)
    action = Column(String, nullable=False)
    printed_by = Column(String, nullable=False)
    printed_at = Column(String, nullable=False)

    guide = relationship("Guide", back_populates="print_logs")


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    professional_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    scheduled_at = Column(String, nullable=False)
    unit_name = Column(String, nullable=False, default="Unidade Centro")
    shift = Column(String, nullable=False, default="manha")
    specialty = Column(String, nullable=False)
    status = Column(String, default="agendado")
    notes = Column(String, nullable=True)

    patient = relationship("Patient", back_populates="appointments")
    professional = relationship("User", back_populates="appointments")
    queue_ticket = relationship("QueueTicket", back_populates="appointment", uselist=False)
    medical_record = relationship("MedicalRecord", back_populates="appointment", uselist=False)
    treasury_entry = relationship("TreasuryEntry", back_populates="appointment", uselist=False)


class QueueTicket(Base):
    __tablename__ = "queue_tickets"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False, unique=True)
    ticket_code = Column(String, nullable=False, unique=True)
    queue_status = Column(String, default="aguardando")
    priority = Column(String, default="normal")
    room = Column(String, nullable=True)
    called_at = Column(String, nullable=True)

    appointment = relationship("Appointment", back_populates="queue_ticket")


class MedicalRecord(Base):
    __tablename__ = "medical_records"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False, unique=True)
    chief_complaint = Column(String, nullable=False)
    anamnesis = Column(String, nullable=False)
    vital_signs = Column(String, nullable=True)
    allergies = Column(String, nullable=True)
    physical_exam = Column(String, nullable=True)
    current_medications = Column(String, nullable=True)
    icd10_code = Column(String, nullable=True)
    diagnosis = Column(String, nullable=False)
    care_plan = Column(String, nullable=False)
    prescriptions_summary = Column(String, nullable=True)
    status = Column(String, default="aberto")
    updated_by = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)

    appointment = relationship("Appointment", back_populates="medical_record")
    evolutions = relationship("MedicalRecordEvolution", back_populates="medical_record")
    attachments = relationship("MedicalRecordAttachment", back_populates="medical_record")


class MedicalRecordEvolution(Base):
    __tablename__ = "medical_record_evolutions"

    id = Column(Integer, primary_key=True, index=True)
    medical_record_id = Column(Integer, ForeignKey("medical_records.id"), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False)
    author_name = Column(String, nullable=False)
    recorded_at = Column(String, nullable=False)
    evolution_type = Column(String, nullable=False)
    note = Column(String, nullable=False)

    medical_record = relationship("MedicalRecord", back_populates="evolutions")


class MedicalRecordAttachment(Base):
    __tablename__ = "medical_record_attachments"

    id = Column(Integer, primary_key=True, index=True)
    medical_record_id = Column(Integer, ForeignKey("medical_records.id"), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False)
    title = Column(String, nullable=False)
    category = Column(String, nullable=False)
    reference_url = Column(String, nullable=False)
    uploaded_by = Column(String, nullable=False)
    created_at = Column(String, nullable=False)

    medical_record = relationship("MedicalRecord", back_populates="attachments")


class TreasuryEntry(Base):
    __tablename__ = "treasury_entries"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False, unique=True)
    description = Column(String, nullable=False)
    amount_cents = Column(Integer, nullable=False)
    payment_method = Column(String, nullable=False)
    status = Column(String, default="pendente")
    due_date = Column(String, nullable=True)
    paid_at = Column(String, nullable=True)

    appointment = relationship("Appointment", back_populates="treasury_entry")


class StockItem(Base):
    __tablename__ = "stock_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    unit = Column(String, nullable=False)
    quantity = Column(Integer, default=0)
    min_quantity = Column(Integer, default=0)
    last_movement_type = Column(String, nullable=True)
    last_movement_amount = Column(Integer, nullable=True)
    last_movement_note = Column(String, nullable=True)
    updated_at = Column(String, nullable=True)
