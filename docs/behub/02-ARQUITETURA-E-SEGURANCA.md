# Arquitetura e seguranca

## Fluxo alvo

`WhatsApp -> Evolution API -> backend do CRM -> Supabase -> inbox`

`Inbox -> backend do CRM -> Evolution API -> WhatsApp`

`Hermes -> ferramentas BeHub restritas -> backend do CRM -> Supabase/Evolution`

`Hermes cron -> pre-check sem IA -> skill behub-commercial -> ferramentas BeHub`

O CRM e a fonte oficial de contatos, conversas, mensagens, funil, observacoes, fila e auditoria. Hermes decide dentro das regras, mas nao recebe a chave administrativa do Supabase.

## Orquestracao da cadencia

O Hermes gerencia a cadencia com seu cron nativo. Nao usar Vercel Cron, Supabase Cron ou n8n para esse fluxo.

- `cadence_precheck.py` consulta o CRM sem acordar o modelo;
- se nao houver follow-up vencido, retorna `wakeAgent=false`;
- se houver, o cron abre uma sessao isolada com a skill `behub-commercial`;
- Hermes consulta o lead e chama `executar_followup`;
- o backend valida horario, opt-out, fila humana, vencimento, sequencia, modo de teste e concorrencia;
- Supabase guarda somente o estado e o historico da cadencia.

## Inbox obrigatorio

O usuario deve conseguir diretamente no CRM:

- ler texto;
- ouvir audio;
- abrir imagem e documento;
- responder pelo WhatsApp;
- ver mensagens da Diana na mesma conversa;
- distinguir Diana, humano e sistema;
- acompanhar envio, entrega, leitura e falha quando a Evolution fornecer os eventos;
- assumir e devolver o atendimento.

## QR Code da Evolution

A tela de configuracao Meta sera substituida por `Conectar WhatsApp`.

Fluxo desejado:

1. CRM consulta ou cria a instancia Evolution autorizada.
2. CRM solicita o pareamento.
3. QR Code aparece dentro do CRM.
4. Usuario escaneia com o WhatsApp.
5. CRM acompanha o estado da conexao.
6. Credenciais e chave ficam somente no servidor.

O painel da VPS permanece disponivel para manutencao, mas nao deve ser necessario no uso normal.

## Deduplicacao obrigatoria

Antes de criar contato:

1. normalizar o telefone;
2. procurar o telefone dentro da conta BeHub;
3. reutilizar o contato encontrado;
4. procurar a conversa existente;
5. criar somente quando nao existir;
6. impor restricao unica no banco;
7. deduplicar mensagens pelo identificador externo da Evolution e pela instancia.

Essa regra deve existir no backend e no banco, nao apenas no prompt do Hermes.

## Regras criticas transportadas do CRM antigo

- handoff pausa IA;
- resposta cancela cadencia;
- opt-out bloqueia novos contatos automaticos;
- fechado, perdido e aguardando humano nao recebem follow-up;
- limite de repeticao tecnica;
- idempotencia de leads e mensagens;
- historico e auditoria;
- bloqueio por horario;
- teste restrito ao numero autorizado;
- nenhuma dependencia do n8n.

## Segredos

Nunca versionar:

- `SUPABASE_SERVICE_ROLE_KEY`;
- `ENCRYPTION_KEY`;
- `EVOLUTION_API_KEY`;
- credenciais da VPS;
- tokens de sessao;
- chaves privadas do Hermes.
