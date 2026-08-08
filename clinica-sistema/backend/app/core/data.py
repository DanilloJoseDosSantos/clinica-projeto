from typing import List, Dict


users = [
    {"id": 1, "username": "admin", "password": "admin", "role": "admin", "name": "Administrador"},
    {"id": 2, "username": "recepcao", "password": "recepcao", "role": "reception", "name": "Recepção"},
    {"id": 3, "username": "enfermeiro", "password": "enfermeiro", "role": "nurse", "name": "Enfermagem"},
]


patients: List[Dict[str, object]] = [
    {"id": 1, "name": "Ana Souza", "cpf": "111.222.333-44", "phone": "11999990000", "birth_date": "1985-03-20", "address": "Rua A, 100", "consent_lgpd": True, "responsible_name": "João Souza", "status": "aguardando"},
    {"id": 2, "name": "Carlos Lima", "cpf": "555.666.777-88", "phone": "11988887777", "birth_date": "1978-09-10", "address": "Rua B, 200", "consent_lgpd": True, "responsible_name": "Maria Lima", "status": "chamado"},
]


calls = [
    {"id": 1, "patient_name": "Carlos Lima", "room": "Sala 2", "status": "em andamento"},
]
