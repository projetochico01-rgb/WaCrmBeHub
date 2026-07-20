#!/usr/bin/env python3
"""Acorda o agente do Hermes somente quando existe follow-up vencido."""

import json
import os
import sys
import urllib.error
import urllib.request


def finish(wake: bool, **context: object) -> None:
    print(json.dumps({"wakeAgent": wake, "context": context}, ensure_ascii=False))


base_url = os.environ.get("BEHUB_CRM_URL", "").rstrip("/")
api_key = os.environ.get("BEHUB_HERMES_API_KEY", "")
if not base_url or not api_key:
    print("Configuração BeHub ausente", file=sys.stderr)
    sys.exit(2)

request = urllib.request.Request(
    base_url + "/api/v1/hermes",
    data=b'{"action":"listar_followups_pendentes"}',
    headers={"Authorization": "Bearer " + api_key, "Content-Type": "application/json"},
    method="POST",
)

try:
    with urllib.request.urlopen(request, timeout=20) as response:
        payload = json.load(response).get("data", {})
except (urllib.error.URLError, TimeoutError, ValueError) as error:
    print(f"Falha ao consultar o CRM BeHub: {type(error).__name__}", file=sys.stderr)
    sys.exit(1)

followups = payload.get("followups") or []
if not payload.get("allowed_now") or not followups:
    finish(False)
else:
    finish(True, pending_followups=len(followups))
