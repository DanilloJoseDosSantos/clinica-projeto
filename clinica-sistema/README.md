# Sistema Integrado de Gestão para Clínica V2

Sistema de gestão para clínicas médicas com foco em operar como uma alternativa mais simples e mais barata que suites hospitalares grandes. A base atual cobre autenticação, pacientes, chamados, documentos e uma agenda inicial de consultas.

## Arquitetura Alvo

O caminho recomendado é um monólito modular em FastAPI + React, com PostgreSQL e separação por domínios de negócio:

1. Recepção e agenda: cadastro, agenda médica, confirmação, check-in, fila e painel TV.
2. Atendimento clínico: prontuário, evolução, prescrições, guias, anexos e documentos.
3. Financeiro e faturamento: convênios, procedimentos, caixa, contas a receber e repasses.
4. Governança: usuários, perfis, auditoria e LGPD.

## Opções de Implementação

1. Evolução incremental do projeto atual
Mantém a stack e entrega MVP operacional rápido para clínica única.

2. Monólito modular
Organiza por domínios, reduz acoplamento e é a melhor relação custo/manutenção.

3. SaaS multi-clínica
Adiciona multi-tenant, configuração por unidade e cobrança recorrente para produto comercial.

## Plano por Fases

1. Base técnica
Usuários persistidos, JWT real, RBAC, PostgreSQL, migrations, testes e observabilidade.

2. Operação clínica
Agenda, recepção, fila, TV, prontuário e documentos por atendimento.

3. Backoffice
Faturamento, convênios, caixa, financeiro e relatórios gerenciais.

4. Produto escalável
Automação de comunicação, multiunidade, integrações e analytics.

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

## Incremento já iniciado nesta base

1. Usuários agora são persistidos no banco com perfil e status ativo.
2. O login usa JWT assinado.
3. A agenda clínica ganhou endpoints próprios para listar e criar consultas.
4. O backend aceita DATABASE_URL para uso com PostgreSQL, mantendo fallback local.
5. O docker-compose já sobe PostgreSQL para ambiente mais próximo de produção.
