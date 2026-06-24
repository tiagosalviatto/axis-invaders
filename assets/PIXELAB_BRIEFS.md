# Briefs de geração — PixeLabAI (Axis Invaders)

Cada asset abaixo traz **prompt** (em inglês — o PixeLab responde melhor) e as
**configurações** recomendadas. Os prompts em português ficam só como referência.

## Configurações globais (valem para todos, salvo indicação)
- **Background:** transparent / no background
- **Outline:** single color (black)
- **Isometric:** off
- **Frames:** 1 (estático). *Opcional:* gerar 2 frames para inimigos (animação de marcha
  estilo Space Invaders).
- **Negative prompt padrão:** `background, ground, floor, shadow, blur, jpeg, text, watermark, frame`
- **Sem texto/logos** (evita problemas de marca).

> Observação de integração: você pode gerar tudo em telas quadradas confortáveis (48×48,
> 32×32 etc.). No código, o carregador (etapa seguinte) vai desenhar cada PNG num
> "footprint" fixo para manter as colisões equilibradas — então não precisa se preocupar em
> casar pixel a pixel com os tamanhos atuais.

---

## 1) Naves (3) — tela 48×48
**View:** high top-down · **Direction:** north (nariz para cima) · **Shading:** medium ·
**Detail:** highly detailed

### BS — equilibrada
- **Palette:** `#CFD6E6 #8FA0C0 #2E3A55 #FFD400 #FFFFFF`
- **Prompt:** `top-down view of a balanced sci-fi fighter spaceship, symmetrical arrow-shaped hull, twin side wings, single central cockpit, two small rear engine thrusters, clean retro arcade pixel art`

### PC — ágil (interceptadora)
- **Palette:** `#7FE3FF #2BA6D6 #16314A #FF4D4D #FFFFFF`
- **Prompt:** `top-down view of a sleek agile interceptor spaceship, very narrow needle-shaped hull, swept-back thin wings, sharp pointed nose, single small thruster, aerodynamic, retro arcade pixel art`

### ARTY — pesada (canhoneira)
- **Palette:** `#D8D8D8 #7A7A7A #3A3D44 #FF1418 #FFD400`
- **Prompt:** `top-down view of a heavy armored artillery gunship, bulky wide reinforced hull, two large forward-facing cannons, thick stubby wings, four heavy engine thrusters, militaristic, retro arcade pixel art`

---

## 2) Projéteis — **View:** top-down · **Shading:** basic · **Detail:** medium

### Tiro do player — tela 16×24
- **Palette:** `#FFD400 #FF8000 #FFFFFF`
- **Prompt:** `top-down small vertical energy bolt, bright glowing core with tapered tail, pointing up, retro arcade pixel art`

### Tiro inimigo (genérico) — tela 16×24
- **Palette:** `#C8102E #FF6060 #FFFFFF`
- **Prompt:** `top-down small hostile plasma projectile, jagged energy orb with short downward tail, menacing, retro arcade pixel art`

### Tiro grande (chefe Cage) — tela 32×32
- **Palette:** `#FFD45A #C8102E #FFFFFF`
- **Prompt:** `top-down large dramatic fireball projectile, spiky burning energy sphere, intense glow, retro arcade pixel art`

### Tiro sirene VERMELHO (chefe Polícia) — tela 16×24
- **Palette:** `#FF2030 #FF8090 #FFFFFF`
- **Prompt:** `top-down red glowing police siren energy bolt with short tail, retro arcade pixel art`

### Tiro sirene AZUL (chefe Polícia) — tela 16×24
- **Palette:** `#3050FF #8095FF #FFFFFF`
- **Prompt:** `top-down blue glowing police siren energy bolt with short tail, retro arcade pixel art`

---

## 3) Inimigos — tela 48×48
**View:** front (de frente para a câmera) · **Shading:** medium · **Detail:** highly detailed
*(Opcional: 2 frames para animação de marcha.)*

### Estágio 1 — CAGE RAGE · Palette `#C8102E #FFD45A #FFFFFF`
- **CAGE_A (rosto dramático):** `front view pixel art icon of a dramatic shouting man's face, wild exaggerated eyebrows, wide open yelling mouth, intense expression, arcade space-invader style, red and pale-yellow palette`
- **CAGE_B (rosto alternativo):** `front view pixel art icon of a melodramatic shocked face, bulging wide eyes, gritted teeth, sweating, arcade space-invader style`
- **CAGE_C (abelha enxame):** `front view pixel art icon of an angry cartoon bee, round fuzzy striped body, small wings, big eyes, stinger, arcade space-invader style`

### Estágio 2 — BYD VELOCITY · Palette `#D8D8D8 #7A7A7A #FF1418`
- **BYD_A (chevron):** `front view pixel art icon of a sharp speed chevron arrow emblem, brushed metallic silver with red accent, arcade space-invader style`
- **BYD_B (carro):** `front view pixel art icon of a sleek electric sports car front fascia, low aggressive grille, angular LED headlights, silver body with red trim, arcade space-invader style`
- **BYD_C (farol):** `front view pixel art icon of a glowing angular LED headlight cluster, chrome silver housing with red light ring, arcade space-invader style`

### Estágio 3 — SAMBA STORM · Palette `#FFD400 #009C3B #FF4D4D`
- **SAMBA_A (maracá):** `front view pixel art icon of a festive maraca shaker, round dotted head with handle, Brazilian carnival colors yellow green red, arcade space-invader style`
- **SAMBA_B (surdo):** `front view pixel art icon of a Brazilian surdo samba drum, cylindrical body with tension rods, drumhead facing viewer, carnival colors yellow green red, arcade space-invader style`
- **SAMBA_C (chapéu de festa):** `front view pixel art icon of a festive carnival party hat with pom-pom and streamers, Brazilian colors yellow green red, arcade space-invader style`

---

## 4) Chefes — pixel art (substituem os letreiros tipográficos)
**View:** front / front 3-quarter (de frente para o jogador) · **Shading:** medium ·
**Detail:** highly detailed · **Outline:** single color (black) — casar com a estética
"chunky" atual (contorno preto grosso, paleta limitada, cara retrô de arcade).

### Chefe 1 — NICOLAS CAGE (Cage Rage) · tela 96×96
- **View:** front (retrato/busto, cabeça grande e ameaçadora)
- **Palette:** `#E8B894 #8A5A3A #3A2A1A #C8102E #FFD45A #FFFFFF`
- **Prompt:** `front view pixel art boss portrait of actor Nicolas Cage as a wild-eyed dramatic action villain, intense exaggerated expression, bulging eyes, gritted teeth, slicked dark hair, oversized menacing head, bold thick black outline, chunky retro arcade pixel art`

### Chefe 2 — CARRO BYD (BYD Velocity) · tela 128×80 (largo)
- **View:** front 3-quarter (frente agressiva, parado de frente para o jogador)
- **Palette:** `#D8D8D8 #7A7A7A #3A3D44 #FF1418 #2A8FE0 #FFFFFF`
- **Prompt:** `front three-quarter view pixel art of a sleek modern BYD electric car as a boss, aggressive low stance, glowing LED headlights, chrome grille, metallic silver body with red accents and subtle blue trim, bold thick black outline, chunky retro arcade pixel art`

### Chefe 3 — VIATURA (Samba Storm) · tela 128×80 (largo)
- **View:** front 3-quarter (com barra de luzes no teto)
- **Palette:** `#FFFFFF #1A2238 #3050FF #FF2030 #C0C0C0 #111111`
- **Prompt:** `front three-quarter view pixel art of a Brazilian police patrol car (viatura) as a boss, white body with bold dark stripes, roof-mounted siren light bar glowing red and blue, push-bar bumper, aggressive stance, bold thick black outline, chunky retro arcade pixel art`

> **Integração:** ao receber estes PNGs eu troco a geração tipográfica (`buildBossLabel`)
> pelo carregamento das imagens. O efeito de **halo de sirene vermelho/azul** do chefe da
> viatura (`drawPoliceSirens`) continua por cima do sprite — fica ótimo na viatura.
> Salve em `assets/bosses/` (ex.: `cage.png`, `byd.png`, `viatura.png`).

---

### Resumo de quantidade
- 3 naves · 5 projéteis · 9 inimigos · **3 chefes** = **20 assets**.
- *Você indicou que só vai (re)gerar os 3 chefes agora — o resto já está satisfatório.*
