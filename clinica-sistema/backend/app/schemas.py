from pydantic import BaseModel, Field


class LoginInput(BaseModel):
    username: str
    password: str


class PatientInput(BaseModel):
    name: str = Field(min_length=2)
    cpf: str = Field(min_length=11, max_length=14)
    phone: str = Field(min_length=8)
    birth_date: str
    address: str
    consent_lgpd: bool
    responsible_name: str


class UserCreateInput(BaseModel):
    username: str = Field(min_length=3)
    password: str = Field(min_length=4)
    name: str = Field(min_length=2)
    role: str = Field(min_length=3)
    cpf: str = Field(min_length=11, max_length=14)
    address: str = Field(min_length=5)
    labor_registry: str = Field(min_length=3)
    crm: str = ""
    cre: str = ""
    contract_type: str = Field(min_length=2)
    admission_date: str = Field(min_length=8)
    emergency_contact_name: str = Field(min_length=2)
    emergency_contact_phone: str = Field(min_length=8)
    lgpd_consent: bool = True
    active: bool = True


class AppointmentInput(BaseModel):
    patient_id: int
    professional_id: int
    scheduled_at: str = Field(min_length=10)
    unit_name: str = Field(min_length=2)
    shift: str = Field(min_length=2)
    specialty: str = Field(min_length=2)
    notes: str = ""


class CheckInInput(BaseModel):
    priority: str = "normal"


class CallAppointmentInput(BaseModel):
    room: str = Field(min_length=2)


class TriageInput(BaseModel):
    chief_complaint: str = Field(min_length=2)
    blood_pressure: str = Field(min_length=3)
    heart_rate: str = Field(min_length=2)
    temperature_c: str = Field(min_length=2)
    oxygen_saturation: str = ""
    respiratory_rate: str = ""
    weight_kg: str = ""
    allergies: str = ""
    current_medications: str = ""
    triage_note: str = Field(min_length=2)


class MedicalRecordInput(BaseModel):
    chief_complaint: str = Field(min_length=2)
    anamnesis: str = Field(min_length=2)
    vital_signs: str = ""
    allergies: str = ""
    physical_exam: str = ""
    current_medications: str = ""
    icd10_code: str = ""
    diagnosis: str = Field(min_length=2)
    care_plan: str = Field(min_length=2)
    prescriptions_summary: str = ""
    evolution_type: str = "evolucao"
    evolution_note: str = Field(min_length=2)
    status: str = "em atendimento"


class MedicalRecordAttachmentInput(BaseModel):
    title: str = Field(min_length=2)
    category: str = Field(min_length=2)
    reference_url: str = Field(min_length=4)


class TreasuryEntryInput(BaseModel):
    description: str = Field(min_length=2)
    amount_cents: int = Field(gt=0)
    payment_method: str = Field(min_length=2)
    status: str = "pendente"
    due_date: str = ""
    paid_at: str = ""


class GuideIssueInput(BaseModel):
    patient_id: int
    plan_name: str = ""
    guide_code: str = ""
    signed_at_reception: bool = False


class StockItemInput(BaseModel):
    name: str = Field(min_length=2)
    category: str = Field(min_length=2)
    unit: str = Field(min_length=1)
    quantity: int = Field(ge=0)
    min_quantity: int = Field(ge=0)


class StockMovementInput(BaseModel):
    movement_type: str = Field(min_length=2)
    amount: int = Field(gt=0)
    note: str = ""
