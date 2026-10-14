# Bater Ponto: Planejamento do Aplicativo

> Documento vivo. Tudo aqui está **antes do código**. Todas as perguntas da seção 13 já foram respondidas.
>
> **Revisão 2 (14/10/2026):** foco só em Android · tema claro/escuro seguindo o sistema · meta diária de 8h configurável · período nomeado pelo mês em que começa · sem widget · entram feriados nacionais automáticos (3.7), exportação em PDF (3.8) e backup/restauração (3.9).
>
> **Revisão 3 (14/10/2026):** entra o bloqueio por biometria (3.10). Lembretes por notificação e etiquetas por turno ficam fora.
>
> **Revisão 5 (14/10/2026):** edição de horários simples e completa: regras em 3.11, editor em 5.11 (ajuste fino ±1/±5 min, prévia ao vivo, limites visíveis, atalho "Ajustar" logo após bater o ponto).
>
> **Revisão 4 (14/10/2026):** a seção 6 vira **Identidade visual e design system**: conceito da marca, logo, paleta (primária Menta, secundária Âmbar, neutra Tinta, Ouro para dinheiro), tipografia Inter, ícone, splash, favicon, tom de voz, diretrizes de usabilidade e orçamento de performance.

---

## 1. Visão geral

Aplicativo pessoal, **offline-first**, para registrar e analisar a jornada de trabalho. Ele precisa lidar bem com jornadas fragmentadas, que podem passar da meia-noite.

**Pilares**
1. **Bater ponto em 1 toque.** A tela inicial gira em torno de um único botão que muda conforme o estado do dia.
2. **Entender o período num relance.** Horas trabalhadas, intervalos, folgas e salário estimado do período que você configurou.
3. **Confiável.** Toda batida pode ser corrigida. Nada se perde. As regras impedem dados impossíveis, como sobreposição de horários.
4. **Premium e fluido.** Um design system único, animações com propósito e feedback háptico.

**Plataforma-alvo**: **somente Android**. O código continua em React Native/Expo (iOS fica possível no futuro), mas o design, os testes e os componentes nativos miram o Android: Material/Jetpack Compose, botão voltar, edge-to-edge e tela de 120Hz.

**Stack** (Expo SDK 57 / React Native 0.86, já no projeto)

| Necessidade | Escolha | Motivo |
|---|---|---|
| Navegação | `expo-router` (rotas em `src/app/`) | Padrão do projeto (AGENTS.md) |
| Persistência local | `expo-sqlite` (SQL direto, migrações por `PRAGMA user_version`) | Sem ORM: menos peso no bundle, só 5 tabelas simples |
| Estado de UI | `zustand` | Leve; o estado de domínio fica no SQLite |
| Datas | `date-fns` + locale `pt-BR` | Funções puras, tree-shakeable |
| Animações | `react-native-reanimated` + `react-native-gesture-handler` | Rodam na UI thread, 60/120fps |
| Háptico | `expo-haptics` | Feedback físico nas batidas |
| Gráficos e anéis | `react-native-svg` | Anel de progresso, barras e heatmap feitos à mão (mais controle visual) |
| Controles nativos | `@expo/ui` (DateTimePicker, BottomSheet, Switch, Picker) | Jetpack Compose real no Android |
| Fontes | `expo-font` (Inter, ou a fonte do sistema com `tabular-nums`) | Números alinhados nos relógios |
| Biometria | `expo-local-authentication` | Trava opcional do app (3.10). Exige development build (não roda 100% no Expo Go) |
| Exportação PDF | `expo-print` (HTML → PDF) + `expo-sharing` | Espelho de ponto do período (3.8) |
| Backup | `expo-file-system` + `expo-sharing` + `expo-document-picker` | Exportar/importar arquivo `.json` (3.9) |
| Feriados | Cálculo local (sem API) | Fixos + móveis via cálculo da Páscoa, funciona offline (3.7) |
| Testes | `jest-expo` | Testes do motor de cálculo |

> Todas as libs entram com `npx expo install` (o projeto usa npm). Antes de implementar, as APIs serão conferidas na doc v57.

---

## 2. Conceitos de domínio (glossário)

| Termo | Significado |
|---|---|
| **Batida** | Um registro de horário (timestamp). Tipo: `ENTRADA` ou `SAIDA`. |
| **Turno** | Par ENTRADA → SAÍDA contínuo. Ex.: 08:00 → 11:00. |
| **Intervalo** | Tempo entre a SAÍDA de um turno e a ENTRADA do próximo **dentro da mesma jornada**. Ex.: 11:00 → 16:00 = 5h. |
| **Jornada (dia de trabalho)** | Conjunto de turnos que vai da batida marcada como **Início do dia** até a batida marcada como **Fim do dia**. Pode atravessar a meia-noite. |
| **Data de referência** | A data a que a jornada pertence = **data da batida de início**. Na jornada que começa às 04:00 de 13/10 e termina às 02:00 de 14/10, a data de referência é 13/10. |
| **Interjornada** | Descanso entre o fim de uma jornada e o início da próxima. (A CLT exige no mínimo 11h. O app avisa, mas não bloqueia.) |
| **Folga** | Dia inteiro marcado como não trabalhado. Tipos: **folga**, **férias**, **atestado**, **feriado**. |
| **Feriado nacional** | Data gerada automaticamente pelo app (3.7). Não precisa de cadastro. |
| **Meta diária** | Horas esperadas por dia trabalhado. Padrão **8h**, configurável (e opcionalmente por dia da semana). Base para hora extra e banco de horas. |
| **Período (competência)** | Intervalo de datas usado para os totais. O dia de início é configurável (padrão: dia 21). |

### Exemplos que você deu, modelados

**Exemplo A**, jornada de 13/10:
```
08:00 ●━━━━━━━━ 11:00 ○ ┄┄┄┄ intervalo 5h ┄┄┄┄ ● 16:00 ━━━━━━━━━━━━━━ 23:00 ■
início do dia                                                       fim do dia
Trabalhado: 3h + 7h = 10h  |  Intervalo: 5h  |  Amplitude: 15h (08→23)
```

**Exemplo B**, jornada de 13/10, que termina em 14/10:
```
04:00 ●━━ 09:00 ┄ 8h ┄ 17:00 ━━ 20:00 ┄ 3h ┄ 23:00 ━━ 02:00(+1) ■
Trabalhado: 5h + 3h + 3h = 11h  |  Intervalos: 8h + 3h = 11h  |  Amplitude: 22h
```

---

## 3. Regras de negócio

### 3.1 Máquina de estados do dia (coração do app)

```
            [Iniciar dia]                 [Pausar]
  FORA ─────────────────▶ TRABALHANDO ─────────────▶ EM INTERVALO
   ▲                        │    ▲                        │
   │      [Encerrar dia]    │    └──────[Voltar]──────────┘
   └────────────────────────┘                             │
   └──────────────────[Encerrar dia]──────────────────────┘
```

- **FORA**: nenhuma jornada aberta. Botão principal: **"Iniciar dia"**. Ação secundária: "Marcar folga hoje".
- **TRABALHANDO**: botão principal **"Pausar"** (gera SAÍDA). Ação secundária: **"Encerrar dia"** (gera SAÍDA marcada como fim do dia).
- **EM INTERVALO**: botão principal **"Voltar ao trabalho"** (gera ENTRADA). Ação secundária: **"Encerrar dia"**, que transforma a última SAÍDA em fim do dia sem criar batida nova.
- Assim o "início do dia" e o "fim do dia" ficam **explícitos**, como você descreveu, e nunca dependem da meia-noite.

### 3.2 Regras das batidas

| # | Regra | Comportamento |
|---|---|---|
| R1 | Entradas e saídas sempre alternam dentro da jornada | Impossível criar duas ENTRADAS seguidas |
| R2 | Batidas em ordem cronológica estrita | Na edição manual, horário fora de ordem → erro inline |
| R3 | Sem batidas no futuro | Bloqueado (tolerância de 1 min por diferença de relógio) |
| R4 | Jornadas não se sobrepõem | Uma batida não pode cair dentro de outra jornada |
| R5 | Duração máxima de jornada: 24h (configurável) | Passou disso aberta → alerta "Esqueceu de encerrar?" |
| R6 | Turno com menos de 1 min | Pede confirmação (provável toque duplo) |
| R7 | Toque duplo acidental | Debounce de 3s no botão principal, com "Desfazer" no toast por 5s |
| R8 | Batida retroativa | Toque longo no botão abre um seletor de horário ("Bati às…") |
| R9 | Edição | Toda batida editável, de forma simples (ver **3.11**). Guarda o horário original (`original_at`) e marca como **editada** (ícone discreto) |
| R10 | Exclusão | Excluir uma batida no meio da jornada reorganiza os pares. Se ficar inconsistente, a jornada vira "incompleta" e é sinalizada |
| R11 | Jornada inteira manual | Dá para cadastrar um dia passado do zero (ex.: esqueceu o celular) |
| R12 | Fuso horário | Salva em UTC + o fuso do dispositivo. Exibe no fuso local (o Brasil não tem horário de verão desde 2019, mas fica protegido) |

### 3.3 Regras de folga

| # | Regra |
|---|---|
| F1 | Folga é por **data de calendário**, dia inteiro |
| F2 | Não dá para marcar folga numa data que já é data de referência de uma jornada → oferece "excluir jornada e marcar folga?" |
| F3 | Uma jornada que **termina** numa data (ex.: 02:00) **não** impede folga nesse dia. Só a data de início conta |
| F4 | Dá para marcar várias datas de uma vez (seleção em intervalo no calendário), ex.: férias |
| F5 | Folga pode ter observação (texto livre) |
| F6 | Dias sem jornada e sem folga aparecem como **"Sem registro"** (neutro), nunca como falta automática |

### 3.4 Regras de período (competência)

| # | Regra |
|---|---|
| P1 | `dia_inicio` configurável (1 a 28; dias 29 a 31 viram "último dia do mês" para não quebrar em fevereiro) |
| P2 | Período = de `dia_inicio` do mês M até **`dia_inicio - 1`** do mês M+1, inclusive (ex.: 21/09 a 20/10). O dia 21/10 já abre o próximo período |
| P3 | A jornada entra no período da sua **data de referência**, mesmo que termine no período seguinte |
| P4 | Mudar o dia de início recalcula a visualização. Não altera nenhum dado salvo (períodos são derivados, não armazenados) |
| P5 | Nome do período = **mês em que ele começa** (ex.: "Setembro 2026 · 21/09 a 20/10") |
| P6 | Período em andamento mostra projeções ("no ritmo atual: ~X h") |

### 3.5 Regras de cálculo

- **Horas trabalhadas** = soma dos turnos (SAÍDA − ENTRADA).
- **Horas de intervalo** = soma dos gaps entre turnos de uma mesma jornada. **Intervalo nunca é remunerado**, seja qual for a duração da pausa. Ele aparece só como informação.
- **Saldo do dia** = trabalhado − meta diária (padrão 8h). Positivo = extra / crédito no banco de horas. Negativo = débito.
- **Meta em dias não úteis**: em folga, férias, atestado e feriado a meta é **0h**, e qualquer hora trabalhada nesses dias vira saldo positivo.
- **Amplitude** = fim do dia − início do dia.
- **Interjornada** = início da jornada N − fim da jornada N−1. Alerta abaixo de 11h.
- Jornada **aberta** (em andamento) entra nos totais com o tempo até "agora", sinalizada como parcial.
- Jornada **incompleta** (sem fim) fica fora dos totais até ser corrigida, com um banner pedindo correção.
- Arredondamento: cálculos em **segundos**, exibição em `HH:MM`. Valores em dinheiro com 2 casas, arredondando só no final.

### 3.6 Calculadora de salário

**Entrada**: valor da hora (R$), salvo nas configurações e editável na hora.

**Modo simples (padrão)**: `salário bruto = horas trabalhadas × valor/hora`

**Modo CLT (opcional, ligado nas configurações, fase 2)**:
| Item | Regra |
|---|---|
| Jornada contratual | Usa a **meta diária** (padrão 8h, configurável; pode variar por dia da semana, ex.: sábado 4h). O que passar disso no dia é hora extra |
| Hora extra | +50% (padrão, editável); +100% em domingos/feriados |
| Adicional noturno | 22:00 a 05:00, +20% (editável). Opção de **hora noturna reduzida** (52min30s = 1h). Muito relevante para os seus turnos de 23h a 2h e 4h a 5h |
| DSR sobre extras | Opcional |
| Descontos estimados | INSS e IRRF pelas tabelas vigentes → salário **líquido estimado** (com aviso "estimativa") |

**Simulador "E se?"**: mexer em um slider de horas ou de valor/hora e ver o salário mudar ao vivo (número animado).

### 3.7 Feriados nacionais automáticos

**Como são gerados**: calculados no próprio app para qualquer ano (sem internet, sem API).

| Tipo | Datas |
|---|---|
| **Fixos (lei federal)** | 01/01 Confraternização · 21/04 Tiradentes · 01/05 Dia do Trabalho · 07/09 Independência · 12/10 N. Sra. Aparecida · 02/11 Finados · 15/11 Proclamação da República · 20/11 Consciência Negra · 25/12 Natal |
| **Móveis (pela Páscoa)** | Sexta-feira Santa (Páscoa − 2 dias) |
| **Pontos facultativos (desligados por padrão)** | Carnaval segunda e terça (Páscoa − 48/−47) · Quarta de Cinzas · Corpus Christi (Páscoa + 60) |

A Páscoa é calculada pelo algoritmo de Meeus/Butcher (gregoriano), com testes para vários anos.

| # | Regra |
|---|---|
| H1 | Feriados aparecem no calendário com cor e ícone próprios, mesmo sem nenhuma ação sua |
| H2 | Feriado **não trabalhado** conta como dia de feriado (não como "sem registro") e a meta do dia é 0h |
| H3 | Feriado **trabalhado**: a jornada é normal, mas marcada com selo "Feriado". No modo CLT, as horas são hora extra de **100%** |
| H4 | Nos Ajustes → Feriados você pode **desativar** um feriado específico (ex.: sua empresa não folga em 12/10) ou ligar os pontos facultativos |
| H5 | Você pode **adicionar feriados próprios** (estaduais/municipais, ex.: 20/01 São Sebastião no RJ), com opção "repetir todo ano" |
| H6 | Marcar uma folga manual num feriado: a folga manual prevalece na exibição (evita duplicar) |
| H7 | Contadores no Resumo: "feriados no período" separado de "folgas" |

### 3.8 Exportação em PDF (espelho de ponto)

Gerado no próprio aparelho (HTML → PDF com `expo-print`) e compartilhado pelo menu do Android (WhatsApp, e-mail, Drive…).

**Conteúdo do PDF de um período:**
1. Cabeçalho: nome (opcional, configurado em Ajustes), período "Setembro 2026 · 21/09 a 20/10" e data de geração.
2. Tabela dia a dia: data, dia da semana, batidas (E1 S1 E2 S2 E3 S3…), trabalhado, intervalo, saldo do dia, observação. Folgas, férias, atestados e feriados aparecem como linha com o tipo. Batidas editadas levam um asterisco.
3. Totais: horas trabalhadas, intervalos, dias trabalhados, folgas por tipo, feriados, horas noturnas, saldo/banco de horas.
4. Bloco de salário (opcional, toggle na hora de exportar): valor/hora, bruto e, no modo CLT, o recibo completo.
5. Rodapé: "Gerado pelo app Bater Ponto. Valores estimados."

| # | Regra |
|---|---|
| E1 | Exporta um período inteiro (padrão = período selecionado) ou um intervalo de datas personalizado |
| E2 | Jornadas com mais de 3 turnos quebram a linha sem estourar a tabela (layout A4 retrato, fonte tabular) |
| E3 | Jornada aberta ou incompleta → aviso antes de exportar ("há 1 dia incompleto, exportar mesmo assim?") |
| E4 | O PDF sai sempre em tema **claro** (para impressão), independentemente do tema do app |
| E5 | Nome do arquivo: `ponto_2026-09-21_a_2026-10-20.pdf` |

### 3.9 Backup e restauração

**Formato**: um arquivo `.json` com tudo (jornadas, batidas, folgas, feriados personalizados, configurações), mais `schemaVersion`, `appVersion` e data de criação.

| # | Regra |
|---|---|
| B1 | **Fazer backup**: gera o arquivo e abre o compartilhamento do Android (salvar no Google Drive, enviar para si mesmo, etc.). Nome: `bater-ponto-backup_2026-10-14.json` |
| B2 | **Restaurar**: escolhe o arquivo (`expo-document-picker`), mostra uma prévia ("142 jornadas, 23 folgas, de 21/03/2026 a 14/10/2026") e pede confirmação |
| B3 | Restauração **substitui** todos os dados atuais, depois de dupla confirmação. Antes de substituir, o app gera automaticamente um backup do estado atual (rede de segurança) |
| B4 | Validação completa antes de gravar (estrutura, tipos, regras R1–R4). Arquivo inválido ou corrompido → nada é alterado e aparece uma mensagem clara |
| B5 | Restauração dentro de **uma transação SQLite**: ou entra tudo, ou nada |
| B6 | `schemaVersion` antigo → o app migra o arquivo. Mais novo que o app → pede para atualizar o app |
| B7 | Ajustes mostra "Último backup: há 12 dias" e, se passar de 30 dias, um lembrete discreto na tela Hoje (dispensável) |
| B8 | O Auto Backup nativo do Android (`allowBackup`) fica ativo como camada extra ao trocar de celular, configurado via `app.json` |

### 3.10 Bloqueio por biometria

Usa `expo-local-authentication` (digital ou rosto, conforme o aparelho), com fallback para o PIN/padrão de tela do próprio Android.

| # | Regra |
|---|---|
| L1 | **Desligado por padrão.** Liga em Ajustes → Segurança. Para ligar, o app pede uma autenticação de teste (evita trancar o usuário fora) |
| L2 | Se o aparelho não tem biometria nem bloqueio de tela, o switch fica desabilitado, com a explicação "Configure um bloqueio de tela no Android" |
| L3 | Pede autenticação ao **abrir** o app e ao **voltar do segundo plano** depois de um tempo configurável: imediatamente · 1 min (padrão) · 5 min · 15 min |
| L4 | Enquanto bloqueado, uma tela de bloqueio (logo + botão "Desbloquear") cobre o conteúdo. O app também esconde o conteúdo na tela de apps recentes |
| L5 | Cancelou ou falhou → continua bloqueado, com botão para tentar de novo. Sem limite próprio de tentativas (o Android já controla) |
| L6 | Se a biometria for removida do aparelho depois de ativada → cai no PIN/padrão do sistema. Se não houver nenhum bloqueio, o app desliga a trava sozinho e avisa |
| L7 | A configuração da trava **não** vai no backup (é do aparelho, não dos dados) |
| L8 | Ações sensíveis (restaurar backup, apagar tudo) pedem autenticação de novo quando a trava está ligada |

### 3.11 Edição de horários (tudo editável, simples de mexer)

**Princípio**: errar o horário é normal (ex.: pausou às 15:45, mas foi às 15:43). Corrigir tem que ser **tão fácil quanto bater o ponto**: no máximo 3 toques, sem formulário complicado.

**O que dá para editar**

| Item | Como |
|---|---|
| Horário de qualquer batida (entrada, pausa, volta, início e fim do dia) | Editor de horário (5.11) |
| Data de uma batida (ex.: fim do dia às 00:10 do dia seguinte) | Chip de data dentro do editor |
| Adicionar turno esquecido (ex.: esqueceu de bater a volta) | "+ Adicionar turno" no detalhe da jornada |
| Excluir batida ou jornada | Botão no editor / no detalhe, com "Desfazer" |
| Marcar outra batida como início/fim do dia | Menu ⋯ da batida no detalhe da jornada |
| Folga (tipo, observação, remover) | Tocar no dia no calendário |
| Feriados próprios, configurações, valor/hora | Nas respectivas telas de Ajustes |

**Por onde chegar no editor** (sempre o mesmo editor, em qualquer lugar):
1. **Logo depois de bater o ponto**: o toast mostra "Pausado às 15:45 · **Ajustar** · Desfazer" por 5s. Um toque em "Ajustar" abre o editor já nessa batida. É o caminho mais rápido para o seu exemplo.
2. **Tocando na batida** na linha do tempo da tela Hoje.
3. **Tocando na batida** no detalhe da jornada (Histórico → dia).
4. **Toque longo no botão principal** para bater com outro horário (R8), que usa o mesmo editor antes de salvar.

| # | Regra |
|---|---|
| ED1 | **Ajuste fino com botões −5 / −1 / +1 / +5 min**: a maioria das correções é de poucos minutos. Segurar o botão repete, acelerando |
| ED2 | **Tocar no horário grande** abre o seletor de horário nativo do Android (relógio/teclado) para mudanças maiores |
| ED3 | **Prévia ao vivo** antes de salvar: "15:45 → 15:43 · trabalhado 3h45 → 3h43 · intervalo 5h00 → 5h02". Nada muda até tocar em **Salvar** |
| ED4 | **Limites visíveis**: o editor mostra "pode ficar entre 11:00 e 16:00" (batidas vizinhas e "agora"). Os botões que passariam do limite ficam desabilitados, então é impossível salvar um horário inválido |
| ED5 | Precisão de **minuto**. Batidas ao vivo guardam os segundos (para totais exatos). Ao editar, os segundos viram 00 |
| ED6 | Após salvar: toast "Horário alterado · **Desfazer**" (5s). Todos os totais (dia, período, salário, cronômetro) se atualizam na hora |
| ED7 | Batida editada ganha um ícone discreto ✎. Tocar nele mostra "Original: 15:45" e oferece **"Voltar ao original"** |
| ED8 | Mudar o horário de **início do dia** para outra data muda a data de referência da jornada → aviso: "Esta jornada passará para segunda, 13/10" |
| ED9 | Editar uma batida da jornada **em andamento** é permitido. O cronômetro e o anel se recalculam na hora |
| ED10 | Sair sem salvar (voltar ou arrastar o sheet para baixo) descarta, sem perguntar se nada mudou. Se mudou, pergunta "Descartar alteração?" |
| ED11 | Tudo vale para jornadas antigas também. Não há "período fechado" que trave edição |

---

## 4. Indicadores do período (tela Resumo)

**Principais (cards grandes)**
1. Horas trabalhadas
2. Horas de intervalo
3. Dias trabalhados
4. Dias de folga
5. Salário estimado

**Secundários (lista e gráficos)**
- Média de horas por dia trabalhado
- Maior e menor jornada (com data, tocável)
- Horário médio de início e de fim do dia
- Média de intervalo por dia
- Menor interjornada + quantidade de interjornadas abaixo de 11h
- Horas noturnas (22h a 5h)
- Dias sem registro (para você conferir esquecimentos)
- Comparação com o período anterior (▲ +6h / ▼ −2h)
- **Banco de horas** do período: soma dos saldos diários em relação à meta (padrão 8h), +/−
- Feriados no período (trabalhados × não trabalhados)
- Folgas por tipo (folga / férias / atestado)
- Gráfico de barras: horas por dia do período
- Heatmap estilo "GitHub" do período: intensidade = horas trabalhadas; folgas em outra cor
- Distribuição por dia da semana (em quais dias você mais trabalha)

---

## 5. Telas e navegação

```
src/app/
├── _layout.tsx                 → Stack raiz (providers: DB, tema, gestos)
├── onboarding.tsx              → 1ª execução (3 passos)
├── (tabs)/
│   ├── _layout.tsx             → NativeTabs: Hoje · Histórico · Resumo · Salário
│   ├── index.tsx               → HOJE
│   ├── historico.tsx           → HISTÓRICO (calendário + lista)
│   ├── resumo.tsx              → RESUMO do período
│   └── salario.tsx             → CALCULADORA
├── jornada/[id].tsx            → Detalhe/edição de uma jornada
├── jornada/nova.tsx            → (modal) Cadastrar jornada manual
├── batida/[id].tsx             → (form sheet) Editor de horário (5.11)
├── folga/nova.tsx              → (form sheet) Marcar folga(s)
├── periodo.tsx                 → (form sheet) Escolher período
└── ajustes/
    ├── index.tsx               → Ajustes (ícone na header)
    ├── periodo.tsx             → Dia de início do período
    ├── salario.tsx             → Valor/hora, modo CLT, adicionais
    ├── jornada.tsx             → Meta diária (8h, por dia da semana), interjornada, duração máxima
    ├── feriados.tsx            → Lista do ano, desativar, facultativos, feriados próprios
    ├── seguranca.tsx           → Bloqueio por biometria
    ├── aparencia.tsx           → Tema: Sistema (padrão) · Claro · Escuro
    └── dados.tsx               → Backup, restaurar, exportar PDF, apagar tudo
exportar.tsx                    → (form sheet) Opções do PDF (período, incluir salário)
```

### 5.1 Onboarding (4 passos, pulável)
1. Boas-vindas: "Bata o ponto em um toque." Ilustração animada do botão.
2. Período: "Seu mês começa no dia…" (wheel picker, padrão 21), com prévia ao vivo: "Setembro · 21/09 a 20/10".
3. Jornada e valor: meta diária (padrão 8h) e valor da hora (opcional, teclado numérico com máscara R$).
4. "Já tem um backup?" → link para restaurar (útil ao trocar de celular).

### 5.2 HOJE
```
┌─────────────────────────────────┐
│ Terça, 14 out          ⚙️       │
│ Período: 21/09 a 20/10 · 23 dias│
│                                 │
│        ╭───────────────╮        │
│       ╱   ◜ anel ◝      ╲       │  ← anel = progresso vs meta diária
│      │    05:42:17      │       │  ← cronômetro ao vivo (trabalhado hoje)
│      │   TRABALHANDO    │       │
│       ╲                ╱        │
│        ╰───────────────╯        │
│                                 │
│   [  ⏸  Pausar  ]  (principal)  │
│     Encerrar dia  (secundário)  │
│                                 │
│ ─ Linha do tempo de hoje ─────  │
│ ● 04:00 Início do dia           │
│ │ 5h00 trabalhando              │
│ ○ 09:00 Pausa                   │
│ ┊ 8h00 intervalo                │
│ ● 17:00 Voltou                  │
│ │ 0h42 ... (ao vivo)            │
│                                 │
│ ┌ Período ────────────────────┐ │
│ │ 142h trab · 9 folgas · R$…  │ │  ← mini-resumo, toca → Resumo
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```
- Estado FORA: anel vazio, mostra a "Última jornada: ontem 04:00 → 02:00 · 11h" e o descanso desde o fim ("Descansando há 6h12").
- Se hoje é folga: card "Hoje é folga 🌴" com a opção "Trabalhar mesmo assim" (remove a folga).
- Se hoje é feriado: chip "Feriado · Proclamação da República" acima do anel. O botão continua disponível, e trabalhar no feriado gera o selo (H3).
- Banner de alerta no topo se houver jornada incompleta ou aberta há mais de 16h.
- Cada batida da linha do tempo é tocável → editor de horário (5.11). Logo após bater o ponto, o toast oferece "Ajustar".

### 5.3 HISTÓRICO
- Topo: seletor de período (chip "21/09 a 20/10 ▾" → sheet com a lista de períodos). Swipe horizontal troca de período.
- **Calendário do período** (não do mês civil): cada dia com um ponto ou preenchimento por estado (trabalhado / folga / férias / atestado / feriado / sem registro / hoje / incompleto). Tocar num feriado mostra o nome dele.
- Abaixo, **lista de jornadas** (mais recente primeiro): data, faixa "04:00 → 02:00 +1", total trabalhado, total de intervalo e uma **mini-barra de timeline** de 24h+ mostrando os turnos visualmente.
- Swipe na linha: editar / excluir (com desfazer).
- Seleção múltipla no calendário (toque longo + arrastar) → "Marcar como folga".
- FAB "+": nova jornada manual ou folga.

### 5.4 DETALHE DA JORNADA
- Cabeçalho: data de referência + totais (trabalhado, intervalo, amplitude, horas noturnas).
- **Timeline vertical** editável: cada batida é uma linha com área de toque grande. Tocar abre o **editor de horário** (5.11). Menu ⋯ na batida: marcar como início/fim do dia, excluir. "+ Adicionar turno" entre batidas e no fim.
- Interjornada antes e depois (com alerta se < 11h).
- Campo de observação.
- Excluir jornada (confirmação).

### 5.5 RESUMO
- Seletor de período (o mesmo componente do Histórico).
- Grid 2×2 de cards principais com números animados.
- Card de salário em destaque → leva à calculadora.
- Gráfico de barras por dia, heatmap e lista de indicadores secundários (seção 4).
- Botão **"Exportar PDF"** no header → form sheet de opções → gera e abre o compartilhamento (3.8).

### 5.6 SALÁRIO (calculadora)
- Valor/hora em destaque (editável inline).
- Horas do período (puxadas automaticamente, mas editáveis para simulação).
- Breakdown em "recibo": horas normais, extras 50%, extras 100%, adicional noturno, DSR, **bruto**, INSS, IRRF, **líquido estimado**.
- Toggle "Simular" → sliders de horas extras / valor-hora. Os valores animam ao vivo.
- Rodapé: "Estimativa. Confira com seu holerite."

### 5.7 AJUSTES
Lista agrupada nativa (`@expo/ui` List): Período · Salário · Jornada (meta diária, mínimo de interjornada, máximo de jornada) · Feriados · Segurança · Aparência · Dados (backup/restaurar/exportar PDF/apagar) · Sobre.

### 5.8 FERIADOS (Ajustes)
- Seletor de ano no topo.
- Lista: data, nome e tipo (nacional / facultativo / próprio), com um switch por item para ativar ou desativar.
- Seção "Pontos facultativos" com um switch geral.
- Botão "+ Adicionar feriado próprio" → form sheet (nome, data, repetir todo ano).

### 5.9 DADOS (Ajustes)
- Card "Último backup: há 12 dias" com o botão **Fazer backup agora**.
- **Restaurar backup** → seletor de arquivo → prévia → dupla confirmação (3.9).
- **Exportar PDF** → mesmo form sheet do Resumo.
- **Apagar todos os dados** (vermelho, dupla confirmação, oferece backup antes).

### 5.10 SEGURANÇA (Ajustes) e tela de bloqueio
- Switch "Bloquear com biometria" + seletor "Pedir de novo após" (imediatamente / 1 / 5 / 15 min). Ver 3.10.
- **Tela de bloqueio**: fundo `bg`, logo do app no centro com um leve "respirar" (escala 1 → 1.03), botão "Desbloquear". Ao autenticar, o conteúdo surge com fade + escala 0.98 → 1 e háptico `notificationSuccess`.

### 5.11 EDITOR DE HORÁRIO (form sheet)
```
┌─────────────────────────────────┐
│            ───                  │  ← alça do sheet
│  Pausa                     🗑   │
│  ter, 14 out ▾                  │  ← chip de data (ED8)
│                                 │
│            15:43                │  ← display 56, toque → relógio nativo
│        original 15:45 ↺         │  ← só aparece se mudou
│                                 │
│   [ −5 ] [ −1 ]   [ +1 ] [ +5 ] │  ← ajuste fino, segurar repete
│                                 │
│   entre 11:00 e 16:00           │  ← limites (ED4)
│                                 │
│  Trabalhado  3h45 → 3h43        │  ← prévia ao vivo (ED3)
│  Intervalo   5h00 → 5h02        │
│                                 │
│  [          Salvar          ]   │
└─────────────────────────────────┘
```
- Abre em meia altura, com o polegar perto dos botões. Teclado nunca aparece (só botões e o relógio nativo).
- Botões de ajuste com 56dp de altura, bem espaçados, para não errar o toque.
- Funciona igual para uma batida nova (retroativa, R8) e para editar uma existente: um só componente.

---

## 6. Identidade visual e design system

> Todas as decisões de marca e design são minhas, com dois critérios acima de tudo: **usabilidade** (dá para entender e usar com uma mão, cansado, no fim de um turno) e **performance** (nada de visual que custe frames ou tempo de abertura).

### 6.1 Conceito da marca

| Item | Decisão |
|---|---|
| **Nome exibido** | **Bater Ponto** (no ícone, na Play Store e no `app.json`) |
| **Ideia central** | **"O ponto que fecha o ciclo."** A jornada é um anel. Cada batida é um ponto nele. O app inteiro nasce dessa forma: logo, botão principal, timeline, ilustrações |
| **Personalidade** | Preciso · calmo · confiável · discreto. É uma ferramenta, não um brinquedo, mas com acabamento de relógio bom |
| **Metáfora visual** | Relógio de precisão: fundos profundos, um acento luminoso, números grandes e alinhados |
| **O que a marca NÃO é** | Corporativa/RH, infantil, cheia de gradientes, cheia de ícones coloridos |

### 6.2 Logo

**Símbolo: "o Ponto"**

```
        ●━━━━━━╮          Anel aberto (300°) que começa às 12h e corre
      ╱          ╲        no sentido horário até as 10h. Termina num
     │            │       ponto sólido: a batida que fecha o dia.
     │            │
      ╲          ╱        A abertura entre 10h e 12h é o descanso
        ╰━━━━━━━╯         entre jornadas, que separa um dia do outro.
```

**Construção** (grade de 24 unidades, para escalar sem perder nitidez):
- Diâmetro do anel: 18u (centro em 12,12). Espessura do traço: 2,5u, com ponta arredondada no início.
- Arco de 300°, de 0° (12h) a 300° (10h), sentido horário.
- Ponto final: círculo sólido de diâmetro 4,5u, centrado no fim do arco. Ele é ~1,8× a espessura do traço, para que leia como "ponto" mesmo a 16px.
- Sem gradiente, sem sombra. Uma cor sobre um fundo.
- O mesmo desenho, em escala, é o anel do `PunchButton` da tela Hoje. **Logo e produto são a mesma forma.**

**Logotipo (wordmark)**: `bater ponto.` em Inter Bold, minúsculas, tracking −2%. O ponto final do wordmark é sempre na cor primária: é o trocadilho visual com "ponto".

**Variações**

| Variação | Uso |
|---|---|
| Símbolo sozinho | Ícone do app, splash, favicon, tela de bloqueio |
| Lockup horizontal (símbolo + wordmark) | Onboarding, cabeçalho do PDF, Play Store |
| Monocromático (1 cor, sem fundo) | Ícone temático do Android 13+, PDF em P&B |

**Regras de uso**: área de proteção = metade do diâmetro do símbolo em volta. Tamanho mínimo de 16px (símbolo) e 80px de largura (lockup). Não girar, não contornar, não aplicar gradiente nem sombra, não colocar sobre foto.

### 6.3 Paleta de cores

**Cores da marca**

| Papel | Nome | Escuro | Claro | Por quê |
|---|---|---|---|---|
| **Primária** | **Menta** | `#3DDC97` | `#0B7F50` | Verde = "em andamento / tudo certo". Menta foge do verde genérico de banco e brilha bem sobre o fundo escuro |
| **Secundária** | **Âmbar** | `#F5B544` | `#956200` | Contraste natural com a menta (quente × fria). É a cor da pausa |
| **Base / Neutra** | **Tinta** | `#0B0D10` | `#F6F7F9` | Grafite levemente azulado, não preto puro (cansa menos a vista e evita o "smear" do OLED) |
| **Destaque de valor** | **Ouro** | `#E8C872` | `#8A6D1A` | Usado **só** para dinheiro. Assim R$ fica reconhecível de relance |

**Escala neutra "Tinta"** (base de todas as superfícies e textos):
`950 #07080A · 900 #0B0D10 · 850 #14171C · 800 #1C2027 · 700 #262B33 · 600 #3A414C · 500 #5B6472 · 400 #8A93A3 · 300 #B9C0CB · 200 #E4E7EC · 100 #F0F2F5 · 50 #F6F7F9 · 0 #FFFFFF`

**Tokens semânticos por tema** (as telas usam só estes nomes, nunca hex)

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `bg` | Tinta 900 `#0B0D10` | Tinta 50 `#F6F7F9` | Fundo |
| `surface` | Tinta 850 `#14171C` | `#FFFFFF` | Cards |
| `surfaceRaised` | Tinta 800 `#1C2027` | `#FFFFFF` + sombra | Sheets, cards elevados |
| `border` | Tinta 700 `#262B33` | Tinta 200 `#E4E7EC` | Divisores (hairline) |
| `text` | `#F2F4F7` | Tinta 900 `#0B0D10` | Texto principal |
| `textMuted` | Tinta 400 `#8A93A3` | Tinta 500 `#5B6472` | Secundário |
| `primary` / **trabalho** | `#3DDC97` | `#0B7F50` | Trabalhando, botão principal, anel |
| `onPrimary` | Tinta 900 `#0B0D10` | `#FFFFFF` | Texto sobre a primária |
| `secondary` / **intervalo** | `#F5B544` | `#956200` | Pausas |
| **folga** | `#8B7CF6` (violeta) | `#5B48D9` | Folgas |
| **férias** | `#4FC3F7` (céu) | `#0A6FA0` | Férias |
| **atestado** | `#F28FB1` (rosa) | `#B23A68` | Atestado |
| **feriado** | `#FF9F5A` (coral) | `#A84E0C` | Feriados |
| **dinheiro** | Ouro `#E8C872` | Ouro `#8A6D1A` | Valores R$ |
| **alerta** | `#FF6B6B` | `#C62F2F` | Erros, interjornada < 11h |
| **noturno** | `#5B8DEF` | `#2F5DBF` | Horas noturnas |

> A paleta de estados (trabalho/intervalo/folga…) é a **linguagem visual do app**: aparece igual no anel, na timeline, no calendário, nos gráficos e nos chips.

**Regras de cor (usabilidade)**
- **Contraste**: texto ≥ 4,5:1 e elementos de interface ≥ 3:1 (WCAG AA), nos dois temas. Já conferido: menta sobre Tinta ≈ 11:1 e `#0B7F50` com texto branco ≈ 5:1. Os demais pares serão checados por um teste automático na fase 0, e um tom que falhar é ajustado.
- **Cor nunca é a única pista**: todo estado tem cor + ícone + texto (ex.: chip "⏸ Intervalo"). Funciona para daltônicos.
- **Um acento por tela**: a primária aparece no elemento mais importante. O resto é neutro.
- No escuro, as cores semânticas são mais claras e menos saturadas. No claro, são mais escuras (para manter contraste sobre branco).

### 6.4 Tipografia

**Família única: Inter** (licença OFL, gratuita).
- **Por quê**: algarismos tabulares de verdade (os relógios não "tremem" quando o número muda), ótima leitura em tamanhos pequenos, acentuação do português impecável.
- **Performance**: uma família só, **4 pesos** (400, 500, 600, 700) em arquivos estáticos, **embutidos no build** pelo config plugin do `expo-font`. Nada carregado em tempo de execução: sem atraso na abertura e sem "piscar" de fonte.
- Todo número usa `fontVariant: ['tabular-nums']`.

| Token | Tamanho / altura de linha / peso | Uso |
|---|---|---|
| `display` | 56 / 60 / 600, tracking −2% | Cronômetro |
| `title1` | 28 / 34 / 700, tracking −1% | Título de tela |
| `title2` | 22 / 28 / 600 | Números dos cards |
| `headline` | 17 / 22 / 600 | Títulos de seção, botões |
| `body` | 15 / 22 / 400 | Texto |
| `caption` | 13 / 18 / 500 | Labels |
| `micro` | 11 / 14 / 600, maiúsculas, tracking +6% | Overlines ("TRABALHANDO") |

**Acessibilidade**: respeita o tamanho de fonte do Android. Textos comuns escalam livremente. `display` e `title2` limitam a escala a 1,3× (`maxFontSizeMultiplier`) para não quebrar o layout. Telas testadas com fonte em 1,3× e 2×.

### 6.5 Espaçamento, forma e elevação
- **Espaçamento**: grid de 4pt: `xs 4 · sm 8 · md 12 · lg 16 · xl 24 · 2xl 32 · 3xl 48`. Margem lateral das telas: 20.
- **Raio**: `sm 8 · md 14 · lg 20 · xl 28 · full`. Cards = `lg`, botões e chips = `full`. Formas arredondadas ecoam o anel do logo.
- **Elevação**: no escuro, contraste de superfície em vez de sombra. No claro, uma sombra suave única (`0 4 16 rgba(11,13,16,0.06)`).
- **Alvo de toque**: mínimo **48×48dp** (padrão do Android), mesmo quando o elemento visual é menor.

### 6.6 Iconografia
- **Material Symbols** via `expo-symbols` (o mesmo conjunto das abas nativas, funciona no Expo Go).
- Um peso só (400), tamanhos 20 e 24. Ícones sempre acompanhados de texto nas ações principais.
- Ícones de estado fixos (Material Symbols): `play_arrow` trabalho · `pause` intervalo · `dark_mode` noturno · `beach_access` folga · `flight` férias · `medical_services` atestado · `celebration` feriado · `payments` dinheiro.

### 6.7 Ilustrações e estados vazios
- Feitas com a **geometria do logo** (arcos + pontos), em linha, com 1 cor neutra + 1 acento.
- Componentes SVG (`react-native-svg`) que mudam de cor com o tema. **Zero imagens rasterizadas**, o que deixa o app leve e nítido em qualquer tela.
- Três ilustrações: "nenhum registro ainda" (anel vazio com um ponto esperando), "período sem dados" (arcos esmaecidos) e "tudo certo / backup feito" (anel fechado).

### 6.8 Ativos da marca (eu produzo todos)

Arquivos mestres em **SVG** em `assets/brand/`. Os PNGs são **gerados por um script** (`scripts/generate-brand-assets.mjs`, rodando `@resvg/resvg-js` como dependência de desenvolvimento), para serem reproduzíveis e ficarem sempre consistentes. Os placeholders atuais de `assets/` são substituídos.

| Ativo | Especificação | Conteúdo |
|---|---|---|
| `brand/symbol.svg`, `brand/wordmark.svg`, `brand/lockup.svg` | Vetor mestre | Logo e variações (6.2) |
| **Ícone adaptativo – frente** `android-icon-foreground.png` | 1024×1024, símbolo dentro da zona segura central (66/108 da área), fundo transparente | Símbolo em menta |
| **Ícone adaptativo – fundo** | Cor sólida `#0B0D10` via `adaptiveIcon.backgroundColor` (sem PNG, mais leve) | Tinta |
| **Ícone monocromático** `android-icon-monochrome.png` | 1024×1024, símbolo branco sobre transparente | Ícone temático do Android 13+ (assume a cor do papel de parede) |
| **Ícone legado** `icon.png` | 1024×1024, sangrado | Símbolo menta sobre Tinta |
| **Splash** `splash-icon.png` (+ variante escura) | Símbolo sozinho, 288×288 dentro do círculo de 192dp da API de splash do Android 12+ | Claro: símbolo `#0B7F50` sobre `#F6F7F9` · Escuro: símbolo `#3DDC97` sobre `#0B0D10` |
| **Favicon** `favicon.png` | 48×48 (o app não mira a web, mas o ativo fica coerente) | Símbolo menta sobre Tinta, traço engrossado para pequenos tamanhos |
| **Play Store – ícone** | 512×512 PNG | Igual ao ícone legado |
| **Play Store – imagem de destaque** | 1024×500 | Lockup + anel em movimento sugerido, fundo Tinta |
| **Cabeçalho do PDF** | SVG inline no HTML | Lockup em Tinta (PDF sempre claro) |

**Splash screen e abertura**
1. Configurada pelo plugin `expo-splash-screen` no `app.json`, com variantes claro/escuro conforme o tema do sistema (conferir as opções exatas na doc v57).
2. A splash fica só até o banco abrir, as migrações rodarem e as configurações carregarem (`preventAutoHideAsync` → `hideAsync`). Meta: **< 1s** na maioria dos aparelhos.
3. A splash sai com fade, e o anel da tela Hoje se **desenha** a partir das 12h (animação de traço de 400ms): parece que o logo "virou" o app. Com "Reduzir movimento" ligado, é só um fade.

### 6.9 Tom de voz (microcopy)
- Português direto, tratando por **você**. Frases curtas, verbo no início: "Iniciar dia", "Voltar ao trabalho", "Marcar folga".
- **Número primeiro**: "11h trabalhadas", não "Você trabalhou um total de 11 horas".
- Erros explicam **o que fazer**: "Esse horário é antes da última batida (09:00). Escolha um horário depois dele."
- Sem jargão de RH ("registro de ponto eletrônico"), sem exclamações em excesso, sem culpa ("Esqueceu de encerrar?" em vez de "Você não encerrou o dia").
- Formatos fixos: horas `08:00` (24h) · durações `5h 42min` (ou `05:42` em tabelas) · dinheiro `R$ 1.234,56` · datas `ter, 14 out`.

### 6.10 Componentes base (`src/components/ui/`)
Cada componente segue a convenção `variant` / `size` / `state`:
- `Text` (variants = tokens tipográficos), `Screen` (safe area + scroll + header grande)
- `Button` (`primary` | `secondary` | `ghost` | `destructive`; `lg` | `md` | `sm`)
- `PunchButton` (o grande botão de estado)
- `Card`, `StatCard` (label + número animado + delta)
- `Chip` / `StatusPill` (cor + ícone + texto do estado)
- `ProgressRing` (SVG animado, mesma geometria do logo)
- `Timeline` + `TimelineItem` (vertical) e `TimelineBar` (horizontal mini)
- `PeriodPicker`, `CalendarGrid`, `DayCell`
- `AnimatedNumber` (roll de dígitos), `Duration` (formata "5h 42min" ou "05:42")
- `Money` (formata R$ em ouro)
- `EmptyState` (com as ilustrações de 6.7), `Banner` (info/alerta), `Toast` (com "Desfazer")
- `ListRow`, `SectionHeader`, `Divider`
- `BrandMark` (símbolo/lockup em SVG, usado no onboarding, bloqueio e "Sobre")

**Regra**: telas só montam componentes de `ui/` e `features/`. Nenhuma cor, tamanho ou espaçamento literal fora de `theme/`.

### 6.11 Particularidades do Android
- Edge-to-edge: barra de status e de navegação transparentes, com o conteúdo respeitando as safe areas.
- Botão/gesto voltar fecha sheets e modais antes de sair da tela.
- Ripple do Material nos toques, combinado com a escala do design system.
- Animações calibradas para telas de 90/120Hz. Teste também em aparelho intermediário (60Hz).
- Teclado numérico (`keyboardType="decimal-pad"`) nos campos de R$ e horas.

### 6.12 Diretrizes de usabilidade
1. **Ação do dia em 1 toque, qualquer coisa em até 3.** Bater ponto não exige confirmação. Errou? "Desfazer" ou "Ajustar" (corrigir um horário leva 3 toques: Ajustar → −1 −1 → Salvar).
2. **Uso com uma mão**: o botão principal e as abas ficam na metade de baixo da tela, onde o polegar alcança.
3. **Estado sempre visível**: em qualquer aba dá para saber se você está trabalhando, em pausa ou fora (pílula de estado no topo).
4. **Nada destrutivo sem saída**: exclusão com "Desfazer". Apagar tudo e restaurar com dupla confirmação.
5. **TalkBack**: rótulos falados em tudo ("Entrada às 08:00, editada"). O cronômetro anuncia a cada minuto, não a cada segundo.
6. **Feedback triplo** nas ações importantes: visual + háptico + texto.
7. **Consistência acima de criatividade**: o mesmo componente faz sempre a mesma coisa, no mesmo lugar.

### 6.13 Orçamento de performance
| Métrica | Meta |
|---|---|
| Abertura a frio até a tela Hoje utilizável | < 1,5s em aparelho intermediário |
| Animações | 60fps no mínimo, rodando na UI thread (Reanimated) |
| Cronômetro ao vivo | Sem re-render do React por segundo (shared value) |
| Consulta de um período no SQLite | < 50ms |
| Gráficos | SVG próprio, sem biblioteca de gráficos |
| Imagens | Só vetores. PNG apenas para ícone e splash |
| Fontes | 4 arquivos embutidos no build, sem carregamento em runtime |
| Dependências | Cada lib nova precisa justificar o peso. Nada de `moment`, lodash completo ou kits de UI inteiros |

---

## 7. Animações e interações

**Princípios**: toda animação explica uma mudança de estado. Molas (spring) para interações, timing para mudanças de dados. Duração alvo de 150 a 350ms. Respeita **Reduzir movimento** do sistema (vira fade).

**Tokens de movimento** (`theme/motion.ts`)
- `spring.snappy` (damping 20, stiffness 300): botões, toggles
- `spring.gentle` (damping 18, stiffness 160): cards, sheets
- `timing.fast` 150ms / `timing.base` 250ms / `timing.slow` 400ms (easing `out-cubic`)

| Momento | Animação | Háptico |
|---|---|---|
| Pressionar o PunchButton | Escala 0.96 + leve brilho | `impactMedium` ao soltar |
| Bater ponto | Botão faz *morph* de cor (verde → âmbar) e o label troca com crossfade vertical; nova linha entra na timeline com slide + fade; anel continua de onde parou | `notificationSuccess` |
| Toque longo (retroativo) | Anel de "segurar" preenche por 500ms → abre o time picker | `selection` no tick |
| Encerrar dia | Anel completa a volta e "fecha" com pulso; resumo do dia sobe em card ("Hoje: 11h · intervalo 11h") | `notificationSuccess` |
| Cronômetro ao vivo | Dígitos com transição de roll só no dígito que muda | – |
| Anel de progresso | Preenche com spring. Passou da meta → segunda volta em tom mais claro | – |
| Números dos cards | Count-up ao entrar na tela e ao trocar de período | – |
| Trocar de período | Conteúdo desliza na direção do swipe; números recontam | `selection` |
| Calendário | Dia selecionado com "bolha" que desliza entre células (shared value) | `selection` |
| Listas | Entering `FadeInDown` em cascata (30ms de stagger, só na 1ª carga); exit + `LinearTransition` ao excluir | – |
| Swipe na linha | Revela ações com resistência elástica | `impactLight` no threshold |
| Marcar folga | Células selecionadas ganham o violeta em onda (stagger) | `notificationSuccess` |
| Erro de validação | Shake horizontal de 6px no campo | `notificationError` |
| Ajuste fino de horário (−1/+1) | Dígito que muda faz roll vertical na direção do ajuste | `selection` a cada minuto |
| Segurar −5/+5 | Repetição acelera (300ms → 80ms entre passos) | `selection` a cada passo |
| Bater no limite do horário | Botão treme e fica desabilitado; texto "entre 11:00 e 16:00" pisca uma vez | `notificationWarning` |
| Prévia ao vivo | Totais "antes → depois" animam com o número rolando | – |
| Salvar edição | Sheet desce; a batida na timeline pulsa uma vez para mostrar o que mudou | `notificationSuccess` |
| Calculadora | Valores do recibo animam a cada mudança do slider | `selection` a cada R$ 100 |

---

## 8. Modelo de dados (SQLite)

```sql
-- Jornada (dia de trabalho)
CREATE TABLE workday (
  id            TEXT PRIMARY KEY,          -- uuid
  ref_date      TEXT NOT NULL,             -- 'YYYY-MM-DD' (data da batida de início)
  status        TEXT NOT NULL,             -- 'open' | 'closed' | 'incomplete'
  note          TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX idx_workday_ref ON workday(ref_date);

-- Batida
CREATE TABLE punch (
  id            TEXT PRIMARY KEY,
  workday_id    TEXT NOT NULL REFERENCES workday(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,             -- 'in' | 'out'
  at            INTEGER NOT NULL,          -- epoch ms UTC
  tz            TEXT NOT NULL,             -- ex.: 'America/Sao_Paulo'
  is_day_start  INTEGER NOT NULL DEFAULT 0,
  is_day_end    INTEGER NOT NULL DEFAULT 0,
  original_at   INTEGER,                   -- preenchido se editada
  source        TEXT NOT NULL,             -- 'live' | 'retro' | 'manual'
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX idx_punch_at ON punch(at);

-- Folga
CREATE TABLE day_off (
  date          TEXT PRIMARY KEY,          -- 'YYYY-MM-DD'
  kind          TEXT NOT NULL DEFAULT 'folga', -- folga | ferias | atestado | feriado
  note          TEXT,
  created_at    INTEGER NOT NULL
);

-- Feriados: os nacionais são CALCULADOS (não ficam aqui).
-- Esta tabela guarda só feriados próprios e desativações de feriados nacionais.
CREATE TABLE holiday_override (
  id            TEXT PRIMARY KEY,
  kind          TEXT NOT NULL,             -- 'custom' | 'disabled'
  date          TEXT,                      -- 'YYYY-MM-DD' (custom não recorrente)
  month_day     TEXT,                      -- 'MM-DD' (custom recorrente ou nacional desativado)
  year          INTEGER,                   -- desativação só de um ano (NULL = todo ano)
  name          TEXT,
  holiday_key   TEXT,                      -- ex.: 'tiradentes' (para 'disabled')
  created_at    INTEGER NOT NULL
);

-- Configurações (chave/valor tipado na camada de app)
CREATE TABLE setting (key TEXT PRIMARY KEY, value TEXT NOT NULL);
-- period_start_day=21, hourly_rate=0, daily_goal_min=480,
-- daily_goal_by_weekday=null (ex.: {"6":240,"0":0}), min_rest_min=660,
-- max_workday_min=1440, salary_mode='simple', overtime_pct=50, holiday_overtime_pct=100,
-- night_pct=20, night_reduced=1, theme='system', optional_holidays=0,
-- user_name='', last_backup_at=null, biometric_lock=0, lock_after_sec=60, ...
-- (biometric_lock e lock_after_sec ficam FORA do backup; ver L7)
```

Os **períodos não são armazenados**. São calculados a partir de `period_start_day`, e assim a regra P4 sai de graça.

---

## 9. Arquitetura

```
src/
├── app/                    → rotas (somente telas finas, seção 5)
├── components/ui/          → design system (seção 6.10)
├── features/
│   ├── punch/              → PunchButton, hooks useTodayState, ações de bater ponto
│   ├── workday/            → timeline, detalhe, edição
│   ├── calendar/           → CalendarGrid, seleção múltipla
│   ├── summary/            → StatCards, gráficos
│   ├── salary/             → recibo, simulador
│   ├── holidays/           → lista, overrides, chip de feriado
│   ├── export/             → template HTML do espelho de ponto + geração do PDF
│   ├── backup/             → gerar/compartilhar/importar arquivo
│   ├── lock/               → LockGate (envolve o app), tela de bloqueio, AppState
│   └── settings/
├── domain/                 → LÓGICA PURA, sem React e sem banco (100% testada)
│   ├── period.ts           → getPeriod(date, startDay), listPeriods, labels
│   ├── workday.ts          → pares de turnos, intervalos, amplitude, status
│   ├── state-machine.ts    → estado do dia + transições válidas
│   ├── validation.ts       → regras R1–R12, F1–F6
│   ├── stats.ts            → indicadores da seção 4
│   ├── night-hours.ts      → interseção de turnos com 22h–5h
│   ├── salary.ts           → modo simples e CLT, INSS/IRRF
│   ├── holidays.ts         → Páscoa, feriados fixos/móveis, aplicação dos overrides
│   ├── balance.ts          → meta diária, saldo, banco de horas
│   └── backup-schema.ts    → formato versionado, validação e migração do arquivo
├── db/
│   ├── migrations.ts       → esquema + migrações (PRAGMA user_version)
│   └── *-repo.ts           → workday-repo (jornadas + batidas), day-off-repo, holiday-repo, settings-repo
├── screens/                → corpo de cada tela (as rotas em app/ só renderizam a tela)
├── stores/                 → zustand (configurações em memória, período selecionado, toasts)
├── theme/                  → palette (escalas da marca), colors (tokens por tema), typography,
│                             spacing, radius, motion, useTheme
├── components/brand/       → BrandMark e ilustrações SVG (6.7)
└── lib/                    → format (duração, dinheiro, datas pt-BR), haptics, uuid

assets/brand/               → SVGs mestres do logo (fora de src/)
scripts/generate-brand-assets.mjs → gera os PNGs de ícone/splash/favicon a partir dos SVGs
```

**Fluxo**: Tela → hook da feature → repositório (SQLite) → dados brutos → `domain/` calcula → componente exibe.
A camada `domain/` recebe dados simples e devolve resultados. Testes unitários cobrem os exemplos A e B, a virada de meia-noite, a borda de período, as interjornadas, as horas noturnas, o salário, as datas da Páscoa/feriados de vários anos e o ciclo backup → restauração.

**Performance**: consultas por intervalo de datas indexadas. Cálculos memoizados por período. Cronômetro isolado num componente próprio (só ele re-renderiza a cada segundo). Listas com `FlashList` se o histórico crescer.

---

## 10. Casos-limite (checklist de testes)

- [ ] Jornada que cruza a meia-noite (exemplo B)
- [ ] Jornada que começa no último dia do período e termina no primeiro dia do seguinte → conta no período de origem
- [ ] Turno que cruza 22h ou 5h → horas noturnas parciais corretas
- [ ] Esqueceu de encerrar o dia (aberta há mais de 24h) → alerta e fluxo de correção
- [ ] Esqueceu de bater a volta do intervalo → editar inserindo turno
- [ ] Toque duplo no botão → debounce + desfazer
- [ ] Batida retroativa antes da última batida existente → erro
- [ ] Edição que faria duas jornadas se sobreporem → erro
- [ ] Folga em dia com jornada → confirmação e substituição
- [ ] Jornada de 02:00 terminando num dia marcado como folga → permitido (F3)
- [ ] Dia de início do período = 31 em fevereiro → último dia
- [ ] Mudar dia de início com dados existentes → só muda a visualização
- [ ] Período sem nenhum dado → empty states
- [ ] Valor/hora = 0 ou vazio → calculadora pede o valor
- [ ] Mudança de fuso (viagem) → exibe no fuso da batida
- [ ] Relógio do celular alterado manualmente → batida no futuro bloqueada
- [ ] App fechado durante a jornada → ao reabrir, o estado vem do banco (fonte da verdade)
- [ ] Apagar todos os dados → confirmação dupla
- [ ] Páscoa e Sexta-feira Santa corretas para 2024–2035 (tabela de referência)
- [ ] Feriado desativado em um ano específico continua ativo nos outros
- [ ] Jornada que começa num feriado às 23h → hora extra de 100% inteira (a data de referência manda)
- [ ] Jornada que começa no dia anterior e entra no feriado → **não** vira feriado (regra simples, documentada no app)
- [ ] Folga manual no mesmo dia de um feriado → exibe só a folga (H6)
- [ ] Meta por dia da semana + feriado → meta 0h
- [ ] PDF com jornada de 5+ turnos → layout não quebra
- [ ] PDF de período vazio → gera com aviso "sem registros", sem erro
- [ ] Backup → apagar tudo → restaurar → dados idênticos (teste de ida e volta)
- [ ] Restaurar arquivo corrompido / de outro app → nada muda, erro claro
- [ ] Restaurar backup de versão de schema antiga → migra
- [ ] Falha no meio da restauração → rollback da transação
- [ ] Editar pausa de 15:45 → 15:43 → totais do dia, período e salário atualizam
- [ ] Ajuste −1 até encostar na batida anterior → botão desabilita, não passa
- [ ] Editar o fim do dia para 00:10 do dia seguinte → aceita (jornada cruza a meia-noite)
- [ ] Editar o início do dia para o dia anterior → aviso de troca de data de referência (ED8)
- [ ] Editar a última batida da jornada em andamento → cronômetro recalcula
- [ ] "Voltar ao original" → restaura o horário e remove a marca de editada
- [ ] Desfazer logo após salvar uma edição → volta ao horário anterior
- [ ] Ligar a trava num aparelho sem biometria nem bloqueio de tela → switch desabilitado
- [ ] App em segundo plano por menos/mais que o tempo configurado → não pede / pede autenticação
- [ ] Cancelar a autenticação → continua bloqueado, sem vazar conteúdo
- [ ] Conteúdo oculto na tela de apps recentes com a trava ligada

---

## 11. Roadmap

**Fase 0: Fundação** ✅ concluída em 14/10/2026
**Identidade visual**: SVGs mestres do logo, script de geração e todos os ativos (ícone adaptativo e monocromático, splash claro/escuro, favicon) · `app.json` (nome "Bater Ponto", Android, `userInterfaceStyle: "automatic"`, edge-to-edge, splash, fontes Inter embutidas) · Expo Router · tema claro/escuro e tokens (com teste automático de contraste) · componentes UI base, SQLite + migrações, camada `domain/` com testes (incluindo feriados e saldo).

**Fase 1: MVP (uso diário)** ✅ concluída em 14/10/2026

> Notas de implementação da fase 1:
> - Início e fim do dia são sempre a **primeira e a última batida** da jornada (normalizadas a cada edição). "Marcar outra batida como início/fim" (que dividiria uma jornada) ficou para depois.
> - Seleção múltipla no calendário: **segurar um dia** entra no modo de seleção e os toques seguintes marcam/desmarcam (sem arrastar).
> - Swipe nas linhas do histórico ficou para a fase 2. Editar e excluir estão no detalhe da jornada.
> - O cronômetro re-renderiza **só o próprio componente** a cada segundo. O resto da tela atualiza por minuto.
> - Cadastro manual usa horários de relógio: um horário menor que o anterior vira automaticamente o dia seguinte (+1).
> - Os casos de uso de banco (bater, editar, desfazer, folgas, backup) são testados contra SQLite real (`node:sqlite`).
Onboarding · HOJE (botão, estados, timeline, cronômetro) · Histórico (lista + calendário com feriados) · Detalhe/edição de jornada · Folgas (4 tipos) · Feriados nacionais automáticos · Configuração de período e meta diária · Resumo com os cards principais + banco de horas · Calculadora modo simples · **Backup e restauração** (proteger os dados desde o 1º dia).

**Fase 2: Premium**
Ilustrações dos estados vazios · Animação de abertura (splash → anel) · Imagem de destaque da Play Store · Todas as animações da seção 7 · Gráficos (barras, heatmap) · Indicadores secundários · Comparação entre períodos · Modo CLT (extras 50%/100%, noturno, INSS/IRRF) · Simulador · **Exportação em PDF** · Ajustes de feriados (desativar, facultativos, próprios).

**Fase 3: Extras**
Meta por dia da semana · Bloqueio por biometria (3.10) · Primeiro build de desenvolvimento/produção com EAS (`eas build --platform android`).

---

## 12. Sugestões extras (para você aprovar)

| # | Sugestão | Status |
|---|---|---|
| 1 | Widget / atalho para bater ponto sem abrir o app | ❌ Descartado |
| 2 | Lembretes por notificação | ❌ Descartado (os alertas dentro do app, como o R5, continuam) |
| 3 | Meta diária / banco de horas | ✅ Aprovado (padrão 8h, configurável; 3.5) |
| 4 | Feriados nacionais automáticos | ✅ Aprovado (3.7) |
| 5 | Etiquetas por turno | ❌ Descartado |
| 6 | Exportar espelho de ponto em PDF | ✅ Aprovado (3.8) |
| 7 | Backup em arquivo | ✅ Aprovado (3.9) |
| 8 | Bloqueio por biometria | ✅ Aprovado (3.10) |

---

## 13. Perguntas e decisões

| # | Pergunta | Padrão proposto |
|---|---|---|
| Q1 | ✅ O período "21 a 21": o dia 21 do mês seguinte já pertence ao próximo período? | **Decidido:** 21/09 a 20/10, e 21/10 inicia o próximo |
| Q2 | ✅ A calculadora deve ter só "horas × valor" ou também regras CLT? | **Decidido:** simples no MVP, CLT opcional na fase 2 |
| Q3 | ✅ Os dados ficam só no celular ou na nuvem? | **Decidido:** só local + backup em arquivo |
| Q4 | ✅ Tipos de folga | **Decidido:** folga, férias, atestado e feriado, cada um com cor/ícone |
| Q5 | ✅ Tema | **Decidido:** claro e escuro, padrão = sistema, com troca manual em Ajustes |
| Q6 | ✅ Widget / Live Activity | **Decidido:** não terá |
| Q7 | ✅ Plataformas-alvo | **Decidido:** somente Android |
| Q8 | ✅ Intervalo/pausa é remunerado? | **Decidido:** não. Pausa nunca conta como tempo pago (só informativo) |
| Q9 | ✅ Jornada contratual | **Decidido:** meta de 8h/dia por padrão, configurável (fase 3: por dia da semana) |
| Q10 | ✅ Nome do período | **Decidido:** pelo mês em que começa ("Setembro 2026 · 21/09 a 20/10") |

Todas as perguntas e sugestões estão decididas. O plano está pronto para começar a fase 0.
