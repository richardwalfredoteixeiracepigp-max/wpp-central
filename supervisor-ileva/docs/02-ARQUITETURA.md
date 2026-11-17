# Supervisor Ileva — Arquitetura

> Versão descrita: **8.6.1**. Atualizar este documento a cada mudança de estrutura.

## 1. Visão de componentes

```
 Computador do colaborador (Chrome/Edge)                         Nuvem
 ┌──────────────────────────────────────────────────┐   ┌───────────────────────────┐
 │ Extensão "Ileva Supervisor" (Manifest V3)          │   │ Planilha Google +          │
 │  flag.js      → marca a página (document_start)    │   │ Apps Script (Web App v11)  │
 │  content.js   → prelude.js + core (painel)  ───────┼──►│  reuniões, tarefas,        │
 │  background.js→ HTTP p/ planilha, atualização,     │   │  lembretes, finalizações,  │
 │                 atalho Ctrl+Shift+9, foco de aba   │   │  cfg (permissões, regras)  │
 │  options.*    → página de Configurações            │   └───────────────────────────┘
 │  chrome.storage.local = armazenamento compartilhado │   ┌───────────────────────────┐
 │       entre abas (substitui o GM_* do Tampermonkey) │──►│ MeisterTask (API interna,  │
 └──────────────────────────────────────────────────┘   │ sessão do próprio usuário) │
            │ lê o DOM (somente leitura)                  └───────────────────────────┘
            ▼
      WhatsApp Web
```

## 2. Código-fonte

| Arquivo | Papel |
|---|---|
| `ileva-supervisor-core.js` | **Fonte única** do sistema (≈480 KB). Toda mudança começa aqui. Formato de userscript (funciona no Tampermonkey e na extensão). |
| `gerar-versao-colaborador.py` | Gera `ileva-supervisor-colaborador.user.js` (versão equipe): remove relatórios, configurações gerais, base, tom. Falha se um trecho esperado mudar. |
| `build-extensao.py` | Gera `extensao-gestor/` e `extensao-equipe/` + zips. Lê `SHARED_URL`/`SHARED_KEY` do core e grava `config.js`. |
| `extensao-base/prelude.js` | Camada de compatibilidade: `GM_getValue`, `GM_setValue`, `GM_addValueChangeListener`, `GM_xmlhttpRequest` sobre `chrome.storage` e o background. Migra dados do Tampermonkey na primeira execução. |
| `extensao-base/background.js` | Service worker: HTTP para a planilha (só `script.google.com` e `script.googleusercontent.com`), atualização automática (lê `versao.txt` a cada minuto), atalho global, abrir Configurações, trazer a aba do WhatsApp para a frente. |
| `extensao-base/options.*` | Página de Configurações (HTML/CSS/JS sem dependências). |
| `agenda-planilha-google.gs` | Backend atual (Apps Script v11). Ações: `list`, `save`, `fin`, `lemb`, `tar`, `cfg`, `cfgset`, `chat`, `debug`. |

### Fluxo de build
`core.js` → `gerar-versao-colaborador.py` → `build-extensao.py` → `extensao-gestor/` (carregada no computador do gestor, atualiza sozinha) e zips para a equipe.

## 3. Dados

### 3.1 Armazenamento local (chrome.storage.local, compartilhado entre abas)
| Chave | Conteúdo |
|---|---|
| `ilevaSup.ui.v1` | Preferências de tela: posições por monitor, transparência, som, proteção de tela por monitor, tempo de minimizar |
| `ilevaSup.user.v1` | Nome do usuário neste computador (liga a pessoa às permissões e aos registros) |
| `ilevaSup.meet.v1`, `.tar.v1`, `.lemb.v1` | Cópia local de reuniões, tarefas e lembretes |
| `ilevaSup.acesso.v1` | Equipe, perfis, permissões, PIN (hash) e auditoria — cópia da planilha |
| `ilevaSup.pipRegra.v1` | Regra do gestor para a janela flutuante |
| `ilevaExt.prefs` | Preferências da extensão: tema, modo econômico, janela flutuante |
| `ilevaExt.hideUntil` | Supervisor escondido até (Ctrl+Shift+9) |
| `ilevaSup.summary.v1` | Resumo publicado pela aba do WhatsApp para as outras abas |

### 3.2 Planilha (fonte compartilhada até a etapa 2)
Abas: Reuniões, Atendimentos finalizados, Lembretes, Tarefas. Configurações gerais em `PropertiesService` (`cfg`):
`miniMin`, `block`, `acesso` (equipe/permissões/PIN/auditoria), `pipRegra`.
Limite conhecido: cada propriedade aceita ~9 KB — a auditoria guarda só as 25 últimas entradas.

## 4. Segurança

- **WhatsApp somente leitura**: o sistema não envia, edita nem apaga mensagens.
- Conteúdo de mensagens **não sai do navegador**; só sobem reuniões, tarefas, lembretes, finalizações e configurações.
- PIN do gestor guardado como **SHA-256 com salt**. Permissões aplicadas no navegador (organizam o uso, mas um usuário técnico pode contornar). **Verificação no servidor chega na etapa 2.**
- A extensão só faz requisições de rede para a planilha; o MeisterTask é acessado na própria aba, com a sessão do usuário.
- Nunca versionar senhas, a chave `service_role` do Supabase ou arquivos `.env`. Repositório GitHub **privado**.

## 5. Atualização
- **Gestor**: extensão carregada de `Documentos\IlevaSupervisor\extensao-gestor`; ao rodar o build, `versao.txt` muda e a extensão recarrega sozinha em até 1 min (abas em segundo plano recarregam; aba na frente pede F5).
- **Equipe**: hoje por zip (`C:\Ileva\Ileva-Supervisor-Equipe`). Planejado: loja do Chrome (não listada) para atualização automática.

## 6. Etapa 2 — Nuvem (planejada)
Supabase, região São Paulo. 11 tabelas, RLS por perfil, Realtime, Edge Functions. Detalhes no briefing técnico enviado ao parceiro.

## 7. Etapa 3 — Programa do Windows "Ileva Desktop" (em construção)

| Parte | Como |
|---|---|
| Alertas por cima de tudo | Janela sem moldura, sempre no topo, mesmos componentes visuais do Supervisor. Excluída de prints e gravações (`SetWindowDisplayAffinity` / `WDA_EXCLUDEFROMCAPTURE`, Windows 10 2004+). |
| Bloqueio do almoço | **Uma tela cheia por monitor, em todos os monitores conectados** (inclusive monitores ligados durante o almoço), em todos os computadores com o programa (gestor e colaboradores). Tempo, cores e campo de senha em todas as telas; teclado travado (Alt+Tab, Windows, Alt+F4). Desbloqueio com a senha do colaborador cadastrada no Supervisor ou PIN do gestor. Volta sozinho se for fechado e registra na auditoria. Ctrl+Alt+Del não é bloqueável (regra do Windows): mitigação por política do Windows. |
| Integração MicroSIP | Somente ramais do **Suporte Técnico** (ver Regras). Eventos via `microsip.ini`: `cmdIncomingCall`, `cmdCallAnswer`, `cmdCallStart`, `cmdCallEnd` (número de quem liga como parâmetro). Ações: `microsip.exe /transfer:RAMAL`, `/answer`, `/hangupall`. DND automático no almoço. Nada é alterado na central da Linq. |
| Comunicação | Programa ↔ extensão no mesmo computador (canal local); entre computadores pela planilha (depois Supabase em tempo real). |

### 7.1 Telefonia — ramais
Lista inicial do Suporte Técnico: Lucas 1000 · Francisco 1001 (ramal do gestor) · Adriel 1002 · Richard 1003 · Stony 1004.
O gestor adiciona/remove ramais em **Configurações > Administração > Telefonia** (PIN, auditoria). Transferências para números fora da lista são recusadas pelo programa.
