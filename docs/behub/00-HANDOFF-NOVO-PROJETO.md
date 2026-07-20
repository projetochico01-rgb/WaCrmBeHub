# Handoff - Novo CRM BeHub

## Onde continuar

- Projeto oficial: `C:\Projetos\CLIENTES\BeHub - Energia Solar Chico\NOVO CRM\wacrm-main`
- GitHub: `https://github.com/projetochico01-rgb/WaCrmBeHub.git`
- Branch inicial: `main`
- Supabase: projeto `WaCrmBeHub`
- URL publica do Supabase: `https://lnrnanahrfsoihurpjnf.supabase.co`
- Evolution API informada: versao `2.3.7`
- CRM antigo: preservar como referencia ate a virada ser validada.

## Decisao principal

O wacrm substituira o CRM antigo como interface e modelo principal. O canal Meta Cloud API sera trocado por uma camada de provedor Evolution API. O Hermes sera o agente operacional e se apresentara ao cliente como **Diana, atendente da equipe BeHub**. Nao usar n8n.

## Estado confirmado em 20/07/2026

- Repositorio novo clonado e vinculado ao remoto correto.
- `.env.local` criado e ignorado pelo Git.
- URL e chave publica do Supabase preenchidas.
- Evolution API 2.3.7 implementada sem n8n: configuracao, QR Code, envio, recebimento e status.
- Inbox identifica `Diana — IA`, `Humano` e `Sistema`.
- Modo de teste limita entrada e saida a `+5547988976484`.
- 37 migracoes prontas; execucao no Supabase aguarda confirmacao final do proprietario.
- Vercel conectada ao GitHub; a implantacao anterior falhou porque faltavam variaveis do Supabase.
- TypeScript, build e os 645 testes passaram; lint sem erros.

## Proximos passos obrigatorios

1. Executar as 37 migracoes no Supabase `WaCrmBeHub`.
2. Salvar as variaveis protegidas na Vercel e publicar o codigo novo.
3. Cadastrar URL, chave e instancia Evolution na tela de configuracoes do CRM.
4. Vincular o numero pelo QR Code exibido no proprio CRM.
5. Concluir ferramentas restritas do Hermes, fila, cadencia e teste ponta a ponta.

## Regra de continuidade

Toda mudanca que afete o Hermes deve atualizar `03-CONTRATO-HERMES.md` e registrar:

- o que mudou;
- campos e ferramentas afetados;
- permissao nova ou removida;
- exemplo de entrada e saida;
- teste necessario;
- instrucao que deve ser entregue ao Hermes.

Nunca deixar o Hermes depender de uma estrutura que nao esteja documentada.
