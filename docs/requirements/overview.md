# Visão geral

## Stakeholders

| Stakeholder | Quem é | Relação com o sistema |
| --- | --- | --- |
| **Time** | Theo Odawara e Vinicius Larsen | Autores do sistema e do artigo; únicos com acesso ao repositório |
| **Orientador** | Supervisão acadêmica da Iniciação Científica | Valida a direção da pesquisa e o conteúdo do artigo |
| **Gestor** | Secretaria ou coordenação da instituição | Cadastra pessoas e câmeras, dispara capturas, revoga cadastros |
| **Professor** | Docente da turma | Abre e encerra a chamada, corrige presença, consulta a própria turma |
| **Aluno** | Titular do dado biométrico e de emoção | Não opera o sistema; é reconhecido pela câmera |
| **Instituição** | Escola ou faculdade | Controladora dos dados dos alunos |
| **Equipe de RH** | Outra equipe, com outro sistema | Destinatária do dado de emoção agregado no E3 |

## Ambiente operacional

- **Captura:** câmera ESP32-CAM instalada na porta da sala, uma pessoa por vez.
- **Processamento:** o sistema roda em dois ambientes a partir dos mesmos artefatos
  ([NFR-FLEX-01](non-functional/flexibility.md#nfr-flex-01)): uma máquina local na mesma rede da
  câmera, onde se mede, e um servidor na nuvem, onde se demonstra.
- **Stack:** a que o repositório já usa, descrita no contrato de trabalho na raiz.

## Restrições

- **O trabalho acadêmico é o foco.** Capacidade que não sustenta o artigo nem a demonstração é posterior.
- **Prazo.** O alvo é dezembro de 2026; o limite é meados de 2027.
- **Ordem de construção.** E1 antes de E2, E2 antes de E3. Nada do painel começa antes de o núcleo
  funcionar de ponta a ponta.
- **Duas pessoas.** O portão de qualidade é automático; conclusão não é auto-declarada.
- **Dados.** Só os dos autores, públicos e sintéticos ([BR-04](business-rules.md#br-04)).
- **Segurança e desempenho não são adiados por prazo.** As proteções do E1 nascem com o núcleo.

## Premissas e dependências

- **O artigo é uma arquitetura de referência avaliada no pipeline real**, com o experimento de
  isolamento por instituição sobre busca vetorial como seção. É hipótese de trabalho até
  [OQ-01](open-questions.md#oq-01) fechar.
- **O pré-registro em [`../research/pre-registro.md`](../research/pre-registro.md) continua valendo
  para a seção experimental.** O novo enquadramento do artigo é um desvio a registrar nele.
- **A avaliação com dataset público não passa pela câmera.** Ela depende de um harness de pesquisa,
  fora deste SRS.
- **O E3 depende da equipe de RH**, com quem nada foi combinado ([OQ-05](open-questions.md#oq-05)).
- **Uso com alunos reais depende de instituição parceira e de conformidade**, e nenhuma das duas existe
  ([OQ-02](open-questions.md#oq-02), [OQ-04](open-questions.md#oq-04)).
