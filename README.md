# Enduro

Recriação independente do **Enduro do Atari 2600**, de Larry Miller / Activision (1983), para jogar diretamente no navegador.

**Jogar:** https://amnsalomon.github.io/enduro/

## A corrida

- Ultrapasse **200 carros no primeiro dia** e **300 em cada dia seguinte**.
- Ao cumprir a meta, as bandeiras verdes aparecem. Continue até o próximo amanhecer para avançar.
- Se o dia terminar antes da meta, a corrida acaba. O placar é a distância percorrida.
- **Soltar o acelerador mantém a velocidade.** Use o freio para desacelerar.
- Colisões com carros reduzem muito a velocidade; o acostamento também desacelera.
- O gelo reduz a resposta da direção; a neblina limita a visibilidade; à noite, os adversários aparecem pelas lanternas.
- Complete cinco dias para conquistar o troféu de resistência. O tráfego fica progressivamente mais rápido.

## Controles

| Ação | Teclado |
| --- | --- |
| Dirigir | ← / → ou A / D |
| Acelerar | Espaço, ↑ ou W |
| Frear | ↓ ou S |
| Pausar / continuar | P ou Esc |
| Nova corrida | Enter ou R |
| Som | M |
| Tela cheia | F |

No celular, use os botões na tela, que aceitam múltiplos toques simultâneos. Controles USB/Bluetooth com mapeamento padrão também são aceitos: direcional para dirigir, botão principal ou gatilho direito para acelerar, baixo ou gatilho esquerdo para frear e Start para pausar.

O jogo pausa quando a janela perde o foco. Os recordes de distância e dias completos ficam no armazenamento local do navegador. O som é sintetizado e liberado após uma interação, conforme as permissões do navegador. Som, armazenamento e gamepad são opcionais: se uma dessas APIs estiver bloqueada, o restante do jogo continua disponível.

## Fidelidade e diferenças

A proposta é preservar a estética pixel art, a perspectiva da estrada, o painel, os controles e as regras centrais do clássico. A simulação usa coordenadas de 160 × 210, enquanto o desenho é feito em Canvas de **640 × 840**, apresentado em proporção 4:3. São quatro vezes mais resolução em cada dimensão para dar definição aos carros e ao cenário.

Os carros têm pneus separados, detalhes de suspensão, cockpit, piloto, aerofólio, sombras e lanternas. O cenário inclui montanhas em camadas, faces iluminadas e sombreadas, nuvens, vegetação, neve e marcadores nas margens da pista. A arte é desenhada diretamente pelo código, sem imagens externas.

**Esta versão é uma reimplementação, não um emulador e não uma cópia exata da ROM.** Pista, sequência de tráfego, sprites, paletas, física e sons foram reconstruídos. Cada dia dura 150 segundos; o tráfego é determinístico. Antes das bandeiras verdes, um adversário que ultrapassa o jogador de volta restaura uma unidade da meta; depois da classificação, as bandeiras permanecem até amanhecer.

Referência para as regras e controles: [manual original preservado pelo AtariAge](https://atariage.com/manual_html_page.php?SoftwareLabelID=163).

Enduro e Activision são marcas de seus respectivos titulares. Projeto independente, sem afiliação com os criadores do jogo original.

## Executar e publicar

Não há dependências, instalação ou etapa de build. Abra `index.html` em um navegador moderno. O arquivo contém o HTML, CSS, motor do jogo, renderizador e controles; não carrega scripts, fontes ou imagens externos.

No GitHub Pages, selecione **Settings → Pages → Deploy from a branch → main → / (root)**. O arquivo `.nojekyll` permite servir os arquivos estáticos diretamente.

## Verificação

Com Node.js 18 ou superior:

```sh
node --test tests/game.test.cjs
```

Os testes cobrem aceleração e frenagem, colisões, contagem de ultrapassagens, metas e término dos dias, gelo, neblina, noite, pausa, reinício, teclado, multitouch, gamepad e indisponibilidade de APIs opcionais. Uma simulação percorre cinco dias para verificar a viabilidade das metas e o limite de objetos de tráfego.

A aplicação usa uma simulação em passos fixos de 1/60 s, independente da taxa de quadros. Os testes exercitam o motor e a integração com uma interface simulada; não substituem uma sessão manual em cada navegador ou aparelho.
