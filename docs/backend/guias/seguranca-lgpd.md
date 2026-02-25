# 🛡️ Segurança Biométrica e LGPD

> **← [Voltar ao Backend](../README.md)**
> Implementação técnica: [arquitetura/processamento-ram.md](../arquitetura/processamento-ram.md)

---

## Regra Absoluta

> **NENHUMA imagem deve tocar o disco.**  
> O processamento biométrico ocorre integralmente na RAM do AI Service.

A violação desta regra é classificada como **Incidente de Segurança P0** e constitui infração à **LGPD Art. 11** (dados biométricos são dados sensíveis com regime especial de tratamento).

### O que é PROIBIDO

- `cv2.imwrite()` ou qualquer operação de escrita em disco com imagens
- Salvar frames em `/tmp` ou qualquer diretório temporário
- Logar o conteúdo de `frame_base64` (qualquer parte dele)
- Retornar o frame de volta ao cliente em qualquer resposta
- Armazenar binários de imagem no banco de dados (coluna `bytea`, S3, etc.)

### O que é OBRIGATÓRIO

- Processar o frame em memória: `base64 → numpy array → DeepFace → vector`
- Deletar a referência ao array numpy após gerar o embedding
- Persistir apenas o `vector(512)` no PostgreSQL

---

## Princípio de Minimização de Dados (LGPD Art. 6, III)

| Dado | Armazenado? | Formato |
|------|:-----------:|---------|
| Frame JPEG (imagem bruta) | ❌ | — |
| Embedding facial | ✅ | `vector(512)` no pgvector |
| Score de sentimento | ✅ | `REAL` (0–1) |
| Label de sentimento | ✅ | `TEXT` (`happy`, `neutral`, etc.) |
| Score de confiança do match | ✅ | `REAL` (0–1) |

---

## Consentimento e Direito de Exclusão

| Requisito LGPD | Implementação |
|----------------|---------------|
| Consentimento (Art. 7) | Termo explícito por tenant, versionado, armazenado em `organizations.settings` |
| Direito de exclusão (Art. 18, VI) | Soft delete + anonimização do vetor (`face_embedding = NULL`, `is_active = FALSE`) |
| Responsabilização (Art. 6, X) | Audit log imutável em `audit_logs` para todas as operações biométricas |

---

## Multitenancy e Isolamento

Todo acesso a dados biométricos deve incluir filtro por `organization_id`. Vazamento de perfis biométricos entre tenants é falha **P0** — mais grave do que vazamento de dados comuns por envolver dados sensíveis.
