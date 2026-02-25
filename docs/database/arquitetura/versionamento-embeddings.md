# 🧬 Versionamento de Embeddings

> **← [Voltar ao Database](../README.md)**
> Consulte também: [backend/adrs/ADR-002-arcface-modelo-padrao.md](../../backend/adrs/ADR-002-arcface-modelo-padrao.md)

---

## O Problema

Embeddings são **geometricamente específicos do modelo que os gerou**. Um vetor produzido pelo ArcFace **não é comparável** com um vetor produzido pelo Facenet512 ou por uma versão futura do mesmo modelo.

Misturar vetores de modelos diferentes na busca por similaridade produz resultados **incorretos silenciosamente** — sem erro, com matches errados ou ausentes.

---

## O Risco Crítico do VULTRA

Ao migrar de modelo (ex: `ArcFace-v1` → `ArcFace-v2`), todos os embeddings existentes tornam-se incompatíveis e precisam ser regenerados.

**Problema:** A LGPD proíbe armazenar imagens. Logo, **não há como re-processar automaticamente**. Uma migração de modelo exige que cada membro realize um novo **cadastro biométrico físico** via ESP32-CAM.

Isso torna a escolha do modelo uma **decisão arquitetural de longo prazo** com alto custo operacional de reversão.

---

## A Coluna `model_version` — Uso Obrigatório

A coluna `model_version` em `biometric_profiles` **deve sempre ser preenchida** com o identificador exato do modelo usado na geração do vetor.

| Valor | Significado |
|-------|-------------|
| `'ArcFace-v1'` | Modelo inicial do VULTRA (padrão atual) |
| `'ArcFace-v2'` | Versão futura do ArcFace |
| `'Facenet512-v1'` | Alternativa caso ArcFace seja descontinuado |

> **Regra de implementação:** Toda query de reconhecimento **deve** incluir `AND model_version = $currentModel`. Sem esse filtro, perfis de versões antigas contaminam os resultados.

---

## Auditoria Pré-Migração

Antes de qualquer troca de modelo, executar:

```
SELECT organization_id, COUNT(*) AS profiles_to_reenroll
FROM biometric_profiles
WHERE model_version != '<nova_versão>'
GROUP BY organization_id
ORDER BY profiles_to_reenroll DESC;
```

O resultado deve ser comunicado aos admins dos tenants afetados **antes** de iniciar a migração.

---

## Estratégia de Migração

```
1. Atualizar DEEPFACE_MODEL no AI Service (novo modelo entra em produção)
2. Novos enrollments já usam model_version atualizado automaticamente
3. Auditar perfis desatualizados por tenant (query acima)
4. Notificar admins para agendar re-enrollment em massa
5. Opcional: dual-stack temporário — comparar contra ambas as versões
   → custo: dobra o tempo de busca vetorial
6. Após 100% migrado: is_active = FALSE nos perfis antigos
7. NUNCA deletar embeddings antigos antes de confirmar re-enrollment completo
```
