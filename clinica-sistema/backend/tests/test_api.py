import sys
from datetime import datetime
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app


client = TestClient(app)


def test_login_and_patient_creation_flow():
    login_response = client.post(
        "/login",
        json={"username": "admin", "password": "admin"},
    )
    assert login_response.status_code == 200

    token = login_response.json()["token"]

    patients_response = client.get(
        "/patients",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert patients_response.status_code == 200

    create_response = client.post(
        "/patients",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Maria Silva",
            "cpf": "12345678900",
            "phone": "11999990000",
            "birth_date": "1990-01-01",
            "address": "Rua das Flores, 100",
            "consent_lgpd": True,
            "responsible_name": "João Silva",
        },
    )
    assert create_response.status_code == 201
    assert create_response.json()["name"] == "Maria Silva"


def test_admin_can_list_users_and_create_appointment():
    login_response = client.post(
        "/login",
        json={"username": "admin", "password": "admin"},
    )
    assert login_response.status_code == 200

    token = login_response.json()["token"]

    users_response = client.get(
        "/users",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert users_response.status_code == 200
    users = users_response.json()
    doctor = next(user for user in users if user["role"] == "doctor")

    patient_response = client.post(
        "/patients",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Marcos Pereira",
            "cpf": "12345678911",
            "phone": "11999998888",
            "birth_date": "1988-04-10",
            "address": "Rua das Palmeiras, 45",
            "consent_lgpd": True,
            "responsible_name": "Livia Pereira",
        },
    )
    assert patient_response.status_code == 201

    appointment_response = client.post(
        "/appointments",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "patient_id": patient_response.json()["id"],
            "professional_id": doctor["id"],
            "scheduled_at": "2026-08-08 14:00",
            "unit_name": "Unidade Centro",
            "shift": "tarde",
            "specialty": "Cardiologia",
            "notes": "Check-up anual",
        },
    )
    assert appointment_response.status_code == 201
    assert appointment_response.json()["specialty"] == "Cardiologia"


def test_patient_operational_flow_from_checkin_to_treasury():
    login_response = client.post(
        "/login",
        json={"username": "admin", "password": "admin"},
    )
    assert login_response.status_code == 200

    token = login_response.json()["token"]
    users_response = client.get(
        "/users",
        headers={"Authorization": f"Bearer {token}"},
    )
    doctor = next(user for user in users_response.json() if user["role"] == "doctor")

    patient_response = client.post(
        "/patients",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Paula Almeida",
            "cpf": "98765432100",
            "phone": "11988887776",
            "birth_date": "1992-06-15",
            "address": "Av. Central, 120",
            "consent_lgpd": True,
            "responsible_name": "Carlos Almeida",
        },
    )
    assert patient_response.status_code == 201

    appointment_response = client.post(
        "/appointments",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "patient_id": patient_response.json()["id"],
            "professional_id": doctor["id"],
            "scheduled_at": "2026-08-08 15:30",
            "unit_name": "Unidade Sul",
            "shift": "tarde",
            "specialty": "Dermatologia",
            "notes": "Consulta particular",
        },
    )
    assert appointment_response.status_code == 201
    appointment_id = appointment_response.json()["id"]

    checkin_response = client.post(
        f"/appointments/{appointment_id}/check-in",
        headers={"Authorization": f"Bearer {token}"},
        json={"priority": "normal"},
    )
    assert checkin_response.status_code == 200
    assert checkin_response.json()["ticket"]["code"] is not None

    public_waiting_response = client.get("/public/calls")
    assert public_waiting_response.status_code == 200
    assert any(item["patient_name"] == "Paula Almeida" and item["status"] == "aguardando" for item in public_waiting_response.json())

    call_response = client.post(
        f"/appointments/{appointment_id}/triage/call",
        headers={"Authorization": f"Bearer {token}"},
        json={"room": "Triagem 1"},
    )
    assert call_response.status_code == 200
    assert call_response.json()["ticket"]["room"] == "Triagem 1"

    triage_response = client.post(
        f"/appointments/{appointment_id}/triage",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "chief_complaint": "Lesão cutânea",
            "blood_pressure": "11x7",
            "heart_rate": "76",
            "temperature_c": "36.6",
            "oxygen_saturation": "98%",
            "respiratory_rate": "16",
            "weight_kg": "67",
            "allergies": "Nega",
            "current_medications": "Uso eventual de anti-histamínico",
            "triage_note": "Triagem concluída sem sinais de gravidade.",
        },
    )
    assert triage_response.status_code == 200
    assert triage_response.json()["status"] == "aguardando medico"

    call_response = client.post(
        f"/appointments/{appointment_id}/call",
        headers={"Authorization": f"Bearer {token}"},
        json={"room": "Consultório 3"},
    )
    assert call_response.status_code == 200
    assert call_response.json()["ticket"]["room"] == "Consultório 3"

    record_response = client.post(
        f"/appointments/{appointment_id}/medical-record",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "chief_complaint": "Lesão cutânea",
            "anamnesis": "Paciente relata surgimento há 2 semanas.",
            "vital_signs": "PA 11x7",
            "allergies": "Nega",
            "physical_exam": "Lesão eritematosa em membro superior direito.",
            "current_medications": "Uso eventual de anti-histamínico",
            "icd10_code": "L30",
            "diagnosis": "Dermatite",
            "care_plan": "Prescrever pomada e retorno em 10 dias",
            "prescriptions_summary": "Pomada tópica",
            "evolution_type": "evolucao",
            "evolution_note": "Paciente orientada quanto ao tratamento tópico e sinais de alarme.",
            "status": "finalizado",
        },
    )
    assert record_response.status_code == 200
    assert record_response.json()["medical_record"]["diagnosis"] == "Dermatite"
    assert record_response.json()["medical_record"]["icd10_code"] == "L30"
    assert len(record_response.json()["medical_record"]["evolutions"]) >= 1

    attachment_response = client.post(
        f"/appointments/{appointment_id}/attachments",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "Foto clínica inicial",
            "category": "imagem",
            "reference_url": "https://intranet.clinica.local/fotos/paula-almeida",
        },
    )
    assert attachment_response.status_code == 200
    assert attachment_response.json()["medical_record"]["attachments"][0]["title"] == "Foto clínica inicial"
    assert len(attachment_response.json()["medical_record"]["timeline"]) >= 1

    treasury_response = client.post(
        f"/appointments/{appointment_id}/treasury",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "description": "Consulta dermatológica",
            "amount_cents": 25000,
            "payment_method": "pix",
            "status": "pago",
            "due_date": "2026-08-08",
            "paid_at": "2026-08-08 15:50",
        },
    )
    assert treasury_response.status_code == 200
    assert treasury_response.json()["treasury"]["status"] == "pago"

    public_calls_response = client.get("/public/calls")
    assert public_calls_response.status_code == 200
    assert any(item["room"] == "Consultório 3" for item in public_calls_response.json())
    assert any(item["destination_type"] == "Consultório" for item in public_calls_response.json())


def test_reception_can_issue_health_plan_guide_payload():
    reception_login = client.post("/login", json={"username": "recepcao", "password": "recepcao"})
    assert reception_login.status_code == 200
    reception_token = reception_login.json()["token"]

    patients_response = client.get("/patients", headers={"Authorization": f"Bearer {reception_token}"})
    assert patients_response.status_code == 200
    patient_id = patients_response.json()[0]["id"]

    guide_response = client.post(
        "/guides",
        headers={"Authorization": f"Bearer {reception_token}"},
        json={
            "patient_id": patient_id,
            "plan_name": "Plano Saúde Premium",
            "guide_code": "G-2026-001",
            "signed_at_reception": True,
        },
    )
    assert guide_response.status_code == 201
    assert "Plano Saúde Premium" in guide_response.json()["type"]
    assert guide_response.json()["status"] == "assinada"

    print_response = client.get(
        f"/guides/{guide_response.json()['id']}/print-data",
        headers={"Authorization": f"Bearer {reception_token}"},
    )
    assert print_response.status_code == 200
    assert print_response.json()["plan"]["name"] == "Plano Saúde Premium"
    assert print_response.json()["plan"]["guide_code"] == "G-2026-001"
    assert print_response.json()["official_number"].startswith("GC-")

    pdf_response = client.get(
        f"/guides/{guide_response.json()['id']}/pdf",
        headers={"Authorization": f"Bearer {reception_token}"},
    )
    assert pdf_response.status_code == 200
    assert pdf_response.headers["content-type"].startswith("application/pdf")

    history_response = client.get(
        f"/guides/{guide_response.json()['id']}/print-history",
        headers={"Authorization": f"Bearer {reception_token}"},
    )
    assert history_response.status_code == 200
    history_items = history_response.json()
    assert len(history_items) >= 2
    assert any(item["action"] == "visualizacao" for item in history_items)
    assert any(item["action"] == "download_pdf" for item in history_items)

    today = datetime.now().strftime("%Y-%m-%d")
    admin_login = client.post("/login", json={"username": "admin", "password": "admin"})
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["token"]

    global_history_response = client.get(
        f"/guides/print-history/global?start_date={today}&end_date={today}&printed_by=Recepção&action=download_pdf",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert global_history_response.status_code == 200
    global_payload = global_history_response.json()
    assert "items" in global_payload
    assert global_payload["page"] == 1
    global_items = global_payload["items"]
    assert any(item["guide_id"] == guide_response.json()["id"] for item in global_items)

    csv_response = client.get(
        f"/guides/print-history/global/csv?start_date={today}&end_date={today}&action=download_pdf",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert csv_response.status_code == 200
    assert csv_response.headers["content-type"].startswith("text/csv")
    assert "guide_official_number" in csv_response.text


def test_role_permissions_are_enforced_by_sector():
    reception_login = client.post("/login", json={"username": "recepcao", "password": "recepcao"})
    assert reception_login.status_code == 200
    reception_token = reception_login.json()["token"]

    me_response = client.get("/me", headers={"Authorization": f"Bearer {reception_token}"})
    assert me_response.status_code == 200
    assert "patients:create" in me_response.json()["permissions"]
    assert "treasury:edit" not in me_response.json()["permissions"]

    treasury_forbidden = client.get("/treasury", headers={"Authorization": f"Bearer {reception_token}"})
    assert treasury_forbidden.status_code == 403

    doctor_login = client.post("/login", json={"username": "medico", "password": "medico"})
    assert doctor_login.status_code == 200
    doctor_token = doctor_login.json()["token"]

    doctor_reports = client.get("/reports", headers={"Authorization": f"Bearer {doctor_token}"})
    assert doctor_reports.status_code == 403

    treasury_login = client.post("/login", json={"username": "tesouraria", "password": "tesouraria"})
    assert treasury_login.status_code == 200
    treasury_token = treasury_login.json()["token"]

    treasury_view = client.get("/treasury", headers={"Authorization": f"Bearer {treasury_token}"})
    assert treasury_view.status_code == 200

    treasury_record_forbidden = client.get("/medical-records", headers={"Authorization": f"Bearer {treasury_token}"})
    assert treasury_record_forbidden.status_code == 403
