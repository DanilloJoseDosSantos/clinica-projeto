from sqlalchemy.exc import OperationalError

from app.database import Base, SessionLocal, engine
from app.models import Appointment, AuditDocument, Call, Guide, MedicalRecord, MedicalRecordAttachment, MedicalRecordEvolution, Patient, Prescription, QueueTicket, Report, StockItem, TreasuryEntry, User
from app.core.security import hash_password


def seed_data() -> None:
    session = SessionLocal()
    try:
        default_users = [
            {"username": "admin", "password": "admin", "role": "admin", "name": "Administrador"},
            {"username": "recepcao", "password": "recepcao", "role": "reception", "name": "Recepção"},
            {"username": "enfermeiro", "password": "enfermeiro", "role": "nurse", "name": "Enfermagem"},
            {"username": "medico", "password": "medico", "role": "doctor", "name": "Dr. Marcelo"},
            {"username": "tesouraria", "password": "tesouraria", "role": "treasury", "name": "Tesouraria"},
        ]
        for item in default_users:
            existing_user = session.query(User).filter(User.username == item["username"]).first()
            if not existing_user:
                session.add(User(username=item["username"], password_hash=hash_password(item["password"]), role=item["role"], name=item["name"]))
        if session.query(Patient).count() == 0:
            session.add_all([
                Patient(name="Ana Souza", cpf="111.222.333-44", phone="11999990000", birth_date="1985-03-20", address="Rua A, 100", consent_lgpd=True, responsible_name="João Souza", status="aguardando"),
                Patient(name="Carlos Lima", cpf="555.666.777-88", phone="11988887777", birth_date="1978-09-10", address="Rua B, 200", consent_lgpd=True, responsible_name="Maria Lima", status="chamado"),
            ])
        session.flush()
        ana = session.query(Patient).filter(Patient.name == "Ana Souza").first()
        carlos = session.query(Patient).filter(Patient.name == "Carlos Lima").first()
        if session.query(Call).count() == 0:
            if carlos:
                session.add(Call(patient_id=carlos.id, room="Sala 2", status="em andamento"))
        if session.query(Report).count() == 0:
            session.add(Report(title="Relatório diário", report_type="daily", created_at="2026-08-06"))
        if session.query(AuditDocument).count() == 0:
            session.add(AuditDocument(title="Termo de consentimento", category="LGPD", status="em ordem"))
        if session.query(Prescription).count() == 0:
            if ana:
                session.add(Prescription(patient_id=ana.id, issued_by="Dr. João", document_type="receita", status="emitida"))
        if session.query(Guide).count() == 0:
            if carlos:
                session.add(Guide(patient_id=carlos.id, document_type="guia", status="emitida"))
        if session.query(Appointment).count() == 0:
            doctor = session.query(User).filter(User.role == "doctor").first()
            if doctor and ana and carlos:
                session.add_all([
                    Appointment(patient_id=ana.id, professional_id=doctor.id, scheduled_at="2026-08-08 09:00", unit_name="Unidade Centro", shift="manha", specialty="Clínico geral", status="confirmado", notes="Retorno"),
                    Appointment(patient_id=carlos.id, professional_id=doctor.id, scheduled_at="2026-08-08 10:30", unit_name="Unidade Norte", shift="manha", specialty="Ortopedia", status="agendado", notes="Primeira consulta")
                ])
        session.flush()
        if session.query(QueueTicket).count() == 0:
            confirmed_appointment = session.query(Appointment).filter(Appointment.patient_id == ana.id if ana else None).first()
            if confirmed_appointment:
                session.add(QueueTicket(appointment_id=confirmed_appointment.id, ticket_code="S001", queue_status="aguardando", priority="normal"))
        if session.query(MedicalRecord).count() == 0:
            confirmed_appointment = session.query(Appointment).filter(Appointment.patient_id == ana.id if ana else None).first()
            if confirmed_appointment:
                session.add(MedicalRecord(
                    appointment_id=confirmed_appointment.id,
                    chief_complaint="Retorno clínico",
                    anamnesis="Paciente refere melhora parcial dos sintomas.",
                    vital_signs="PA 12x8, FC 76 bpm",
                    allergies="Nega alergias medicamentosas",
                    physical_exam="Bom estado geral, sem alterações agudas.",
                    current_medications="Losartana 50mg/dia",
                    icd10_code="Z09",
                    diagnosis="Acompanhamento ambulatorial",
                    care_plan="Manter medicação e retornar em 30 dias",
                    prescriptions_summary="Receita de manutenção emitida",
                    status="finalizado",
                    updated_by="Dr. Marcelo",
                    updated_at="2026-08-08 09:40"
                ))
        session.flush()
        if session.query(MedicalRecordEvolution).count() == 0:
            record = session.query(MedicalRecord).first()
            if record:
                session.add_all([
                    MedicalRecordEvolution(
                        medical_record_id=record.id,
                        appointment_id=record.appointment_id,
                        author_name="Dr. Marcelo",
                        recorded_at="2026-08-08 09:20",
                        evolution_type="triagem",
                        note="Paciente chegou orientada, sem dor aguda e com sinais vitais estáveis."
                    ),
                    MedicalRecordEvolution(
                        medical_record_id=record.id,
                        appointment_id=record.appointment_id,
                        author_name="Dr. Marcelo",
                        recorded_at="2026-08-08 09:40",
                        evolution_type="evolucao",
                        note="Consulta de retorno finalizada com manutenção terapêutica e seguimento ambulatorial."
                    )
                ])
        if session.query(MedicalRecordAttachment).count() == 0:
            record = session.query(MedicalRecord).first()
            if record:
                session.add(MedicalRecordAttachment(
                    medical_record_id=record.id,
                    appointment_id=record.appointment_id,
                    title="Exame laboratorial de controle",
                    category="laboratorio",
                    reference_url="https://intranet.clinica.local/anexos/exame-controle-ana",
                    uploaded_by="Recepção",
                    created_at="2026-08-08 08:55"
                ))
        if session.query(TreasuryEntry).count() == 0:
            confirmed_appointment = session.query(Appointment).filter(Appointment.patient_id == ana.id if ana else None).first()
            if confirmed_appointment:
                session.add(TreasuryEntry(
                    appointment_id=confirmed_appointment.id,
                    description="Consulta retorno clínico geral",
                    amount_cents=18000,
                    payment_method="cartao",
                    status="pago",
                    due_date="2026-08-08",
                    paid_at="2026-08-08 09:45"
                ))
        if session.query(StockItem).count() == 0:
            session.add_all([
                StockItem(name="Seringa 5ml", category="descartavel", unit="un", quantity=250, min_quantity=80, updated_at="2026-08-08 08:00"),
                StockItem(name="Esparadrapo", category="curativo", unit="rolo", quantity=45, min_quantity=20, updated_at="2026-08-08 08:00"),
                StockItem(name="Gaze estéril", category="curativo", unit="pct", quantity=120, min_quantity=40, updated_at="2026-08-08 08:00"),
                StockItem(name="Soro fisiológico 500ml", category="medicamento", unit="bolsa", quantity=70, min_quantity=25, updated_at="2026-08-08 08:00"),
            ])
        session.commit()
    finally:
        session.close()


def init_db() -> None:
    Base.metadata.create_all(bind=engine)

    try:
        seed_data()
    except OperationalError:
        if engine.url.get_backend_name() != "sqlite":
            raise

        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        seed_data()
