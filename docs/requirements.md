# Requisitos — Vultra

> Documento vivo. Fonte única de verdade do produto: o que o Vultra faz, para quem, e o que
> deliberadamente não faz. Detalhe de campo, mensagem literal e limite numérico pertencem à `/spec` da
> funcionalidade, nunca a este arquivo.

**Status:** kickoff · **Entrega dura:** dezembro de 2026 (sistema demonstrável + artigo submetido a revista)

---

## 1. Problema

Chamada manual em sala consome tempo de aula, é falsificável e não gera dado aproveitável. Instituições de
ensino registram presença em papel ou planilha, e o que sobra disso não responde nenhuma pergunta útil
sobre a experiência do aluno.

O Vultra substitui a chamada manual por reconhecimento facial em câmeras de baixo custo instaladas em sala,
e aproveita o mesmo instante de captura para inferir a expressão facial do aluno. O registro de presença é
o produto direto; a leitura afetiva agregada é a contribuição de pesquisa — permite perguntar se turmas,
horários ou professores específicos concentram estados emocionais distintos.

**Contexto:** projeto de Iniciação Científica. O entregável de dezembro de 2026 é um sistema demonstrável
somado a um artigo submetido a revista. Isso é uma restrição de escopo, não um detalhe: capacidade que não
sustenta a demonstração nem o artigo é posterior a dezembro.

---

## 2. Usuários e stakeholders

| Papel | Quem é | O que faz no sistema |
|---|---|---|
| **Gestor da instituição** | Secretaria ou coordenação da escola | Cadastra alunos e turmas, registra câmeras, acompanha frequência |
| **Professor** | Docente da turma | Abre e encerra a chamada, corrige presença manualmente, consulta a própria turma |
| **Aluno** | Titular do dado biométrico e afetivo | Não opera o sistema. É reconhecido pela câmera |
| **Equipe de RH** | Outra equipe, outro sistema | Consome o dado agregado de bem-estar. Não é usuária da nossa interface |
| **Time de desenvolvimento** | Theo e Vitor | Únicos com acesso ao repositório |
| **Orientador** | Supervisão acadêmica, fora do repositório | Recebe relatórios; valida a direção da pesquisa |

O aluno é o titular dos dados mais sensíveis do sistema e não tem interface nenhuma. Toda decisão sobre
exibição, retenção e agregação precisa considerar que ele não pode ver, contestar ou corrigir o que o
sistema afirma sobre ele.

---

## 3. Escopo

### Em escopo

- Reconhecimento facial 1:N para registro de presença em sala, a partir de câmera ESP32-CAM.
- Cadastro biométrico (enrollment) de aluno a partir de captura, com verificação de qualidade do quadro.
- Abertura, operação e encerramento de sessão de chamada pelo professor.
- Correção manual de presença pelo professor, distinguível do registro automático.
- Inferência de expressão facial no mesmo quadro do reconhecimento.
- Agregação do dado afetivo por turma, horário e professor.
- Entrega do dado agregado para o sistema de RH de terceiros.
- Multitenancy: uma instituição não alcança dado de outra, em nenhuma circunstância.
- Portal institucional único (gestor e professor), com o que cada papel pode ver decidido no servidor.

### Fora de escopo

- **Armazenamento de imagem facial.** O sistema nunca persiste o quadro capturado — nem em banco, nem em
  disco, nem em log. Só o vetor derivado.
- **Ser sistema de RH.** A análise de pessoal, o dossiê do colaborador e a interface de RH pertencem ao
  sistema da outra equipe. Entregamos dado, não tela de gestão de pessoas.
- **Cadastro de aluno como fonte primária.** Os dados cadastrais são da instituição; o Vultra consulta e
  espelha apenas o mínimo necessário para operar.
- **Aplicativo para o aluno.** Não há interface de aluno nesta entrega.
- **Controle de ponto trabalhista.** Presença de colaborador com efeito de jornada exige garantias legais
  que este projeto não implementa.
- **Portal administrativo separado.** Fundido no portal institucional — ver Evolution log, 2026-08-14.
- **Painel de saúde de serviço na interface de produto.** Vira observabilidade de servidor.

---

## 4. Requisitos funcionais

### 4.1 Identidade e acesso

- **RF-01** — Cada instituição é um tenant isolado. Nenhuma leitura ou escrita atravessa a fronteira do
  tenant, em nenhuma rota, sob nenhum papel.
- **RF-02** — Papéis: gestor da instituição, professor, aluno. O que cada papel pode fazer é decidido no
  servidor; a interface apenas reflete a decisão, nunca a substitui.
- **RF-03** — O professor alcança apenas as próprias turmas e sessões. Escopo por professor é regra de
  servidor, não filtro de tela.
- **RF-04** — Câmeras autenticam por credencial própria, revogável e rotacionável, distinta de credencial
  de usuário.

### 4.2 Cadastro biométrico

- **RF-05** — O gestor cadastra o rosto de um aluno a partir de uma captura, vinculando-o ao registro que
  já existe na instituição.
- **RF-06** — Um quadro abaixo do limiar de qualidade é recusado com o motivo, sem gerar cadastro.
- **RF-07** — Um cadastro biométrico pode ser revogado. Depois disso, o aluno deixa de ser reconhecido.
- **RF-08** — Toda operação sobre dado biométrico deixa registro de auditoria imutável — inclusive as que
  falham e as automáticas.

### 4.3 Chamada

- **RF-09** — O professor abre uma sessão de chamada associada a uma turma e a uma câmera.
- **RF-10** — Enquanto a sessão está aberta, cada rosto reconhecido registra presença uma única vez.
- **RF-11** — O professor vê a chamada preencher-se durante a aula.
- **RF-12** — O professor registra ou corrige presença manualmente. O registro manual é distinguível do
  automático em todo relatório e auditoria.
- **RF-13** — Uma sessão aberta é recuperável: recarregar a página ou trocar de dispositivo não a perde.
- **RF-14** — Um rosto não reconhecido, ou reconhecido com confiança insuficiente, não gera presença — e o
  desfecho fica registrado.

### 4.4 Análise afetiva

> Nenhum requisito desta seção está implementado hoje. Ver Riscos.

- **RF-15** — No mesmo quadro do reconhecimento, o sistema infere a expressão facial e a classifica em um
  conjunto fechado de rótulos.
- **RF-16** — A inferência afetiva acompanha o registro de presença com a medida de confiança.
- **RF-17** — O dado afetivo é agregado por turma, por horário e por professor.
- **RF-18** — A agregação tem um tamanho mínimo de grupo abaixo do qual nada é exposto — de modo que
  nenhuma leitura permita reconstruir o estado de um aluno identificável.
- **RF-19** — O dado agregado é disponibilizado ao sistema de RH de terceiros.

### 4.5 Frequência e relatórios

- **RF-20** — Relatório de frequência por turma e por período, restrito ao escopo de quem consulta.
- **RF-21** — Toda coleção retornada pelo sistema é limitada e paginada. Não existe rota que devolva o
  cadastro inteiro de um tenant.

---

## 5. Requisitos não-funcionais

### 5.1 Privacidade e conformidade

- **RNF-01** — A imagem facial existe apenas em memória, durante o processamento. Nunca é persistida em
  banco, disco, log, mensagem de erro ou resposta de API.
- **RNF-02** — A instituição é a controladora dos dados dos alunos. O Vultra opera como operador e espelha
  apenas os campos necessários para funcionar.
- **RNF-03** — Dado biométrico e dado afetivo são sensíveis (LGPD art. 11). Cada operação sobre eles tem
  base legal declarada, finalidade declarada e prazo de retenção declarado — e algo que execute o prazo.
- **RNF-04** — Registro de auditoria imutável para toda operação biométrica, incluindo as automáticas.
- **RNF-05** — O dado afetivo nunca é exposto de forma individualmente identificável em contexto negativo.
- **RNF-06** — Segredo e credencial nunca são versionados nem inseridos em log. Toda variável de ambiente é
  obrigatória e validada na inicialização; nenhum valor padrão é fornecido no ponto de leitura.

### 5.2 Segurança

- **RNF-07** — Nenhum endpoint que toque biometria é alcançável sem autenticação, em nenhum ambiente.
- **RNF-08** — Autorização é decidida no servidor, por rota. Interface que esconde um controle não é
  controle de acesso.
- **RNF-09** — O isolamento entre tenants é imposto no banco, não apenas na aplicação.
- **RNF-10** — Toda entrada de fronteira é validada antes de chegar à lógica; campo desconhecido é
  rejeitado, não ignorado.
- **RNF-11** — Resposta de erro não ecoa o corpo da requisição nem detalhe interno.

### 5.3 Operação e desempenho

- **RNF-12** — O reconhecimento responde dentro de um orçamento de tempo declarado por captura; estourá-lo
  é um desfecho tratado, não uma falha silenciosa.
- **RNF-13** — Indisponibilidade do serviço de inferência degrada a chamada, não derruba o sistema.
- **RNF-14** — Toda operação de banco tem limite de tempo. Lentidão não vira indisponibilidade.
- **RNF-15** — O sistema é observável: quem investiga um problema em produção consegue correlacionar uma
  requisição de ponta a ponta.

### 5.4 Interface

- **RNF-16** — Mobile-first, decidido em largura de telefone. O portal de chamada é usado com o celular na
  mão, em sala.
- **RNF-17** — Toda superfície assíncrona tem os quatro estados — carregando, vazio, erro com saída, e
  sucesso — e o estado de carregamento ocupa o espaço do conteúdo final.
- **RNF-18** — Filtro, período, paginação e sessão em andamento vivem na URL. Recarregar não perde
  contexto.
- **RNF-19** — Operável por teclado, com foco visível e rótulo associado a cada campo.

### 5.5 Restrições do projeto

- **RNF-20** — Entrega de dezembro de 2026: sistema demonstrável e artigo submetido. Capacidade que não
  sustenta um dos dois é posterior.
- **RNF-21** — Duas pessoas no repositório. O portão de qualidade é automático e falha sozinho — revisão
  humana não é substituível por auto-declaração de conclusão.
- **RNF-22** — Nenhum dado real de pessoa real entra no sistema antes de as questões abertas de conformidade
  estarem fechadas.

---

## 6. Critérios de aceite

Nível de capacidade. O detalhe fica na `/spec` de cada uma.

**Isolamento entre instituições**
Dado um usuário autenticado da instituição A, quando ele requisita qualquer recurso identificado por um
id da instituição B, então o sistema responde como se o recurso não existisse — e nada da instituição B é
lido, gravado ou revelado pelo tempo de resposta.

**Cadastro biométrico**
Dado um gestor e uma captura de qualidade suficiente, quando ele cadastra o rosto de um aluno já
matriculado, então o aluno passa a ser reconhecido, um registro de auditoria é criado, e nenhuma imagem é
persistida em lugar nenhum.

**Recusa por qualidade**
Dada uma captura abaixo do limiar, quando o cadastro é tentado, então ele é recusado com o motivo, nenhum
perfil é criado, e o quadro não aparece em log nem na resposta.

**Chamada automática**
Dada uma sessão aberta e um aluno cadastrado, quando a câmera o captura, então a presença é registrada uma
vez, e capturas seguintes do mesmo aluno na mesma sessão não geram duplicata.

**Não reconhecimento**
Dada uma sessão aberta e um rosto sem correspondência acima do limiar, quando a câmera o captura, então
nenhuma presença é registrada e o desfecho fica auditável.

**Escopo do professor**
Dado um professor, quando ele consulta ou opera qualquer sessão, então ele alcança apenas as próprias — e
tentar operar a sessão de outro professor falha no servidor, mesmo com o identificador correto em mãos.

**Recuperação de sessão**
Dada uma sessão de chamada aberta, quando o professor recarrega a página ou troca de dispositivo, então
ele reencontra a sessão em andamento e consegue encerrá-la.

**Revogação**
Dado um aluno com cadastro biométrico ativo, quando o cadastro é revogado, então ele deixa de ser
reconhecido a partir da próxima captura, e a revogação fica auditável.

**Agregação afetiva**
Dado um conjunto de registros com inferência afetiva, quando o dado é agregado para consumo externo, então
nenhum recorte devolvido permite atribuir um estado emocional a um aluno identificável.

**Degradação do serviço de inferência**
Dado o serviço de inferência indisponível, quando o professor abre a chamada, então o sistema permanece
operável para registro manual e informa o estado — em vez de falhar sem explicação.

---

## 7. Riscos

**R-01 · A contribuição de pesquisa não existe no código.** A análise de expressão facial — o que sustenta
o artigo — não está implementada em nenhuma camada. O serviço de inferência devolve apenas vetor,
qualidade e tempo; as colunas de sentimento no banco existem e nunca recebem valor; o relatório de
bem-estar e o portal que o consome renderizam um dado que nunca é produzido. Todo o restante do sistema é
andaime em volta de uma capacidade ausente. Com entrega em dezembro, esta é a prioridade única até estar
de pé.

**R-02 · O ciclo de correção anterior fechou com critério não cumprido.** Havia onze planos em
`implementation/`, removidos em 2026-08-15 e recuperáveis pelo git, com critérios de aceite dados como
concluídos. A auditoria de 2026-08-14 reencontrou
critérios explicitamente não atendidos em pelo menos dois deles. A causa não foi execução, foi verificação
auto-declarada — e qualquer processo novo que não conserte isso repete o ciclo.

**R-03 · Conformidade para pesquisa não está resolvida.** Ver Questões abertas Q-01.

**R-04 · O consumidor do dado afetivo não está combinado.** Ver Q-02.

---

## 8. Questões abertas

**Q-01 · Aprovação ética para pesquisa com seres humanos.** Não há decisão registrada sobre CEP/Plataforma
Brasil. A postura de minimização adotada — não armazenar imagem, tratar a instituição como controladora — é
correta e necessária, mas responde a outra pergunta: o gatilho de aprovação ética é publicar conclusões
sobre pessoas, e independe de onde o dado é guardado ou de quem o controla. Precisa de decisão antes de
qualquer coleta com aluno real e antes da submissão do artigo.
*Fechar até:* antes da primeira coleta com pessoa real. *Dono:* Theo e Vitor, com o orientador.

**Q-02 · Forma de entrega do dado ao sistema de RH.** Ainda não combinado com a outra equipe. A intenção
atual é disponibilizar o front e o back existentes para que eles analisem. Enquanto não fechar, o
`frontend-rh` permanece como entrega exploratória e não recebe investimento de qualidade.
*Fechar até:* antes de qualquer refatoração do `frontend-rh`. *Dono:* Theo e Vitor.

**Q-03 · Base legal e desenho da correlação entre estado afetivo do aluno e professor.** O produto pretende
responder qual professor concentra determinados estados emocionais. Isso cria duas exposições simultâneas:
dado sensível de titular possivelmente menor, e caracterização de desempenho de trabalhador a partir de
inferência afetiva. Precisa de finalidade declarada, tamanho mínimo de grupo e decisão sobre o que jamais é
exibido — não de mitigação depois.
*Fechar até:* antes de RF-17 entrar em desenvolvimento. *Dono:* Theo e Vitor, com o orientador.

**Q-04 · Origem dos dados cadastrais da instituição.** RNF-02 assume consulta ao banco da instituição. O
mecanismo — integração, importação periódica, cadastro manual — não está decidido, e ele determina o que o
portal institucional precisa oferecer.
*Fechar até:* antes de especificar o cadastro de aluno.

**Q-05 · Conjunto fechado de rótulos afetivos.** RF-15 exige um conjunto fechado. O README menciona sete
rótulos; o código não define nenhum. O conjunto precisa ser decidido junto com o modelo, porque é o que o
artigo vai reportar.
*Fechar até:* junto com R-01.

**Q-06 · Turma como entidade.** RF-09 e RF-17 pressupõem turma. O modelo de dados atual tem organização,
membro, dispositivo e sessão — não tem turma. Sem ela, não há como agregar por professor.
*Fechar até:* antes de RF-17.

---

## 9. Documentos relacionados

- Decisões que cruzam aplicações: `docs/decisions/`
- Decisões de um domínio: `docs/backend/adrs/`, `docs/database/adrs/`
- Especificações de funcionalidade: `docs/specs/`
- Auditoria de 2026-08-14: relatório publicado, achados rastreados no board

---

## Evolution log

**2026-08-14 — Criação do documento.**
Primeiro requirements do projeto, escrito após auditoria completa das cinco aplicações. Registra o que foi
decidido na sessão de levantamento:

- **Escopo do produto redefinido.** O produto é chamada por reconhecimento facial de alunos. A análise
  afetiva é subproduto entregue a um sistema de RH de terceiros, não um produto de RH nosso. O repositório
  aparentava o contrário.
- **`frontend-admin` deixa de existir como aplicação separada**, fundindo-se ao portal de professores. O
  portal único atende gestor da instituição e professor, com autorização por papel decidida no servidor. O
  painel de saúde do serviço de inferência sai da interface de produto e vira observabilidade de servidor.
- **`frontend-rh` fica como entrega exploratória** até Q-02 fechar.
- **Entrega dura estabelecida:** dezembro de 2026, sistema demonstrável e artigo a escrever e submeter. O
  tempo de escrita do artigo é parte do plano, não sobra dele.
- **Nenhum dado real de pessoa real no sistema hoje** — os achados críticos da auditoria são bloqueadores
  de piloto, não incidentes abertos.
- **Registrado R-01:** a análise afetiva, que sustenta o artigo, não existe em nenhuma camada do código.

**2026-08-15 — Baseline de segurança e contrato de trabalho.**

- **`docs/decisions/0001-baseline-de-seguranca.md`** fixa as regras transversais que fecham os achados
  Critical da auditoria. Nenhum requisito mudou; o que mudou é que as restrições de segurança passaram a
  ter um lugar único e citável.
- **`CLAUDE.md` na raiz** passa a ser o contrato de trabalho do repositório: comandos reais por aplicação,
  fronteiras da arquitetura, política de branch, e a definição de pronto que exige verificação não
  auto-declarada — a causa direta de R-02.
- **Ferramental agêntico consolidado em Claude Code.** As configurações de OpenCode e Copilot e as treze
  skills locais foram removidas por descreverem um sistema que não corresponde ao código. `implementation/`
  e `NEXT-STEPS.md` saíram pelo mesmo motivo.
- **Política de branch decidida:** `main` protegida, todo trabalho por Pull Request com aprovação do outro
  integrante.
