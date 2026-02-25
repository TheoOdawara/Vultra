# 🔒 LGPD e Controle de Acesso — Portal RH

> **← [Voltar ao RH](../README.md)**

---

## Controle de Acesso

O Portal RH é restrito ao role `rh`. Todas as operações são **somente leitura**.

| Operação | Permitido |
|----------|:---------:|
| Visualizar relatórios de presença | ✅ |
| Visualizar dashboard de bem-estar | ✅ |
| Exportar relatórios | ✅ |
| Ver histórico individual | ✅ |
| Editar registros de presença | ❌ |
| Gerenciar membros | ❌ |
| Acessar dados de outro tenant | ❌ |

---

## Conformidade LGPD

| Princípio LGPD | Implementação no Portal RH |
|----------------|---------------------------|
| Finalidade (Art. 6, I) | Dados usados exclusivamente para gestão de RH da mesma organização |
| Necessidade (Art. 6, III) | Sentimento exibido como agregado — nunca individual identificável |
| Transparência (Art. 6, VI) | Funcionários cientes da política via termo aceito no onboarding |
| Acesso (Art. 18, II) | Funcionário pode solicitar seu histórico completo via portal |
| Exclusão (Art. 18, VI) | Admin pode anonimizar dados de ex-funcionário (vetor zerado, nome substituído) |

---

## Regra de Anonimização no Frontend

Ao exibir dados de membros com `is_active = FALSE` (ex-funcionários), o portal deve substituir `memberName` por `[Membro Inativo]` nos relatórios exportados para PDF/XLSX, independente do dado armazenado no banco.
