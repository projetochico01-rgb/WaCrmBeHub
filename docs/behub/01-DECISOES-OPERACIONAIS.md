# Decisoes operacionais BeHub

## Identidade e canais

- Nome apresentado ao cliente: **Diana**.
- Descricao: **atendente da equipe BeHub**.
- Atendimento automatico: 24 horas.
- Atendimento humano: segunda a sexta, 08:00-12:00 e 13:00-18:00.
- O cliente nao ve rotulo de IA.
- No CRM, mensagens mostram apenas `Diana - IA`, `Humano` ou `Sistema`. Nao mostrar o nome de Josimar no rotulo padrao.

## Kanban enxuto

1. Novo lead
2. Em atendimento
3. Aguardando atendimento humano
4. Qualificado
5. Nao qualificado
6. Fechado
7. Perdido

Situacoes como aguardando fatura, fatura recebida, em analise, pendencia e motivo da decisao sao observacoes e eventos internos, nao colunas do Kanban.

## Observacoes do lead

Separar:

- observacao interna livre;
- resumo atual da Diana;
- dados estruturados da qualificacao;
- resultado preliminar da fatura;
- proxima acao sugerida;
- historico imutavel de observacoes;
- historico de mudancas de status, autor, data e motivo.

Hermes pode acrescentar registros, mas nao apagar silenciosamente o historico anterior.

## Fila humana

- Pedido de humano pausa a Diana e coloca a conversa em `Aguardando atendimento humano`.
- Ordenar prioritariamente pela solicitacao mais antiga.
- Mostrar quantidade aguardando, maior espera e conversas sem responsavel.
- Fora do expediente, manter a posicao para o proximo periodo.
- Quando um humano envia mensagem pelo inbox, Diana permanece pausada.
- Retorno para Diana exige acao explicita.

## Modo de teste

- Unico numero liberado: `+5547988976484`.
- A trava deve existir no backend antes de qualquer envio.
- A lista nao pode ser alterada pelo atendimento comercial nem pelo WhatsApp.
- Somente Josimar pode liberar, em sessao autenticada na VPS e com confirmacao auditada.
- A autenticacao da VPS possui 2 fatores, conforme informado.

## Cadencia desejada

- Primeira retomada apos 15 minutos sem resposta.
- Segunda retomada 4 horas depois.
- Encerramento 24 horas depois da segunda mensagem.
- Follow-up proativo somente em horario comercial.
- Resposta iniciada pelo cliente pode ser atendida 24 horas.
- Resposta, opt-out, handoff, fechado ou perdido cancelam as pendencias.

## Fora de escopo atual

- n8n;
- ativacao de Instagram antes da integracao especifica;
- promessa de economia sem analise;
- aprovacao automatica definitiva da fatura antes de os criterios serem confirmados com o cliente BeHub.
