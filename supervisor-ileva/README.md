# Supervisor Ileva

Painel de atendimento da Ileva Gestão: lê o WhatsApp Web (somente leitura) e mostra atendimentos,
reuniões, tarefas, lembretes, Raio-X e alertas, também nas outras abas do navegador.
Roda como extensão própria do Chrome/Edge (Manifest V3) e, em modo legado, como script do Tampermonkey.

## Documentação

| Documento | Conteúdo |
| --- | --- |
| [Visão geral](docs/01-VISAO-GERAL.md) | O que é, perfis, módulos, etapas |
| [Arquitetura](docs/02-ARQUITETURA.md) | Componentes, dados, segurança, etapas 2 e 3 |
| [Instalação e atualização](docs/03-INSTALACAO.md) | Passo a passo do gestor e da equipe, problemas comuns |
| [Regras do projeto](docs/04-REGRAS-DO-PROJETO.md) | WhatsApp somente leitura, telefonia só no Suporte, versões |
| [Histórico de versões](docs/CHANGELOG.md) | O que mudou em cada versão |

## Estrutura

| Arquivo / pasta | O que é |
| --- | --- |
| `ileva-supervisor-core.js` | Código-fonte principal (versão do gestor). **Toda mudança começa aqui.** |
| `gerar-versao-colaborador.py` | Gera `ileva-supervisor-colaborador.user.js` (versão da equipe) a partir do core. |
| `build-extensao.py` | Gera as extensões `extensao-gestor/` e `extensao-equipe/` e os zips de instalação. |
| `extensao-base/` | Partes fixas da extensão: `prelude.js` (armazenamento e conexões), `background.js`, `flag.js`, ícones. |
| `agenda-planilha-google.gs` | Backend atual (Google Apps Script da planilha compartilhada). Será trocado pelo Supabase. |
| `COMO-*.txt` / `.png` | Guias rápidos (o guia oficial é `docs/03-INSTALACAO.md`). |
| `docs/` | Documentação oficial do sistema. |

## Gerar uma nova versão

```
python gerar-versao-colaborador.py
python build-extensao.py
```

A extensão do gestor (pasta `extensao-gestor`) se atualiza sozinha em até 1 minuto.
Os zips gerados são distribuídos para a equipe (não ficam no Git).

## Segurança

- Repositório **privado**. O core contém a chave de acesso da planilha atual (`SHARED_KEY`).
- Nunca versionar senhas, a chave `service_role`/secret do Supabase nem arquivos `.env`.
