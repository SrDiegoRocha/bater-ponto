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

O ponto oficial é batido no app da empresa; o **Bater Ponto** é o caderno de conferência: o usuário anota os mesmos horários aqui e confere se as horas trabalhadas e o salário pago batem.

O **Bater Ponto** é um app para quem tem jornadas **fragmentadas** e que **atravessam a meia-noite**, casos que os apps de ponto tradicionais tratam mal. Exemplos reais de um único dia de trabalho:

```
Exemplo A   08:00 ━━━ 11:00 ┄┄┄ 5h de intervalo ┄┄┄ 16:00 ━━━━━━━ 23:00
            Trabalhado 10h · Intervalo 5h · Amplitude 15h

Exemplo B   04:00 ━━ 09:00 ┄ 8h ┄ 17:00 ━━ 20:00 ┄ 3h ┄ 23:00 ━━ 02:00(+1)
            Trabalhado 11h · Intervalos 11h · Amplitude 22h
```

O usuário marca explicitamente o **início do dia** e o **fim do dia**, então o app nunca depende da meia-noite para saber onde uma jornada termina.

**Pilares**

1. **Anotar o ponto em segundos.** A tela Hoje gira em torno de "Anotar entrada/saída": digita-se o horário mostrado no app da empresa (4 dígitos) ou o dia inteiro de uma vez.
2. **Entender o período num relance.** Horas trabalhadas, intervalos, folgas, feriados, horas extras e salário estimado do período configurado (ex.: dia 21 a dia 20).
3. **Confiável.** Toda batida pode ser corrigida em poucos toques. Regras impedem dados impossíveis (sobreposição, horário no futuro, etc.).
4. **Premium e rápido.** Design system único, animações com propósito, feedback háptico e metas de performance explícitas.

**Decisões de produto**

| Decisão | Escolha |
|---|---|
| Plataforma | **Somente Android** |
| Dados | **100% no aparelho** (SQLite), com backup/restauração por arquivo |
| Tema | Claro e escuro, **seguindo o sistema** por padrão |
| Período | Dia de início configurável. Padrão: **21 → 20 do mês seguinte**, nomeado pelos meses que cobre ("Set–Out 2026 · 21/09 a 20/10") |
| Regras da jornada | **8h por dia e 44h por semana** (CLT), com tolerância de 10 min; configuráveis, com acordo de compensação opcional |
| Intervalos | **Nunca** são remunerados; servem só como informação |
| Salário | Modo simples (horas × valor/hora) e modo CLT opcional (extras, adicional noturno, INSS/IRRF) |

---

## Status do projeto

| Fase | Conteúdo | Status |
|---|---|---|
| **0 · Fundação** | Identidade visual e ativos, configuração Android, Expo Router, design system, SQLite + migrações, regras de domínio com testes | ✅ Concluída |
| **1 · MVP** | Onboarding, tela Hoje funcional, histórico, edição de horários, folgas, feriados, resumo, calculadora simples, backup | ✅ Concluída |
| **2 · Premium** | Animações, gráficos, modo CLT, simulador, exportação em PDF, ajustes de feriados | ✅ Concluída |
| **3 · Extras** | Meta por dia da semana, bloqueio por biometria, build com EAS | ✅ Concluída |

O que já existe hoje:

- ✅ **Onboarding** em 4 passos: período, limites da jornada, valor da hora e opção de restaurar um backup.
- ✅ **Hoje**: "Anotar entrada/saída" com o horário digitado (tipo da batida sugerido pelo estado do dia), "Anotar o dia inteiro", cronômetro, anel até o limite do dia, linha do tempo tocável, toast com **Desfazer**, avisos de jornada incompleta/aberta há muito tempo, folga e feriado do dia, descanso desde a última jornada.
- ✅ **Editor de horário**: −5/−1/+1/+5 min (segurar repete), relógio e calendário nativos, limites visíveis, prévia ao vivo dos totais, voltar ao original, excluir batida.
- ✅ **Histórico**: calendário do período com cores por estado e feriados, seleção múltipla para folgas, lista de jornadas com mini-timeline, cadastro manual de jornada.
- ✅ **Detalhe da jornada**: totais (trabalhado, intervalo, amplitude, noturno), timeline editável, adicionar turno ou batida, interjornada antes/depois, observação, excluir com desfazer.
- ✅ **Facilidades**: previsão de saída no anel, escalas modelo, preencher vários dias de uma vez, mover a jornada inteira ±X min, filtros no histórico, compartilhar resumo em texto, trocar de período deslizando, atalhos no ícone do app e backup automático semanal.
- ✅ **Copiar jornada** para um ou vários dias (mantém os horários, inclusive a madrugada), com atalho "copiar a última jornada" direto no calendário.
- ✅ **Folgas** (folga, férias, atestado, feriado) em um ou vários dias, com proteção para dias que já têm jornada.
- ✅ **Resumo**: cards com números animados e comparação com o período anterior, gráfico de horas por dia (com o limite diário) e por dia da semana, 11 indicadores de detalhe e botão de exportar PDF.
- ✅ **Conferir holerite** (CLT): por período, digita-se o que o holerite pagou (horas extras 50%/100%, adicional noturno, DSR; horas em decimal ou relógio) e o app compara com o calculado pelas batidas, apontando o que faltou pagar. Fica salvo e entra no backup.
- ✅ **Conferir espelho de ponto** (dia a dia): lista os dias do período com as batidas anotadas; cada dia é marcado como "bate" (um toque) ou "diferente", com as horas que o espelho mostra e uma observação. Mostra a diferença total e gera um texto com os dias divergentes para enviar ao RH. Entra no backup (formato v4).
- ✅ **Salário**: modo simples ou **modo CLT** (extras 50%/100%, domingo, adicional noturno com hora reduzida, DSR, INSS e IRRF 2026 com a isenção até R$ 5.000), recibo detalhado e simulador "E se?" com sliders.
- ✅ **Espelho de ponto em PDF**: tabela dia a dia (batidas, +1, horários editados, folgas, feriados, horas extras), totais e salário opcional, compartilhado pelo Android.
- ✅ **Feriados**: ativar/desativar por ano ou para sempre, pontos facultativos e feriados próprios (recorrentes ou não).
- ✅ **Histórico**: deslizar para excluir (com desfazer) e entrada animada da lista.
- ✅ **Ilustrações** dos estados vazios e **imagem de destaque** da Play Store.
- ✅ **Lembretes por notificação** (locais, funcionam no Expo Go): passou do limite do dia sem anotar a saída, intervalo longo sem anotar a volta e fim do dia sem nada anotado (só nos dias da semana em que a pessoa costuma trabalhar, aprendidos pelas últimas 4 semanas, fora folgas e feriados). Tocar no aviso abre "Anotar batida". Ajustes → Lembretes.
- ✅ **Regras da jornada** no lugar da meta diária: hora extra é o que passa de 8h no dia ou 44h na semana (sem contar duas vezes), tolerância de 10 min (art. 58 §1º), acordo de compensação semanal (até 10h/dia) e contrato com limites menores. Atende quem tem escala variável sem pedir meta nenhuma.
- ✅ **Bloqueio por biometria**: digital/rosto ou PIN do Android, ao abrir e ao voltar do segundo plano (tempo configurável), conteúdo oculto nos apps recentes, confirmação extra para restaurar e apagar.
- ✅ **Build com EAS**: perfis de desenvolvimento, preview (APK) e produção (AAB).
- ✅ **Ajustes**: período, regras da jornada, valor da hora, aparência (sistema/claro/escuro), backup, restauração e apagar tudo.
- ✅ **168 testes**: regras puras, cálculos CLT/impostos, PDF e casos de uso rodando contra SQLite real.
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
| **Regras da jornada / horas extras** | Extra = o que passar do limite diário (8h) ou semanal (44h, semana de segunda a domingo), sem contar duas vezes. Tolerância: até 10 min no dia não conta. Com acordo de compensação, o dia pode ir a 10h e só a semana limita. Em feriado, folga e domingo (opcional) tudo é extra 100%. |

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
- Horário anotado é a ocorrência mais recente daquele HH:MM: "23:50" anotado às 00:30 cai no dia anterior.

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
| **Hoje** | Botão principal de estado, cronômetro ao vivo, anel de progresso até o limite do dia, linha do tempo do dia, mini-resumo do período |
| **Histórico** | Calendário do período (com cores por estado), lista de jornadas com mini-timeline, seleção múltipla para marcar folgas |
| **Detalhe da jornada** | Timeline editável, adicionar turno esquecido, interjornada antes/depois, observação |
| **Resumo** | Horas trabalhadas, intervalos, dias trabalhados, folgas por tipo, feriados, horas extras, médias, horas noturnas, comparação com o período anterior, gráficos |
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
| Seletores de data/hora | `@expo/ui` (DateTimePicker nativo do Android) |
| Backup | `expo-file-system` + `expo-sharing` + `expo-document-picker` |
| Atalhos no ícone | `expo-quick-actions` (só em build próprio) |

| PDF | `expo-print` (HTML → PDF) |
| Switch e Slider nativos | `@expo/ui` (Jetpack Compose) |

| Biometria | `expo-local-authentication` + `expo-screen-capture` (oculta nos recentes) |
| Build e distribuição | EAS Build (`eas.json`) + `expo-dev-client` |

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
│   ├── screens/               # Corpo das telas (rotas só renderizam): today/, history, summary, salary,
│   │                          #   workday-detail, punch-editor, punch-entry, day-off-sheet, settings, onboarding…
│   ├── services/              # Casos de uso: bater ponto, editar, desfazer, folgas, backup
│   ├── hooks/                 # useDbQuery (recarrega a cada escrita), useNow, usePeriodStats
│   ├── components/
│   │   ├── ui/                # Design system: Text, Button, Card, StatusPill, ProgressRing, Screen, List,
│   │   │                      #   Banner, StatCard, ChoiceChips, Stepper, MoneyInput, ToastHost…
│   │   ├── time/              # TimeAdjuster (editor ±1/±5) e TimeField (cadastro manual)
│   │   ├── workday/           # Timeline vertical e mini-timeline
│   │   ├── calendar/          # Calendário do período
│   │   ├── period/            # Seletor de período
│   │   ├── charts/            # Gráfico de barras em SVG (toque mostra o valor)
│   │   └── brand/             # BrandSymbol, BrandLockup
│   ├── domain/                # Regras puras + testes
│   │   ├── period.ts          # Períodos 21→20, dia 29–31, rótulos
│   │   ├── workday.ts         # Turnos, intervalos, amplitude, jornada aberta
│   │   ├── state-machine.ts   # FORA / TRABALHANDO / EM INTERVALO
│   │   ├── validation.ts      # Regras R1–R5 e limites do editor (ED4)
│   │   ├── holidays.ts        # Páscoa, feriados nacionais, overrides
│   │   ├── work-rules.ts      # Regras da jornada e classificação das horas extras
│   │   ├── night-hours.ts     # Horas entre 22h e 5h
│   │   ├── salary.ts          # Salário simples
│   │   ├── stats.ts           # Indicadores do período e status de cada dia
│   │   ├── time-of-day.ts     # Horário de relógio → instante (vira +1 após a meia-noite)
│   │   ├── backup-schema.ts   # Formato versionado e validação do backup
│   │   ├── clt.ts             # Salário no modo CLT (extras, noturno, DSR, descontos)
│   │   ├── tax-2026.ts        # Tabelas de INSS e IRRF de 2026 (revisar todo ano)
│   │   └── time.ts, types.ts
│   ├── db/
│   │   ├── migrations.ts      # Esquema + migrações versionadas
│   │   └── *-repo.ts          # workday, day-off, holiday, settings
│   ├── stores/                # zustand: configurações, revisão dos dados, período selecionado, toasts
│   ├── test/                  # Adaptador SQLite em memória para testes
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
| `payslip` | Holerite conferido de um período: `period_start` (chave), `period_end`, `data` (JSON com horas e valores informados) |
| `day_check` | Conferência do espelho de um dia: `date` (chave), `status` (`ok`/`diff`), `company_worked_ms` (horas no espelho), `note` |
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

> **Expo Go vs. build próprio:** quase tudo roda no Expo Go (as fontes são carregadas em runtime e a biometria funciona no Android). A animação de saída da splash e as fontes embutidas só existem num build próprio.

### Builds com EAS

O projeto está ligado ao EAS como `@diegorocha/bater-ponto` (pacote `com.diegorocha.baterponto`).

| Perfil | Para quê | Comando |
|---|---|---|
| `preview` | APK para instalar direto no celular | `npx eas-cli@latest build -p android --profile preview` |
| `development` | Dev client (APK) para desenvolver com recarga rápida | `npx eas-cli@latest build -p android --profile development` |
| `production` | AAB para a Play Store (versionCode automático) | `npx eas-cli@latest build -p android --profile production` |

Ao terminar, o EAS mostra um link/QR code para baixar o APK no celular.

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

19 suítes, 168 testes, cobrindo:

- **Jornadas**: os exemplos A e B, jornada aberta até "agora", batidas fora de ordem, sequência inconsistente.
- **Períodos**: 21→20, o dia 21 abrindo o próximo período, virada de ano, dia de início 31 em fevereiro (inclusive bissexto), sem buracos nem sobreposição.
- **Máquina de estados**: todas as transições válidas e as inválidas.
- **Validações**: alternância, ordem, futuro (com tolerância), jornada longa; limites do editor de horário e o caso 15:45 → 15:43.
- **Feriados**: Páscoa de 2000, 2019 e 2024–2035; facultativos; desativação por ano; feriados próprios; período que atravessa o ano.
- **Cálculos**: regras da jornada (limite diário/semanal, tolerância, compensação, semana parcial no início do período), horas noturnas (inclusive em várias janelas), salário simples.
- **Formatação**: durações, relógio, dinheiro em R$, datas em pt-BR.
- **Tema**: contraste WCAG AA de todos os tokens de texto nos dois temas.
- **Indicadores do período**: totais, folgas por tipo, feriado trabalhado, horas extras, horas noturnas, interjornada, médias de início/fim.
- **INSS e IRRF 2026**: faixas progressivas, teto, isenção até R$ 5.000, redutor parcial, dependentes.
- **Modo CLT**: normais × extras 50% × extras 100% (feriado e domingo), adicional noturno, hora reduzida, DSR e simulador.
- **PDF**: batidas, +1, horários editados, folgas, feriados, escape de HTML e um dia por linha.
- **Backup**: ida e volta do arquivo, arquivos corrompidos, de outro app, de versão mais nova e com referências quebradas.
- **Casos de uso com banco real** ([`src/services/punch-service.test.ts`](src/services/punch-service.test.ts)): o exemplo B batido ao vivo, encerrar no intervalo, horários inválidos, desfazer, edição 15:45 → 15:43 com voltar ao original, limites entre jornadas, troca de data de referência, jornada incompleta e correção, jornada manual que passa da meia-noite, folga sobre jornada (com desfazer) e exportar/importar backup.

Os testes de banco usam um adaptador ([`src/test/memory-db.ts`](src/test/memory-db.ts)) que implementa a API do `expo-sqlite` sobre o `node:sqlite`, com o mesmo esquema e as mesmas migrações do app.

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
| `assets/store/feature-graphic.png` | Imagem de destaque 1024×500 da Play Store (texto em Inter) |

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

**Fase 1 · MVP (uso diário)** ✅
Onboarding · Tela Hoje funcional (botão de estado, cronômetro, timeline) · Histórico (lista + calendário com feriados) · Detalhe e edição de jornada (editor de horário) · Folgas (4 tipos) · Feriados automáticos · Período e meta diária · Resumo com banco de horas · Calculadora simples · Backup e restauração.

**Fase 2 · Premium** ✅
Animações completas · Gráficos (barras, heatmap) · Indicadores secundários · Comparação entre períodos · Modo CLT (extras 50%/100%, noturno, INSS/IRRF) · Simulador · Exportação em PDF · Ajustes de feriados · Ilustrações dos estados vazios · Animação de abertura (splash → anel).

**Fase 3 · Extras** ✅
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
