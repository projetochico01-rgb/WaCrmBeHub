# API controlada do Hermes

Base: variável `BEHUB_CRM_URL` (produção: `https://wa-crm-be-hub.vercel.app`).

Endpoint único: `POST $BEHUB_CRM_URL/api/v1/hermes`

Cabeçalhos:

```text
Authorization: Bearer $BEHUB_HERMES_API_KEY
Content-Type: application/json
```

Nunca imprimir ou registrar `BEHUB_HERMES_API_KEY`.

## Ações

- `buscar_lead`: `phone` ou `contact_id`.
- `registrar_observacao`: `contact_id`, `content`, opcionais `conversation_id`, `deal_id`, `observation_type`, `metadata`.
- `atualizar_dados_lead`: `contact_id` e um ou mais de `name`, `email`, `company`.
- `solicitar_mudanca_etapa`: `contact_id`, `stage`, opcional `reason`.
- `enviar_para_fila_humana`: `contact_id`, `conversation_id`, opcional `reason`.
- `registrar_optout`: `contact_id`, `conversation_id`, opcional `reason`.
- `enviar_mensagem`: `contact_id`, `conversation_id`, `text`. Usar no atendimento normal.
- `listar_followups_pendentes`: sem identificador de contato. Retorna `allowed_now`, `next_allowed_at` e `followups`.
- `executar_followup`: `contact_id`, `conversation_id`, `text`. Usar exclusivamente para a cadência.

Sucesso: `{ "data": ... }`. Falha: `{ "error": { "code": "...", "message": "..." } }`.

`executar_followup` pode responder 409 com `outside_business_hours`, `cadence_blocked`, `not_due`, `cadence_complete` ou `already_claimed`. Esses retornos significam **não reenviar**.

## Exemplo seguro em Python

```python
import json, os, urllib.request

req = urllib.request.Request(
    os.environ["BEHUB_CRM_URL"].rstrip("/") + "/api/v1/hermes",
    data=json.dumps({"action": "buscar_lead", "phone": "5547..."}).encode(),
    headers={
        "Authorization": "Bearer " + os.environ["BEHUB_HERMES_API_KEY"],
        "Content-Type": "application/json",
    },
    method="POST",
)
with urllib.request.urlopen(req, timeout=20) as response:
    result = json.load(response)
```
