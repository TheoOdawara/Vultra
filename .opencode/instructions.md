# VULTRA — Instruções para Agentes de IA

Diretrizes comportamentais e regras técnicas obrigatórias para o projeto VULTRA.
Combina boas práticas gerais de codificação com restrições específicas do projeto.

---

## 1. Pense Antes de Codar

**Não assuma. Não esconda confusão. Explicite trade-offs.**

Antes de implementar:
- Exponha suas premissas explicitamente. Se incerto, pergunte.
- Se existirem múltiplas interpretações, apresente-as — não escolha silenciosamente.
- Se uma abordagem mais simples existir, diga. Questione quando for necessário.
- Se algo não estiver claro, pare. Nomeie o que confunde. Pergunte.

## 2. Simplicidade Primeiro

**Mínimo de código que resolve o problema. Nada especulativo.**

- Nenhum feature além do solicitado.
- Nenhuma abstração para código de uso único.
- Nenhuma "flexibilidade" ou "configurabilidade" não solicitada.
- Nenhum tratamento de erros para cenários impossíveis.
- Se você escreveu 200 linhas e poderia ser 50, reescreva.

## 3. Mudanças Cirúrgicas

**Toque apenas o que for necessário. Limpe apenas a sua bagunça.**

- Não "melhore" código, comentários ou formatação adjacentes.
- Não refatore coisas que não estão quebradas.
- Combine o estilo existente, mesmo que você faria diferente.
- Se notar código morto não relacionado, mencione — não delete.

## 4. Execução Orientada a Objetivos

**Defina critérios de sucesso. Repita até verificar.**

Transforme tarefas em objetivos verificáveis antes de implementar.
Para tarefas multi-passo, declare um plano breve e critérios de verificação.

---

## 5. Regras Técnicas Obrigatórias do VULTRA

As regras abaixo são **não-negociáveis** e se sobrepõem a qualquer padrão geral.

### Validação de Schema

- **TypeBox é obrigatório** para schemas de rotas no API Core (Elysia + TypeBox).
- **Zod, Joi e Yup são proibidos** em todo o projeto (backend e frontends).
- Validação de formulários nos frontends deve usar HTML5 nativo, React Hook Form sem Zod, ou types do `@vultra/types`.

### Multi-tenancy e Segurança de Dados

- **RLS (Row Level Security) e tenant context são obrigatórios** em todas as queries do banco.
- Todo repositório deve usar `withTenantContext` antes de qualquer query.
- Filtros de `organizationId` em nível de aplicação são defense-in-depth — não substituem RLS.
- Query keys do TanStack Query devem incluir `activeOrganizationId` para evitar cache cross-tenant.

### LGPD e Biometria

- **Nenhuma imagem biométrica pode ser persistida** — frames JPEG são processados inteiramente em RAM pelo AI Service e descartados imediatamente.
- Dados biométricos brutos (embeddings) nunca devem aparecer em logs, respostas de API ou armazenamento.
- Operações que afetam dados pessoais sensíveis devem gerar **audit log** (`audit_logs` table).

### Audit Logs

- Operações sensíveis obrigatoriamente geram entradas em `audit_logs`:
  - Desativação de membro
  - Revogação de perfil biométrico
  - Rotação de chave de dispositivo
  - Qualquer operação de deleção ou inativação

### RBAC e Autenticação

- **Better Auth + organização plugin** é o sistema de autenticação canônico.
- RBAC é aplicado via `checkPermission(role, { resource: [actions] })`.
- Rotas nunca devem fazer bypass de RBAC ou RLS.
- Middlewares dos frontends devem validar sessão **e** role do portal.

### Migrations e Banco de Dados

- **Migrations SQL são manuais** — jamais use `drizzle-kit push` em produção.
- Migrations ficam em `apps/api-core/src/infrastructure/database/migrations/`.
- Nunca altere diretamente a schema sem criar uma migration correspondente.

### Endpoints e Contratos de API

- Rotas canônicas (conforme `docs/backend/manuais/api-endpoints.md`):
  - ESP32: `POST /v1/attendance/record` (com `X-Device-Token`)
  - Fechar sessão: `PATCH /v1/attendance/sessions/:id/close`
  - Presença manual: `POST /v1/attendance/sessions/:id/records/manual`
  - Listar faces: `GET /v1/face/list`
- A superfície `/v1/biometric/*` está descontinuada (retorna 404).
- Nunca crie contratos de API que divergem do `@vultra/types`.

### ADRs

- **ADRs aceitos não devem ser editados diretamente.**
- Se uma decisão precisar ser revisada, crie um novo ADR ou adicione uma errata versionada.

### Line Endings

- Todos os arquivos devem usar **LF** (Unix). Não commite arquivos com CRLF.
- `git diff --check origin/main...HEAD` deve passar sem erros.
