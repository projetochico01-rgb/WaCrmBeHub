# Plano mestre operacional — Hermes, Evolution e CRM

## Arquitetura que não pode ser quebrada

- **Hermes/Diana** é o funcionário que atende pelo WhatsApp nativo.
- **Supabase** é a fonte permanente da verdade e da auditoria.
- **Evolution API** é o canal do Inbox usado pelo CRM.
- **CRM** é o escritório para operação humana.
- Uma indisponibilidade do CRM, Evolution ou Hermes não deve derrubar os demais.

## Interface do produto

- A página legada **Agentes de IA** permanece no código, mas não aparece no menu.
- **Modelos Meta** permanecem no código e nas tabelas, mas não aparecem nas configurações Evolution-only.
- **Ofertas e moedas** passa a se chamar **Moeda padrão**.
- **Chaves de API** ficam em **Avançado** e são visíveis somente para owner/admin.

## Respostas rápidas

- CRUD usa o cliente Supabase autenticado e RLS de agent+, sem service role.
- Texto, botões e listas usam a mesma tabela `quick_replies`.
- Botões usam `POST /message/sendButtons/{instance}` da Evolution.
- Listas usam `POST /message/sendList/{instance}` da Evolution.
- A escolha recebida é persistida em `messages.interactive_reply_id`.
- Um envio humano pausa a cadência daquela conversa.

> Evolution 2.3.x teve relatos de mensagens interativas retornarem sucesso e
> permanecerem pendentes. Validar no telefone autorizado antes de liberar o
> recurso para atendimento real.

## Notificações operacionais

Tipos:

1. `new_contact` — cliente novo.
2. `human_handoff_requested` — Diana solicitou humano.
3. `invoice_received` — documento recebido.
4. `media_rejected` — arquivo acima do limite.
5. `channel_failure` — Evolution/WhatsApp desconectado.
6. `hermes_failure` — operação interna do Hermes falhou.

Alertas comerciais vão para o agente responsável; sem responsável, vão para
owner/admin. Falhas de infraestrutura vão somente para owner/admin.

## Campos que o Hermes pode preencher

O Hermes não recebe acesso genérico ao banco. A ação
`atualizar_campos_lead` aceita apenas campos marcados com
`custom_fields.hermes_writable = true`:

- Cidade
- Estado
- Valor médio da fatura
- Concessionária
- Melhor horário
- Fatura recebida

E-mail, nome e empresa continuam na ação restrita `atualizar_dados_lead`.
Qualquer outro campo é recusado. Cada atualização é registrada em
`behub_audit_log`.

## Ordem de implantação em um novo cliente

1. Criar conta e membros no CRM.
2. Aplicar todas as migrações Supabase.
3. Configurar Evolution e validar webhook.
4. Instalar/configurar Hermes com chave de escopo `hermes:operate`.
5. Definir os campos `hermes_writable` adequados ao segmento.
6. Validar texto, mídia, arquivo grande, handoff, notificações e campos.
7. Somente então desativar o modo de teste e liberar números reais.

## Checklist de aceitação

- [ ] Hermes responde sem depender do CRM.
- [ ] CRM envia e recebe pela Evolution.
- [ ] Resposta rápida de texto cria, edita, apaga e envia.
- [ ] Botão/lista chega ao telefone e a escolha volta ao CRM.
- [ ] Envio humano pausa automações da conversa.
- [ ] Todos os tipos de notificação aparecem em tempo real.
- [ ] Atendente não vê Chaves de API.
- [ ] Hermes não altera campo fora da allowlist.
- [ ] Alterações do Hermes aparecem na auditoria.
- [ ] Arquivo acima de 16 MB gera observação, handoff e notificação.
- [ ] Build, testes e migrações estão verdes.

## Migrações deste plano

- `040_operational_notifications.sql`
- `041_hermes_writable_fields.sql`

