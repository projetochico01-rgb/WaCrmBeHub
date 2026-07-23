# Pendências manuais de implantação

Este roteiro deve ser executado somente depois que a nova versão do CRM estiver publicada.

## 1. Aplicar os SQLs no Supabase

No projeto **WaCrmBeHub**, abra **SQL Editor > New query**.

1. Copie todo o conteúdo de `supabase/migrations/040_operational_notifications.sql`, cole no editor e clique em **Run**.
2. Depois copie todo o conteúdo de `supabase/migrations/041_hermes_writable_fields.sql`, cole em uma nova consulta e clique em **Run**.

Os dois resultados devem terminar sem erro. Eles são repetíveis: usam `IF NOT EXISTS`, substituição de funções e recriação controlada de gatilhos.

### Conferir as notificações

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'notifications'
  and column_name in ('severity', 'metadata')
order by column_name;

select trigger_name, event_object_table
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name in (
    'on_contact_created_notification',
    'on_human_handoff_notification',
    'on_invoice_received_notification',
    'on_rejected_media_notification',
    'on_evolution_failure_notification'
  )
order by trigger_name;
```

Resultado esperado: duas colunas e cinco gatilhos.

### Conferir os campos permitidos ao Hermes

```sql
select field_name, field_type, hermes_writable
from custom_fields
where hermes_writable = true
order by field_name;
```

Resultado esperado para a BeHub: Cidade, Estado, Valor médio da fatura, Concessionária, Melhor horário e Fatura recebida.

## 2. Validar as mudanças visuais

- “Agentes de IA” não aparece mais no menu.
- “Modelos” não aparece mais nas Configurações.
- “Ofertas e moedas” aparece como “Moeda padrão”.
- “Chaves de API” aparece dentro de “Avançado” somente para owner/admin.

## 3. Validar respostas rápidas

1. Em **Configurações > Respostas rápidas**, crie uma resposta de texto simples.
2. Edite e salve novamente.
3. Abra uma conversa e envie essa resposta.
4. Crie uma resposta interativa com dois botões e envie ao número de teste.
5. Toque em uma opção no telefone e confirme que a seleção aparece no Inbox.

Se a Evolution aceitar o envio mas o botão não chegar, registrar a versão instalada da Evolution. Algumas versões 2.3 tiveram falha de entrega de interativos; não liberar botões em produção até o teste real passar.

## 4. Validar notificações

Usando apenas o contato de teste, provocar um evento por vez e verificar a aba **Notificações**:

- cadastrar cliente novo;
- solicitar atendimento humano;
- enviar uma fatura válida;
- enviar arquivo acima de 16 MB;
- desconectar e reconectar a instância Evolution em uma janela controlada.

Não provocar uma falha real do Hermes em produção. Esse alerta deve ser validado primeiro em ambiente de teste.

## 5. Conectar a nova ação ao plugin do Hermes

O CRM agora aceita a ação restrita `atualizar_campos_lead`, mas o plugin `behub-supabase` da VPS ainda precisa expor essa ação ao Hermes. A ferramenta deve enviar somente:

```json
{
  "action": "atualizar_campos_lead",
  "phone": "telefone do próprio cliente",
  "campos": {
    "Cidade": "Rio do Sul",
    "Estado": "SC"
  }
}
```

O Hermes não deve receber acesso SQL, service role ou permissão genérica. Depois da alteração do plugin, testar com o número autorizado e confirmar:

```sql
select c.name, cf.field_name, ccv.value, ccv.created_at
from contact_custom_values ccv
join contacts c on c.id = ccv.contact_id
join custom_fields cf on cf.id = ccv.custom_field_id
where cf.hermes_writable = true
order by ccv.created_at desc
limit 20;
```

## 6. Encerramento

Somente considerar esta implantação concluída quando texto, interativo, notificações e campos estruturados estiverem confirmados no telefone, CRM e Supabase.
