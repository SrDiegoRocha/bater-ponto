<p align="center">
  <img src="assets/icon.png" width="96" alt="Ícone do Bater Ponto" />
</p>

<h1 align="center">bater ponto.</h1>

<p align="center">
  App Android pessoal e offline para registrar a jornada de trabalho, entender o período e estimar o salário.<br/>
  Feito com Expo SDK 57 · React Native 0.86 · TypeScript · SQLite.
</p>

---

## Sumário

- [Visão geral](#visão-geral)
- [Status do projeto](#status-do-projeto)
- [Como o app pensa: conceitos de domínio](#como-o-app-pensa-conceitos-de-domínio)
- [Principais regras de negócio](#principais-regras-de-negócio)
- [Funcionalidades](#funcionalidades)
- [Identidade visual e design system](#identidade-visual-e-design-system)
- [Stack técnica](#stack-técnica)
- [Arquitetura](#arquitetura)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Modelo de dados](#modelo-de-dados)
- [Como rodar](#como-rodar)
- [Scripts](#scripts)
- [Testes](#testes)
- [Ativos da marca](#ativos-da-marca)
- [Convenções de código](#convenções-de-código)
- [Roadmap](#roadmap)
- [Documentação completa](#documentação-completa)

---

## Visão geral

O **Bater Ponto** é um app para quem tem jornadas **fragmentadas** e que **atravessam a meia-noite**, casos que os apps de ponto tradicionais tratam mal. Exemplos reais de um único dia de trabalho:

```
Exemplo A   08:00 ━━━ 11:00 ┄┄┄ 5h de intervalo ┄┄┄ 16:00 ━━━━━━━ 23:00
            Trabalhado 10h · Intervalo 5h · Amplitude 15h

Exemplo B   04:00 ━━ 09:00 ┄ 8h ┄ 17:00 ━━ 20:00 ┄ 3h ┄ 23:00 ━━ 02:00(+1)
            Trabalhado 11h · Intervalos 11h · Amplitude 22h
```

O usuário marca explicitamente o **início do dia** e o **fim do dia**, então o app nunca depende da meia-noite para saber onde uma jornada termina.

**Pilares**

1. **Bater ponto em 1 toque.** A tela Hoje gira em torno de um único botão que muda conforme o estado do dia.
2. **Entender o período num relance.** Horas trabalhadas, intervalos, folgas, feriados, banco de horas e salário estimado do período configurado (ex.: dia 21 a dia 20).
3. **Confiável.** Toda batida pode ser corrigida em poucos toques. Regras impedem dados impossíveis (sobreposição, horário no futuro, etc.).
4. **Premium e rápido.** Design system único, animações com propósito, feedback háptico e metas de performance explícitas.

**Decisões de produto**

| Decisão | Escolha |
|---|---|
| Plataforma | **Somente Android** |
| Dados | **100% no aparelho** (SQLite), com backup/restauração por arquivo |
| Tema | Claro e escuro, **seguindo o sistema** por padrão |
| Período | Dia de início configurável. Padrão: **21 → 20 do mês seguinte**, nomeado pelo mês em que começa ("Setembro 2026 · 21/09 a 20/10") |
| Meta diária | **8h** por padrão, configurável (e por dia da semana) |
| Intervalos | **Nunca** são remunerados; servem só como informação |
| Salário | Modo simples (horas × valor/hora) e modo CLT opcional (extras, adicional noturno, INSS/IRRF) |

---

## Status do projeto

| Fase | Conteúdo | Status |
|---|---|---|
| **0 · Fundação** | Identidade visual e ativos, configuração Android, Expo Router, design system, SQLite + migrações, regras de domínio com testes | ✅ Concluída |
| **1 · MVP** | Onboarding, tela Hoje funcional, histórico, edição de horários, folgas, feriados, resumo, calculadora simples, backup | ⏳ Próxima |
| **2 · Premium** | Animações completas, gráficos, modo CLT, exportação em PDF, ajustes de feriados | ⏳ |
| **3 · Extras** | Meta por dia da semana, bloqueio por biometria, build com EAS | ⏳ |

O que já existe hoje:

- ✅ Navegação com abas nativas (Hoje · Histórico · Resumo · Salário), tema claro/escuro.
- ✅ Tela Hoje em versão visual (anel de progresso, status, período atual). Bater o ponto chega na fase 1.
- ✅ Banco SQLite com esquema completo, migrações versionadas e repositórios.
- ✅ Motor de regras puro (sem React) com **100 testes**: períodos, jornadas, máquina de estados, validações, limites de edição, feriados, saldo, horas noturnas, salário e formatação.
- ✅ Logo, ícone adaptativo/monocromático, splash claro/escuro, favicon e ícone da Play Store gerados por script.

---

## Como o app pensa: conceitos de domínio

| Termo | Significado |
|---|---|
| **Batida** | Um registro de horário: `ENTRADA` ou `SAÍDA`. |
| **Turno** | Par contínuo ENTRADA → SAÍDA (ex.: 08:00 → 11:00). |
| **Intervalo** | Tempo entre a SAÍDA de um turno e a ENTRADA do próximo, **dentro da mesma jornada**. |
| **Jornada** | Conjunto de turnos que vai da batida de **início do dia** até a de **fim do dia**. Pode atravessar a meia-noite. |
| **Data de referência** | Data a que a jornada pertence = **data da batida de início**. Uma jornada 04:00 de 13/10 → 02:00 de 14/10 pertence a 13/10. |
| **Interjornada** | Descanso entre o fim de uma jornada e o início da próxima (CLT: mínimo 11h; o app avisa, não bloqueia). |
| **Folga** | Dia inteiro sem trabalho: `folga`, `férias`, `atestado` ou `feriado`. |
| **Período** | Intervalo de datas usado para os totais. Derivado do dia de início; **nunca armazenado**. |
| **Meta diária / saldo** | Horas esperadas por dia (padrão 8h). Saldo = trabalhado − meta. Em folgas e feriados a meta é 0h. |

### Máquina de estados do dia

```
            [Iniciar dia]                 [Pausar]
  FORA ─────────────────▶ TRABALHANDO ─────────────▶ EM INTERVALO
   ▲                        │    ▲                        │
   │      [Encerrar dia]    │    └──────[Voltar]──────────┘
   └────────────────────────┘                             │
   └──────────────────[Encerrar dia]──────────────────────┘
```

Encerrar o dia **durante o intervalo** não cria batida nova: a última SAÍDA vira o fim do dia. Implementação: [`src/domain/state-machine.ts`](src/domain/state-machine.ts).

---

## Principais regras de negócio

As regras completas (com códigos R1–R12, F1–F6, P1–P5, H1–H7, E1–E5, B1–B8, L1–L8 e ED1–ED11) estão em [`PLANEJAMENTO.md`](PLANEJAMENTO.md). Resumo:

**Batidas**
- Entradas e saídas sempre alternam; batidas em ordem cronológica estrita.
- Sem batidas no futuro (tolerância de 1 min para diferença de relógio).
- Jornadas não se sobrepõem; jornada aberta há mais de 24h gera alerta "esqueceu de encerrar?".
- Toque duplo acidental: debounce + "Desfazer".
- Toque longo no botão principal permite bater com outro horário (retroativo).

**Edição de horários** (ex.: pausou às 15:45, mas foi às 15:43)
- Logo após bater o ponto, um toast oferece **"Ajustar"**. Corrigir leva 3 toques: *Ajustar → −1 −1 → Salvar*.
- Editor com botões **−5 / −1 / +1 / +5 min** (segurar repete), relógio nativo para mudanças grandes e **prévia ao vivo** dos totais.
- **Limites visíveis** ("entre 11:00 e 16:00"): é impossível salvar um horário inválido.
- O horário original é preservado; dá para "Voltar ao original".

**Período**
- Dia de início entre 1 e 31; nos meses curtos, 29–31 viram "último dia do mês".
- A jornada conta no período da sua data de referência, mesmo terminando no período seguinte.
- Mudar o dia de início só muda a visualização: nenhum dado é alterado.

**Feriados nacionais automáticos**
- Calculados localmente, sem internet: 9 fixos + Sexta-feira Santa (via cálculo da Páscoa, algoritmo de Meeus/Butcher).
- Pontos facultativos (Carnaval, Cinzas, Corpus Christi) desligados por padrão.
- Dá para desativar um feriado (em um ano ou em todos) e cadastrar feriados próprios (estaduais/municipais).
- Feriado trabalhado = hora extra de 100% no modo CLT.

**Cálculos**
- Tudo em milissegundos/centavos; arredonda só na exibição.
- Horas noturnas: 22h–5h, com opção de hora noturna reduzida (52min30s).
- Jornada aberta entra nos totais até "agora"; jornada inconsistente fica de fora até ser corrigida.

**Backup**
- Arquivo `.json` versionado com todos os dados, compartilhado pelo menu do Android.
- Restauração com prévia, dupla confirmação, backup automático do estado atual antes, validação completa e transação única (ou entra tudo, ou nada).

---

## Funcionalidades

| Tela | O que faz |
|---|---|
| **Hoje** | Botão principal de estado, cronômetro ao vivo, anel de progresso da meta, linha do tempo do dia, mini-resumo do período |
| **Histórico** | Calendário do período (com cores por estado), lista de jornadas com mini-timeline, seleção múltipla para marcar folgas |
| **Detalhe da jornada** | Timeline editável, adicionar turno esquecido, interjornada antes/depois, observação |
| **Resumo** | Horas trabalhadas, intervalos, dias trabalhados, folgas por tipo, feriados, banco de horas, médias, horas noturnas, comparação com o período anterior, gráficos |
| **Salário** | Valor/hora, recibo detalhado (simples ou CLT), simulador "E se?" |
| **Ajustes** | Período, salário, jornada, feriados, segurança (biometria), aparência, dados (backup/restaurar/exportar PDF/apagar) |
| **Exportar PDF** | Espelho de ponto do período, sempre em tema claro para impressão |

---

## Identidade visual e design system

### Marca

<p>
  <img src="assets/brand/symbol.svg" width="56" alt="Símbolo" />
</p>

**Ideia central: "o ponto que fecha o ciclo".** O símbolo é um anel aberto de 300° que começa às 12h, corre no sentido horário até as 10h e termina num ponto sólido, que representa a batida que fecha o dia. A abertura entre 10h e 12h representa o descanso entre jornadas. **O mesmo desenho é o anel de progresso da tela Hoje**: logo e produto têm a mesma forma.

Wordmark: `bater ponto.` em Inter Bold, minúsculas, com o **ponto final sempre na cor primária**.

### Paleta

| Papel | Nome | Escuro | Claro |
|---|---|---|---|
| Primária / trabalho | Menta | `#3DDC97` | `#0B7F50` |
| Secundária / intervalo | Âmbar | `#F5B544` | `#956200` |
| Base | Tinta | `#0B0D10` | `#F6F7F9` |
| Dinheiro | Ouro | `#E8C872` | `#8A6D1A` |
| Folga · Férias · Atestado · Feriado | Violeta · Céu · Rosa · Coral | `#8B7CF6` `#4FC3F7` `#F28FB1` `#FF9F5A` | `#5B48D9` `#0A6FA0` `#B23A68` `#A84E0C` |
| Alerta · Noturno | | `#FF6B6B` `#5B8DEF` | `#C62F2F` `#2F5DBF` |

- Cada estado do domínio tem **uma cor fixa**, usada igual em anel, timeline, calendário, gráficos e chips.
- **Contraste WCAG AA verificado por teste automático** ([`src/theme/contrast.test.ts`](src/theme/contrast.test.ts)): todo token de texto ≥ 4,5:1 sobre `bg` e `surface`, nos dois temas.
- Cor **nunca** é a única pista: todo estado tem cor + ícone + texto.

### Tipografia

**Inter**, uma única família em 4 pesos (400/500/600/700), **embutida no build** pelo config plugin do `expo-font` (sem carregamento em runtime). Todo número usa algarismos tabulares, para os relógios não "tremerem".

| Token | Tamanho/linha/peso | Uso |
|---|---|---|
| `display` | 56/60/600 | Cronômetro |
| `title1` | 28/34/700 | Título de tela |
| `title2` | 22/28/600 | Números dos cards |
| `headline` | 17/22/600 | Seções, botões |
| `body` | 15/22/400 | Texto |
| `caption` | 13/18/500 | Labels |
| `micro` | 11/14/600 maiúsculas | Overlines |

### Tokens

- **Espaçamento** (grid 4pt): `xs 4 · sm 8 · md 12 · lg 16 · xl 24 · 2xl 32 · 3xl 48`, margem lateral 20.
- **Raio**: `sm 8 · md 14 · lg 20 · xl 28 · full`.
- **Movimento**: molas `snappy` (interação) e `gentle` (cards/sheets); timings 150/250/400ms; respeita "Reduzir movimento".
- **Alvo de toque** mínimo: 48dp.

**Regra de ouro:** telas só usam componentes de `src/components/ui` e tokens de `src/theme`. Nenhuma cor, tamanho ou espaçamento literal fora do tema.

### Metas de performance

| Métrica | Meta |
|---|---|
| Abertura a frio até a tela Hoje | < 1,5s em aparelho intermediário |
| Animações | ≥ 60fps na UI thread (Reanimated) |
| Cronômetro ao vivo | Sem re-render React por segundo |
| Consulta de um período | < 50ms |
| Gráficos e ilustrações | SVG próprio; sem biblioteca de gráficos; sem imagens rasterizadas |

---

## Stack técnica

| Necessidade | Escolha |
|---|---|
| Framework | Expo SDK 57, React Native 0.86, React 19.2, TypeScript (strict) |
| Navegação | `expo-router` (rotas em arquivos, abas nativas Material 3) |
| Persistência | `expo-sqlite` com SQL direto e migrações por `PRAGMA user_version` |
| Estado de UI | `zustand` (o banco é a fonte da verdade) |
| Datas | `date-fns` + locale `pt-BR` |
| Animações e gestos | `react-native-reanimated` 4 + `react-native-gesture-handler` |
| Gráficos e anel | `react-native-svg` |
| Ícones | `expo-symbols` (Material Symbols) |
| Fontes | `expo-font` (Inter embutida) |
| Háptico | `expo-haptics` |
| Splash | `expo-splash-screen` (claro/escuro) |
| IDs | `expo-crypto` (`randomUUID`) |
| Testes | `jest` + `jest-expo` |
| Ativos da marca | `@resvg/resvg-js` (SVG → PNG) |

Previstos para as próximas fases: `@expo/ui` (sheets, pickers, switches nativos), `expo-print` + `expo-sharing` (PDF), `expo-file-system` + `expo-document-picker` (backup), `expo-local-authentication` (biometria).

---

## Arquitetura

```
 Rota (src/app)  →  Tela (src/screens)  →  hooks / stores
                                              │
                                              ▼
                               Repositórios (src/db, SQLite)
                                              │ dados brutos
                                              ▼
                               Domínio puro (src/domain)  →  resultados  →  componentes (src/components/ui)
```

- **`src/domain/`** não importa React nem o banco. Recebe dados simples e devolve resultados. É onde vivem **todas** as regras de negócio, 100% cobertas por testes unitários.
- **`src/db/`** só lê e grava. Toda escrita com mais de uma linha roda em transação.
- **Períodos são derivados**, nunca persistidos: mudar o dia de início não migra nada.
- **Instantes em epoch ms (UTC) + fuso** de cada batida; **datas de calendário** como `YYYY-MM-DD` local.

---

## Estrutura de pastas

```
.
├── assets/
│   ├── brand/                 # SVGs mestres: symbol, wordmark, lockup
│   ├── fonts/                 # Inter 400/500/600/700
│   ├── store/                 # Ícone da Play Store
│   └── *.png                  # Ícone, adaptativo, monocromático, splash, favicon (gerados)
├── scripts/
│   └── generate-brand-assets.mjs
├── src/
│   ├── app/                   # Somente rotas (Expo Router)
│   │   ├── _layout.tsx        # Providers: gestos, SQLite+migrações, tema, splash, fontes
│   │   └── (tabs)/            # Hoje · Histórico · Resumo · Salário (NativeTabs)
│   ├── screens/               # Corpo das telas (rotas só renderizam)
│   ├── components/
│   │   ├── ui/                # Design system: Text, Button, Card, StatusPill, ProgressRing, Screen, List…
│   │   └── brand/             # BrandSymbol, BrandLockup
│   ├── domain/                # Regras puras + testes
│   │   ├── period.ts          # Períodos 21→20, dia 29–31, rótulos
│   │   ├── workday.ts         # Turnos, intervalos, amplitude, jornada aberta
│   │   ├── state-machine.ts   # FORA / TRABALHANDO / EM INTERVALO
│   │   ├── validation.ts      # Regras R1–R5 e limites do editor (ED4)
│   │   ├── holidays.ts        # Páscoa, feriados nacionais, overrides
│   │   ├── balance.ts         # Meta diária e saldo
│   │   ├── night-hours.ts     # Horas entre 22h e 5h
│   │   ├── salary.ts          # Salário simples
│   │   └── time.ts, types.ts
│   ├── db/
│   │   ├── migrations.ts      # Esquema + migrações versionadas
│   │   └── *-repo.ts          # workday, day-off, holiday, settings
│   ├── stores/                # zustand (configurações em memória)
│   ├── theme/                 # palette, colors, typography, metrics, motion, ThemeProvider
│   └── lib/                   # Formatação (duração, hora, data pt-BR, dinheiro)
├── PLANEJAMENTO.md            # Planejamento completo do produto
├── AGENTS.md / CLAUDE.md      # Instruções para agentes de IA
└── app.json                   # Configuração Expo (Android, splash, fontes, ícones)
```

---

## Modelo de dados

| Tabela | Conteúdo |
|---|---|
| `workday` | Jornada: `ref_date`, `status` (`open`/`closed`/`incomplete`), observação |
| `punch` | Batida: `kind` (`in`/`out`), `at` (epoch ms), `tz`, `is_day_start`, `is_day_end`, `original_at` (se editada), `source` (`live`/`retro`/`manual`) |
| `day_off` | Folga por data: `kind` (`folga`/`ferias`/`atestado`/`feriado`), observação |
| `holiday_override` | Só o que o usuário mudou: feriados próprios e feriados nacionais desativados |
| `setting` | Configurações chave/valor em JSON, com padrões no código |

Os feriados nacionais **não ficam no banco**: são calculados. O esquema completo está em [`src/db/migrations.ts`](src/db/migrations.ts).

---

## Como rodar

**Pré-requisitos:** Node.js 20+ e um celular Android com o app **Expo Go**, ou um emulador Android.

```bash
git clone https://github.com/SrDiegoRocha/bater-ponto.git
cd bater-ponto
npm install
npx expo start
```

Escaneie o QR code com o Expo Go (Android) ou pressione `a` para abrir no emulador.

> **Expo Go vs. development build:** tudo da fase 0/1 roda no Expo Go. Biometria e as fontes embutidas nativamente exigem um *development build* (`npx expo run:android` ou `eas build --profile development`). No Expo Go as fontes são carregadas em runtime automaticamente.

As pastas `android/` e `ios/` **não** são versionadas: são geradas pelo Expo (Continuous Native Generation). Configure tudo em `app.json` e config plugins.

---

## Scripts

| Comando | O que faz |
|---|---|
| `npm start` | Inicia o servidor de desenvolvimento |
| `npm run android` | Inicia e abre no Android |
| `npm test` | Roda os testes (Jest) |
| `npm run typecheck` | Verificação de tipos (`tsc --noEmit`) |
| `npm run lint` | Lint (`expo lint`) |
| `npm run brand` | Regera todos os PNGs da marca a partir da geometria do símbolo |
| `npx expo-doctor` | Diagnóstico de dependências e configuração |
| `npx expo install <pacote>` | **Sempre** use para adicionar dependências (versões compatíveis com o SDK) |

---

## Testes

```bash
npm test
```

8 suítes, 100 testes, cobrindo:

- **Jornadas**: os exemplos A e B, jornada aberta até "agora", batidas fora de ordem, sequência inconsistente.
- **Períodos**: 21→20, o dia 21 abrindo o próximo período, virada de ano, dia de início 31 em fevereiro (inclusive bissexto), sem buracos nem sobreposição.
- **Máquina de estados**: todas as transições válidas e as inválidas.
- **Validações**: alternância, ordem, futuro (com tolerância), jornada longa; limites do editor de horário e o caso 15:45 → 15:43.
- **Feriados**: Páscoa de 2000, 2019 e 2024–2035; facultativos; desativação por ano; feriados próprios; período que atravessa o ano.
- **Cálculos**: meta diária e por dia da semana, saldo, horas noturnas (inclusive em várias janelas), salário simples.
- **Formatação**: durações, relógio, dinheiro em R$, datas em pt-BR.
- **Tema**: contraste WCAG AA de todos os tokens de texto nos dois temas.

Os testes rodam com o fuso fixo em `America/Sao_Paulo` ([`jest.global-setup.js`](jest.global-setup.js)), já que regras de meia-noite e horas noturnas dependem do horário local.

---

## Ativos da marca

Todos os PNGs são **gerados** a partir da geometria do símbolo por [`scripts/generate-brand-assets.mjs`](scripts/generate-brand-assets.mjs):

| Arquivo | Uso |
|---|---|
| `assets/icon.png` | Ícone legado (1024, menta sobre Tinta) |
| `assets/android-icon-foreground.png` | Ícone adaptativo (fundo em cor sólida `#0B0D10` via `app.json`) |
| `assets/android-icon-monochrome.png` | Ícone temático do Android 13+ |
| `assets/splash-icon.png` / `splash-icon-dark.png` | Splash claro/escuro |
| `assets/favicon.png` | Favicon 48px com traço reforçado |
| `assets/store/play-store-icon.png` | Ícone 512 da Play Store |

Para mudar algo na marca, edite o script (ou os SVGs em `assets/brand/`) e rode `npm run brand`.

---

## Convenções de código

- Arquivos em **kebab-case**; imports com alias `@/` (→ `src/`).
- `src/app/` contém **apenas rotas**. Componentes, hooks e utilitários ficam fora.
- Regras de negócio **só** em `src/domain/`, sempre com teste ao lado (`*.test.ts`).
- Estilos com `StyleSheet.create` no fim do arquivo do componente; valores sempre vindos de `src/theme`.
- Shared values do Reanimated alterados com `.set()` (compatível com o React Compiler/lint).
- Antes de concluir uma tarefa: `npm run typecheck`, `npm run lint` e `npm test`.
- Expo muda a cada SDK: consulte sempre a documentação **versionada** (`https://docs.expo.dev/versions/v57.0.0/`), não a memória. Veja [`AGENTS.md`](AGENTS.md).

---

## Roadmap

**Fase 1 · MVP (uso diário)**
Onboarding · Tela Hoje funcional (botão de estado, cronômetro, timeline) · Histórico (lista + calendário com feriados) · Detalhe e edição de jornada (editor de horário) · Folgas (4 tipos) · Feriados automáticos · Período e meta diária · Resumo com banco de horas · Calculadora simples · Backup e restauração.

**Fase 2 · Premium**
Animações completas · Gráficos (barras, heatmap) · Indicadores secundários · Comparação entre períodos · Modo CLT (extras 50%/100%, noturno, INSS/IRRF) · Simulador · Exportação em PDF · Ajustes de feriados · Ilustrações dos estados vazios · Animação de abertura (splash → anel).

**Fase 3 · Extras**
Meta por dia da semana · Bloqueio por biometria · Build de produção com EAS.

**Fora do escopo (decidido):** iOS, sincronização em nuvem/login, widget, notificações/lembretes, etiquetas por turno.

---

## Documentação completa

O documento [**`PLANEJAMENTO.md`**](PLANEJAMENTO.md) é a fonte da verdade do produto, com:

- todas as regras de negócio numeradas e os casos-limite;
- o wireframe de cada tela e o editor de horário;
- a tabela completa de animações e hápticos;
- a identidade visual detalhada (construção do logo, regras de uso, tom de voz);
- o checklist de testes e o histórico de decisões (perguntas e respostas).

---

<p align="center"><sub>Feito com cuidado para quem trabalha em horários que não cabem num dia comum.</sub></p>
