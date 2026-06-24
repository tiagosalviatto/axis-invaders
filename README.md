# Axis Invaders — Edifício Eixo

Um *Space Invaders* de navegador, em pixel art, que (com bom humor) **prepara os jogadores
para o dia-a-dia no edifício Eixo**. Cada fase encena uma situação real da rotina do prédio —
e cada chefão é uma lição disfarçada de mini-boss. *Axis* = *Eixo*: defenda o seu posto.

Feito em HTML5 Canvas + JavaScript puro — sem framework, sem build, sem dependências.

## Conceito

A proposta é treinar, brincando, os hábitos do cotidiano no Eixo. As três fases sobem de
dificuldade no estilo clássico (mais fileiras, marcha e tiros mais rápidos a cada nível) e
abrem com uma breve cutscene narrando o contexto:

1. **Cage Rage** — *"Você deixou seu PC desbloqueado!"* O Nicolas Cage quer possuir sua
   máquina. **Lição: trave o computador ao se levantar.**
2. **BYD Velocity** — *"Você veio de carro para o escritório!"* Encare o trânsito.
   **Lição: considere vir de bike ou transporte público.**
3. **Samba Storm** — *"Happy hour com o time!"* O samba rola solto até a viatura aparecer.
   **Lição: confraternize (com responsabilidade).**

## Naves

Antes de começar você escolhe uma nave, e cada uma muda a jogabilidade:

| Nave   | Perfil      | Movimento | Cadência de tiro |
|--------|-------------|-----------|------------------|
| **BS**   | Equilibrada | médio     | média            |
| **PC**   | Ágil        | rápido    | mais lenta       |
| **ARTY** | Potente     | lento     | muito rápida     |

## Chefões

Cada fase termina num chefe em pixel art com barra de vida e padrão de ataque próprios. O
chefe final tem **duas fases**: ao derrotar a **viatura**, ela chama reforços e se divide em
**dois policiais** — um dá tiros guiados, o outro solta leques — cada um com sua barra de vida.

## Ranking global

Quem **zera o jogo** registra **nome, pontuação, tempo e nave** num ranking global
(Supabase). A pontuação premia completar as fases e a **velocidade** de cada uma. O ranking
pode ser consultado por qualquer um (tecla **R** no menu ou no game over), mas **só finalistas
registram seu nome**. Sem conexão, o jogo cai num placar local automaticamente.

## Como rodar

- **Rápido:** abra o `index.html` em qualquer navegador moderno (funciona offline, com placar
  local).
- **Com ranking global:** sirva por HTTP — por exemplo `python -m http.server` — e acesse via
  `http://localhost:...`. O `file://` é bloqueado por CORS ao falar com o Supabase.

As credenciais públicas do Supabase ficam em `src/config.js` (a *anon key* é segura de
versionar; o acesso é protegido por Row Level Security).

## Controles

| Tecla                       | Ação                                  |
|-----------------------------|---------------------------------------|
| `Space`                     | Iniciar · atirar · sair do Game Over  |
| `←` `→` / `A` `D`           | Mover · escolher nave                 |
| `↑` `↓` / `W` `S`           | Mover (faixa inferior da tela)        |
| `Enter`                     | Confirmar nave                        |
| `R`                         | Ver ranking global (menu / game over) |
| `P`                         | Pausar                                |
| qualquer tecla              | Avançar as cutscenes                  |

## Tech

- HTML5 Canvas + JavaScript puro (sem frameworks, build ou dependências).
- Sprites de inimigos/projéteis gerados por código a partir de uma mini-DSL de grade em texto;
  arte dos chefes em PNG (gerada no PixeLab) com *fallback* procedural.
- SFX sintetizados via WebAudio (nenhum arquivo de áudio embarcado).
- Ranking via Supabase (REST/PostgREST por `fetch`), com cache local (`localStorage`) de
  fallback.
- Tudo num único namespace `window.AxisInvaders`, carregado por `<script>` em ordem.
