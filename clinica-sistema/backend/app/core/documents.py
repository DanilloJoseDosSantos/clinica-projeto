from typing import List, Dict


reports: List[Dict[str, object]] = [
    {"id": 1, "title": "Relatório diário", "type": "daily", "created_at": "2026-08-06"},
]

audit_documents: List[Dict[str, object]] = [
    {"id": 1, "title": "Termo de consentimento", "category": "LGPD", "status": "em ordem"},
]

prescriptions: List[Dict[str, object]] = [
    {"id": 1, "patient_name": "Ana Souza", "issued_by": "Dr. João", "type": "receita", "status": "emitida"},
]

guides: List[Dict[str, object]] = [
    {"id": 1, "patient_name": "Carlos Lima", "type": "guia", "status": "emitida"},
]
