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
- Chave `service_role`, chave de criptografia e credenciais da Evolution ainda pendentes.
- Ainda nao foi confirmado se as 36 migracoes foram aplicadas no Supabase novo.
- O wacrm original envia e recebe pela Meta; a adaptacao Evolution ainda nao foi implementada.
- TypeScript passou na copia analisada.
- Lint passou com avisos.
- A suite analisada teve 619 testes aprovados e 5 falhas ligadas a data/moeda no ambiente brasileiro.

## Proximos passos obrigatorios

1. Obter de forma segura a chave `service_role` do Supabase novo.
2. Gerar e armazenar `ENCRYPTION_KEY` sem publica-la no Git.
3. Confirmar que as 36 migracoes foram aplicadas no Supabase `WaCrmBeHub`.
4. Obter URL, chave e nome da instancia Evolution na VPS.
5. Ler a documentacao do Next.js incluida em `node_modules/next/dist/docs/` antes de modificar codigo.
6. Criar interface de provedor de mensagens e adaptador Evolution 2.3.7.
7. Substituir a tela Meta por conexao Evolution com estado da instancia e QR Code dentro do CRM.
8. Implementar inbox bidirecional: receber, persistir, exibir e responder pelo CRM.
9. Implementar controle Diana/humano, fila e opt-out.
10. Criar as ferramentas restritas do Hermes e o pacote de atualizacao correspondente.
11. Testar somente com `+5547988976484`.

## Regra de continuidade

Toda mudanca que afete o Hermes deve atualizar `03-CONTRATO-HERMES.md` e registrar:

- o que mudou;
- campos e ferramentas afetados;
- permissao nova ou removida;
- exemplo de entrada e saida;
- teste necessario;
- instrucao que deve ser entregue ao Hermes.

Nunca deixar o Hermes depender de uma estrutura que nao esteja documentada.
