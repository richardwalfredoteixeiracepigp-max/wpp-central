# Supervisor Ileva — Regras do projeto

> Regras de negócio e de segurança que **qualquer pessoa** que mexer no sistema (equipe, parceiros, Claude) deve seguir.

## WhatsApp
1. **Somente leitura.** O sistema nunca digita, envia, edita, apaga ou reage a mensagens.
2. O conteúdo das mensagens **não sai do navegador**.

## Telefonia (MicroSIP / Linq)
1. Participam **somente os ramais do Suporte Técnico**: Lucas 1000 · Francisco 1001 (ramal do gestor) · Adriel 1002 · Richard 1003 · Stony 1004.
2. Novos ramais do Suporte só podem ser adicionados pelo **gestor** (Configurações > Administração > Telefonia, com PIN e auditoria).
3. **Os demais ramais (Comercial, Financeiro e outros) não podem ser afetados de forma alguma.** As ligações deles continuam como estão.
4. O sistema **não altera nada na central da Linq** (filas, ramais, URA, configurações).
5. A integração é instalada **somente nos computadores do Suporte**. Transferência para número fora da lista é recusada.
6. Credenciais da Linq/MicroSIP **nunca** são enviadas, guardadas no código ou mostradas em prints.

## Almoço
1. A tela de almoço cobre **todos os monitores** do computador, no computador do gestor e nos dos colaboradores.
2. Só sai com a senha do colaborador responsável pela máquina (cadastrada no Supervisor) ou com o PIN do gestor.

## Pessoas e acesso
1. O nome no Supervisor é a identidade da pessoa: deve ser **o mesmo** em Meu perfil e no cadastro do gestor.
2. Sempre deve existir **pelo menos um gestor ativo**.
3. Mudanças de equipe, permissões e regras ficam na **auditoria**.

## Código e versões
1. Toda mudança começa no `ileva-supervisor-core.js`; nunca editar à mão os arquivos gerados.
2. Antes de mudar: cópia em `versoes-anteriores\` + linha no `LEIA-ME.txt`.
3. Toda versão atualiza: `@version`, `docs/CHANGELOG.md` e, se necessário, os demais documentos.
4. Repositório **privado**. Nada de senhas, chaves secretas ou `.env` no Git.
