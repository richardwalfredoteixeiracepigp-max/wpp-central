# Supervisor Ileva — Instalação e atualização

> Passo a passo oficial. Versão atual: **8.6.1**. Atualizado a cada versão.

## 1. Gestor (computador onde fica o código)

1. Abra `chrome://extensions` (Edge: `edge://extensions`).
2. Ligue **Modo do desenvolvedor** (canto superior direito; no Edge, menu da esquerda).
3. **Carregar sem compactação** → escolha `C:\Users\ileva\Documents\IlevaSupervisor\extensao-gestor`.
4. Fixe o ícone: quebra-cabeça da barra → alfinete em "Ileva Supervisor".
5. Abra o WhatsApp Web e aperte **F5** (na primeira vez os dados do Tampermonkey são copiados sozinhos).
6. Tampermonkey → Painel → **desligue** o script "Ileva - Supervisor de Atendimento".
7. Clique no logo roxo → **Equipe e permissões** → crie o **PIN do gestor** e cadastre a equipe (nomes iguais aos usados no Supervisor).

**Atualizações:** automáticas (até 1 minuto depois de cada versão). Aba aberta pede **F5**.

## 2. Equipe (colaboradores)

> Enquanto a extensão não for publicada na loja do Chrome, a instalação é por pasta.

1. Copie `Ileva-Supervisor-Extensao-Equipe.zip` (pasta do gestor) para o computador.
2. Botão direito → **Extrair tudo** → destino `C:\Ileva` (fica `C:\Ileva\Ileva-Supervisor-Equipe`). **Não apague nem mova esta pasta.**
3. `chrome://extensions` → **Modo do desenvolvedor** → **Carregar sem compactação** → `C:\Ileva\Ileva-Supervisor-Equipe`.
4. Fixe o ícone.
5. Tampermonkey → Painel → **desligue** o script da Ileva (obrigatório na equipe).
6. WhatsApp Web → **F5**. Se pedir "Como podemos te chamar?", digite o **mesmo nome** de antes.

**Atualizações:** substitua o conteúdo de `C:\Ileva\Ileva-Supervisor-Equipe` pelo do zip novo; a extensão percebe em até 1 minuto.

## 3. Primeiro uso

| O quê | Onde |
|---|---|
| Nome, tema | Logo roxo → Meu perfil |
| Som, modo econômico | Logo roxo → Alertas e notificações |
| Proteção de tela por monitor, janela flutuante, transparência | Logo roxo → Telas e monitores |
| Abrir a janela flutuante | Botão "⧉ Abrir janela flutuante" ao abrir o WhatsApp, ou menu ⋯ do painel |
| Esconder para print/gravação | **Ctrl+Shift+9** em qualquer programa (de novo para mostrar) |

Se o Ctrl+Shift+9 não funcionar fora do Chrome: Configurações → Telas e monitores → **Abrir atalhos** → marcar **Global**.

## 4. Voltar para a versão anterior

- **Extensão com problema:** em `chrome://extensions` desligue "Ileva Supervisor" e religue o script no Tampermonkey.
- **Versão específica:** cópias de cada versão em `versoes-anteriores\` (lista em `versoes-anteriores\LEIA-ME.txt`) e no histórico do GitHub.

## 5. Problemas comuns

| Sintoma | Solução |
|---|---|
| Dois painéis na tela | Script do Tampermonkey ainda ligado: desligue-o |
| Aviso "modo do desenvolvedor" | Clique no **X** (não em Desativar) |
| "O Supervisor foi atualizado. Aperte F5" | Aperte F5 na aba |
| Erro em `chrome://extensions` | Envie print ao responsável; "Remover tudo" limpa a lista |
| Permissões não mudaram | Aguarde até 1 minuto e aperte F5 |

## 6. Programa do Windows (etapa 3) — em construção
Será instalado por um instalador `.exe` somente nos computadores que precisarem. A integração com o MicroSIP será instalada **apenas nos 5 computadores do Suporte Técnico**. Este capítulo será completado na entrega.

## 7. Desenvolvimento (gerar nova versão)
```
cd Documentos\IlevaSupervisor
python gerar-versao-colaborador.py
python build-extensao.py
```
Antes: copie o core atual para `versoes-anteriores\` e registre em `LEIA-ME.txt`. Depois: commit no VS Code (bloco "Supervisor Ileva") e **Sync Changes**.
