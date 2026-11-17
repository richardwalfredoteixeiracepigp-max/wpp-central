# Supervisor Ileva — Visão geral

> Documento vivo. Atualizado a cada versão. Versão do sistema descrita aqui: **8.6.1** (16/11/2026).

## O que é

O **Supervisor Ileva** é o sistema interno de acompanhamento de atendimento da **Ileva Gestão**. Ele lê o
**WhatsApp Web somente para leitura** (nunca envia, edita ou apaga mensagens) e organiza o trabalho da equipe:
atendimentos em aberto, reuniões, tarefas, lembretes de cobrança, Raio-X diário, almoço e alertas.

Hoje roda como **extensão própria do Chrome/Edge** (substituiu o Tampermonkey em 16/11/2026). Uma versão
legada em Tampermonkey continua disponível e fica parada sozinha quando a extensão está instalada.

## Quem usa

| Perfil | Quem | O que pode |
|---|---|---|
| Gestor | definido em Configurações > Equipe e permissões | Tudo, incluindo equipe, permissões, regras e auditoria (protegido por PIN) |
| Supervisor | definido pelo gestor | Revisão de tom, ronda, excluir/finalizar registros de colegas |
| Colaborador | padrão | Atendimentos, reuniões, tarefas, lembretes, Raio-X, chat da equipe |

O gestor pode ligar/desligar permissões pessoa a pessoa. Sem equipe cadastrada, todos têm o acesso anterior.

## Módulos

| Módulo | Onde aparece | Resumo |
|---|---|---|
| Atendimentos | Painel no WhatsApp, barra e fila em todas as abas | Classifica grupos de clientes em urgente / no prazo / retorno, com fila de prioridade |
| Finalização automática | Painel | Cliente agradeceu/confirmou, equipe enviou vídeo ou documento, base de frases aprendidas |
| Reuniões | Alerta flutuante, aba Reuniões, MeisterTask | Agenda compartilhada, "Ministrando", finalização por qualquer computador |
| Horários disponíveis | Aba Reuniões | Grade 09:30/14:30, aviso de horários já oferecidos por outro colaborador |
| Tarefas | Aba Tarefas, avisos, MeisterTask | Prazo em dias úteis, arquivos no servidor obrigatórios, entrega e aprovação |
| Lembretes | Aba Lembretes, avisos | Cobranças com "Cobrei", "Resolvido", "+1 h" |
| Raio-X | Aba Raio-X, MeisterTask | Preenchimento do card "Raio x Diário" |
| Almoço | Tela cheia / espera em outros monitores | 1h15, cores por tempo, aviso ao exceder |
| Bom dia / proteção de tela | Tela cheia | Mensagem do dia, indicadores, após 5 min sem atividade (por monitor) |
| Janela flutuante | Janela por cima de tudo | Barra, fila e avisos com o navegador minimizado; clicar abre o painel |
| Privacidade | Atalho Ctrl+Shift+9 | Esconde o Supervisor por 5 min (print, gravação, apresentação) |
| Configurações | Ícone da Ileva na barra do navegador | Pessoal, Administração (PIN), Sistema; tema claro/escuro |
| Bloqueio de sites | Regras da equipe | YouTube e Spotify para a equipe |

## Etapas do projeto

| Etapa | Situação | Conteúdo |
|---|---|---|
| 1. Extensão própria | ✅ Concluída (8.2.0 → 8.6.1) | Substitui o Tampermonkey; Configurações; permissões; janela flutuante |
| 2. Nuvem | ⏳ Com o parceiro | Supabase (São Paulo): login individual, permissões no servidor, tempo real. Briefing técnico enviado |
| 3. Programa do Windows | ▶️ Iniciando | Alertas por cima de tudo e invisíveis em prints; bloqueio do almoço; integração MicroSIP (somente Suporte) |

## Documentos

- [02 — Arquitetura](02-ARQUITETURA.md)
- [03 — Instalação e atualização](03-INSTALACAO.md)
- [04 — Regras do projeto](04-REGRAS-DO-PROJETO.md)
- [CHANGELOG — histórico de versões](CHANGELOG.md)
