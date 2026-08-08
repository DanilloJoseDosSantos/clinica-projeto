from pathlib import Path


PROJECT_NAME = "clinica-sistema"
ROOT = Path(__file__).resolve().parent / PROJECT_NAME


DIRECTORIES = [
    "backend/app",
    "frontend/public",
    "frontend/src",
]

FILES = {
    "README.md": """# Sistema Integrado de Gestão para Clínica V2

Sistema completo para gestão de clínicas médicas, estruturado para controle de estoque (com gases medicinais como oxigênio e óxido nitroso), conformidade com a LGPD, controle de acessos (RBAC), prontuário eletrônico do paciente, faturamento (NFS-e e convênios TISS) e gestão financeira integrada com Dashboard em tempo real.

## Estrutura do Repositório
```text
clinica-sistema/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   └── auth.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js
└── docker-compose.yml
```
""",
    "backend/app/__init__.py": "",
    "backend/app/main.py": """from fastapi import FastAPI

app = FastAPI(title=\"Clínica API\")


@app.get(\"/health\")
def health_check():
    return {\"status\": \"ok\"}
""",
    "backend/app/database.py": """from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = \"sqlite:///./clinic.db\"

engine = create_engine(DATABASE_URL, connect_args={\"check_same_thread\": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
""",
    "backend/app/models.py": """from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class Patient(Base):
    __tablename__ = \"patients\"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    cpf = Column(String, unique=True, nullable=False)
""",
    "backend/app/schemas.py": """from pydantic import BaseModel


class PatientCreate(BaseModel):
    name: str
    cpf: str
""",
    "backend/app/auth.py": """def authenticate_user(username: str, password: str) -> bool:
    return username == \"admin\" and password == \"admin\"
""",
    "backend/requirements.txt": """fastapi\nuvicorn[standard]\nsqlalchemy\npydantic\n""",
    "backend/Dockerfile": """FROM python:3.12-slim\nWORKDIR /app\nCOPY . .\nRUN pip install --no-cache-dir -r requirements.txt\nCMD [\"uvicorn\", \"app.main:app\", \"--host\", \"0.0.0.0\", \"--port\", \"8000\"]\n""",
    "frontend/public/index.html": """<!doctype html>
<html lang=\"pt-BR\">
  <head>
    <meta charset=\"UTF-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
    <title>Clínica</title>
  </head>
  <body>
    <div id=\"root\"></div>
    <script type=\"module\" src=\"/src/main.jsx\"></script>
  </body>
</html>
""",
    "frontend/src/App.jsx": """export default function App() {
  return <h1>Sistema de Clínica</h1>;
}
""",
    "frontend/src/main.jsx": """import React from \"react\";
import ReactDOM from \"react-dom/client\";
import App from \"./App\";
import \"./index.css\";

ReactDOM.createRoot(document.getElementById(\"root\")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
""",
    "frontend/src/index.css": """body {
  font-family: Arial, sans-serif;
  margin: 0;
  padding: 2rem;
  background: #f6f8fb;
}
""",
    "frontend/package.json": """{
  \"name\": \"clinica-frontend\",
  \"private\": true,
  \"version\": \"1.0.0\",
  \"scripts\": {
    \"dev\": \"vite\",
    \"build\": \"vite build\"
  },
  \"dependencies\": {
    \"react\": \"^18.3.1\",
    \"react-dom\": \"^18.3.1\"
  },
  \"devDependencies\": {
    \"vite\": \"^5.4.10\",
    \"@vitejs/plugin-react\": \"^4.3.1\"
  }
}
""",
    "frontend/vite.config.js": """import { defineConfig } from \"vite\";
import react from \"@vitejs/plugin-react\";

export default defineConfig({
  plugins: [react()],
});
""",
    "docker-compose.yml": """version: \"3.9\"
services:
  backend:
    build: ./backend
    ports:
      - \"8000:8000\"
  frontend:
    image: node:20
    working_dir: /app
    volumes:
      - ./frontend:/app
    command: sh -c \"npm install && npm run dev -- --host 0.0.0.0\"
    ports:
      - \"5173:5173\"
""",
}


def create_project(root: Path) -> None:
    root.mkdir(parents=True, exist_ok=True)

    for directory in DIRECTORIES:
        (root / directory).mkdir(parents=True, exist_ok=True)

    for relative_path, content in FILES.items():
        file_path = root / relative_path
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(content, encoding="utf-8")

    print(f"Projeto criado com sucesso em: {root}")


if __name__ == "__main__":
    create_project(ROOT)
