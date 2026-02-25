# 📡 Cadastro de Dispositivos ESP32

> **← [Voltar ao Admin](../README.md)**

---

## Fluxo de Cadastro

1. Admin preenche `label` e `location` no `DeviceEnrollCard`
2. Ao submeter: `POST /v1/devices` com `{ label, location, organizationId }`
3. A API gera `deviceId` (UUID) e `apiKey` (32 bytes aleatórios)
4. A `apiKey` é exibida **apenas uma vez** via modal do Shadcn (`AlertDialog`)
5. Um QR Code é gerado com a `apiKey` para configuração manual do ESP32
6. Após fechar o modal: a `apiKey` nunca é exibida novamente — apenas o hash bcrypt fica no banco

---

## Campos do Formulário

| Campo | Tipo | Validação | Obrigatório |
|-------|------|-----------|:-----------:|
| `label` | string | Min 3 chars, max 50 | ✅ |
| `location` | string | Max 100 chars | ❌ |

---

## Segurança do Modal de Exibição

O modal que exibe a `apiKey` deve:

- Ter um aviso explícito: *"Esta chave será exibida apenas uma vez. Copie e configure o dispositivo antes de fechar."*
- Incluir botão de copiar para clipboard
- Não fechar ao clicar fora (usar `onInteractOutside={(e) => e.preventDefault()}`)
- Incluir campo de confirmação ("Confirmo que salvei a chave") antes de habilitar o botão "Fechar"

---

## Rotação de Chave

Para revogar e gerar uma nova chave: `POST /v1/devices/:id/rotate-key`. O fluxo de exibição é idêntico ao cadastro inicial. A chave antiga é invalidada **imediatamente** após a rotação.
