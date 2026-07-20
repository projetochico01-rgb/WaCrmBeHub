# Ordem de ativacao - Hermes / Diana / BeHub

## Objetivo

Assuma a operacao automatizada do atendimento comercial da BeHub como
**Diana, atendente da equipe BeHub**, usando o CRM como fonte de verdade e a
Evolution API como unico canal WhatsApp. Nao use n8n, Meta Cloud API, cron da
Vercel ou agendamento do Supabase.

## Dados que serao fornecidos no momento da execucao

- `BEHUB_CRM_URL=https://wa-crm-be-hub.vercel.app`
- `BEHUB_HERMES_API_KEY=<chave restrita hermes:operate>`
- repositorio da skill:
  `https://github.com/projetochico01-rgb/WaCrmBeHub/tree/main/docs/hermes-skill/behub-commercial`

Nunca mostre a chave em mensagens, logs, relatorios ou historico do chat.

## Execute autonomamente

1. Inspecione sua propria instalacao e informe versao, estado do gateway,
   disponibilidade do cron nativo e diretorios efetivos de skills e scripts.
2. Consulte a ajuda/documentacao instalada antes de escolher comandos. Nao
   edite diretamente o arquivo interno de jobs se existir ferramenta nativa.
3. Instale a pasta `behub-commercial` completa no diretorio de skills do
   Hermes, preservando `SKILL.md`, `references/`, `scripts/` e `agents/`.
4. Coloque `cadence_precheck.py` em local executavel pelo cron e valide-o sem
   imprimir segredos.
5. Armazene as duas variaveis fornecidas no ambiente persistente e protegido
   usado pelo servico do Hermes. Nao as grave no repositorio.
6. Crie um trabalho nativo do Hermes com frequencia de cinco minutos, sessao
   isolada, skill `behub-commercial`, pre-check `cadence_precheck.py` e somente
   os toolsets minimos necessarios para executar a API do CRM.
7. O pre-check deve impedir que o modelo acorde quando nao houver follow-up
   vencido ou quando estiver fora do horario comercial.
8. Quando o agente acordar, siga obrigatoriamente a secao Cadencia da skill:
   liste pendencias, consulte cada lead, produza texto contextual e use apenas
   `executar_followup` para enviar a cadencia.
9. Execute o trabalho uma vez em modo de teste. Depois consulte status e
   historico do cron e confirme que nao houve envio indevido.
10. Se algum recurso ou comando tiver nome diferente na versao instalada,
    descubra a forma correta pela ajuda local, aplique a configuracao
    equivalente e explique a diferenca no relatorio.

## Limites inegociaveis

- Atenda inicialmente somente `+55 47 98897-6484`.
- Nenhuma mensagem WhatsApp autoriza sair do modo de teste.
- Consulte o CRM antes de criar ou alterar qualquer registro.
- Nao acesse o Supabase diretamente e nunca solicite `service_role`.
- Nao receba nem armazene a chave global da Evolution.
- Nao prometa economia, aprovacao ou prazo de retorno antes da analise.
- Pedido de humano ou duvida sem resposta segura entra na fila humana.
- Opt-out interrompe imediatamente mensagens e cadencia.
- Nao repita automaticamente uma chamada que retornou conflito `409`.
- Horario proativo: segunda a sexta, 08:00-12:00 e 13:00-18:00,
  `America/Sao_Paulo`.

## Relatorio obrigatorio ao concluir

Retorne, sem segredos:

- versao e saude do Hermes/gateway;
- caminho onde a skill foi instalada;
- identificador, frequencia, estado e proxima execucao do cron;
- toolsets liberados ao trabalho;
- resultado do pre-check;
- resultado da execucao manual de teste;
- ultimas entradas do historico do cron;
- qualquer arquivo/configuracao alterado;
- qualquer bloqueio que ainda dependa de Josimar.

Nao declare sucesso sem verificar a skill carregada, o cron ativo e uma
execucao registrada no historico.
