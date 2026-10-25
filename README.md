# Enduro · 4K Road Legends

Recriação independente do Enduro de Larry Miller / Activision (1983), com corrida clássica, arte vetorial em 4K, poderes combináveis, progresso portátil e duelo fantasma entre dois navegadores.

**Jogar:** https://amnsalomon.github.io/enduro/

## Corrida

- Ultrapasse **200 carros no primeiro dia** e **300 nos seguintes**.
- Cada dia dura 150 segundos. Ao cumprir a meta, continue até amanhecer. Cinco dias completos rendem o troféu de resistência.
- Soltar o acelerador mantém a velocidade; o freio desacelera. Adversários que ultrapassam você de volta restauram uma unidade da meta antes da classificação.
- Gelo reduz a resposta da direção, neblina limita a visão e a noite esconde a carroceria dos adversários.
- O tráfego é determinístico. Física em passos fixos de 1/60 s, independente da resolução e da taxa de desenho.

## Controles

| Ação | Tecla |
| --- | --- |
| Direção | ← / → ou A / D |
| Acelerar | Espaço, ↑ ou W |
| Frear | ↓ ou S |
| Pausar / continuar | P ou Esc |
| Nova corrida | Enter ou R |
| Painel de códigos | **Ç** ou F2 |
| Som / tela cheia | M / F |

No celular, os botões aceitam múltiplos toques simultâneos. Gamepads de mapeamento padrão usam analógico/direcional, A ou RT para acelerar, LT ou baixo para frear e Start para pausar. A ajuda, o ranking e os códigos pausam a corrida. Fechar um painel retoma apenas se a corrida estava rodando antes de abri-lo. Trocar de aba pausa e silencia o motor imediatamente, exigindo retomada manual.

## Códigos

Pressione **Ç** (com cedilha), F2 ou o botão **CÓDIGOS**. Digite um ou vários códigos separados por espaços ou vírgulas. Maiúsculas e minúsculas são aceitas. Os poderes funcionam simultaneamente. Repetir um código individual desativa somente aquele poder.

| Código | Poder |
| --- | --- |
| `DETONA` | Explode o outro carro no impacto, conta a ultrapassagem e preserva a velocidade. |
| `NITRO` | Aceleração extra e velocidade máxima de **481 km/h**. |
| `ESCUDO` | Atravessa adversários sem sofrer colisão. A ultrapassagem só conta quando concluída. |
| `TRILHO` | Neutraliza gelo, deriva das curvas e desaceleração do acostamento. A direção continua manual. |
| `FAROL` | Restaura a visão à distância na neblina e revela os carros à noite. |
| `TEMPO` | Congela o relógio do dia. A corrida continua; repita o código para voltar a avançar os dias. |
| `QUANTUM` | Ativa todos os seis poderes. |
| `NORMAL` | Desativa todos os poderes. |

Exemplo: `DETONA NITRO ESCUDO`. Explosão tem prioridade sobre o escudo quando os dois estão ativos. **Uma corrida que utilizou poderes permanece na categoria Poderes**, mesmo depois de desativá-los. A categoria Clássico tem ranking e recordes separados. Os poderes persistem ao reiniciar a corrida; use `NORMAL` antes da próxima largada para correr no modo clássico.

## Imagem e desempenho

- **4K UHD:** Canvas de 3840 × 2160, em proporção 16:9. É a configuração inicial; o navegador adapta a apresentação ao tamanho da tela.
- **Full HD:** 1920 × 1080.
- **Automática:** ajusta a resolução ao tamanho da tela e à densidade de pixels, até 4K.
- Carros com pneus, suspensão, cockpit, piloto, aerofólios, sombras e lanternas; cenário em camadas, céu com iluminação por horário, vegetação, neblina e efeitos de explosão/nitro/escudo.
- Sprites e cenários são pré-renderizados e reutilizados; o cache mantém no máximo dois fundos. A cena não é redesenhada continuamente em título, pausa ou fim de corrida. O desenho fica limitado a 60 quadros/s; a simulação usa seu próprio passo fixo.
- A preferência de movimento reduzido elimina flashes de colisão e reduz partículas. A renderização em 4K aumenta o uso de memória; selecione Full HD ou Automática em aparelhos menos potentes.

## Progresso, backup e ranking

O progresso é salvo automaticamente a cada cinco segundos e também ao pausar, abrir painéis, mudar de aba ou sair da página. Ao voltar, a corrida aparece **pausada**, pronta para retomar. Limpar dados do navegador apaga o progresso local.

Em **Ranking**, escolha seu apelido, consulte as categorias Clássico/Poderes e exporte ou importe `enduro-progresso.json`. A importação exige confirmação, valida os dados e combina os rankings existentes; perfil e corrida salva são substituídos pelos recebidos. Recordes da versão anterior são migrados. Se o armazenamento estiver bloqueado, o jogo continua em memória e permite exportar um backup.

O ranking reúne resultados locais e os compartilhados com navegadores pareados. **Não é um ranking público global nem um sistema com autenticação/antifraude de servidor.** Não compartilhe backups com pessoas em quem não confia se desejar preservar a integridade do seu ranking casual.

## Dois navegadores: duelo e transferência

Clique em **Conectar** e escolha:

1. **Duelo fantasma + compartilhar ranking:** dois jogadores em tempo real, cada um controla seu próprio carro. O rival aparece como um fantasma azul, sem colisão entre jogadores. Os dois confirmam **Pronto para o duelo**; começa uma contagem regressiva e uma nova corrida. Pausar ou abrir um painel pausa os dois. Cada piloto pode usar os poderes; corridas assistidas são identificadas. A comparação é por distância, para uma disputa casual.
2. **Transferir perfil e corrida:** depois de parear, clique em **Enviar meu progresso** no dispositivo de origem. O destino precisa aceitar antes de substituir seu perfil e corrida; os rankings são combinados. Os dois dispositivos ficam com o mesmo perfil, mas não há sincronização permanente em segundo plano.

### Pareamento

1. O navegador A cria um convite e envia o código ao B por um meio de sua preferência.
2. O B cola o convite e clica em Receber código. Ele gera uma **resposta**, que deve enviar ao A.
3. O A cola a resposta e clica em Receber código. Aguarde a confirmação de conexão nos dois.
4. Mantenha as duas abas abertas. Convites expiram se a conexão não for concluída; gere um novo convite após desconectar.

O transporte usa **WebRTC / RTCDataChannel**, com sinalização manual e um serviço público STUN para descoberta de conexão. Não há servidor de contas, banco de dados, chaves privadas ou serviço de matchmaking. **Redes com NAT/firewalls restritivos podem impedir a conexão direta**, pois não há retransmissor TURN. Tente a mesma rede Wi-Fi ou use backup para transferir o progresso. Não é solicitada câmera nem microfone. Perfil, posição e resultados são enviados apenas ao navegador pareado.

## Arquitetura

| Arquivo | Responsabilidade |
| --- | --- |
| `index.html` / `styles.css` | Interface responsiva, HUD, controles e painéis |
| `src/engine.js` | Física, tráfego, regras, poderes e serialização validada da corrida |
| `src/renderer.js` | Cena 16:9, arte, efeitos, cache e resolução |
| `src/audio.js` | Áudio sintetizado, silêncio imediato e isolamento de falhas |
| `src/storage.js` | Perfis locais, recordes, migração, backup e validação |
| `src/peer.js` | Conexão WebRTC, convites/respostas e transporte de mensagens |
| `src/app.js` | Entrada, ciclo de jogo, painéis, salvamento e duelo |

A execução do jogo não exige dependências nem build. Abra `index.html` ou sirva a pasta por HTTP. Os arquivos JS/CSS são locais; não há bibliotecas carregadas por CDN.

## Desenvolvimento e verificação

Node.js 22 ou superior:

```sh
npm ci
npm test
npx playwright install --with-deps chromium firefox webkit
npm run test:browser
```

Para servir localmente:

```sh
npm run serve
# http://127.0.0.1:4173
```

Os testes de motor cobrem as regras originais, cinco dias completos, todos os poderes, combinações, limites, restauração determinística, validação de backups, categorias do ranking e falhas de áudio/armazenamento. Os testes de navegador verificam teclado/Ç, foco, pausa, ausência de redesenho em pausa, 4K/Full HD, salvamento após recarregar, toque, layout de celular e falhas de APIs opcionais. O Chromium também verifica dois peers reais, pausa compartilhada e transferência com confirmação.

A rotina `.github/workflows/test.yml` executa os testes em pushes para `main` e pull requests, com Chromium, Firefox e WebKit. Capturas são anexadas ao workflow em caso de falha. Testes automatizados de celular não substituem uma sessão em cada aparelho físico, especialmente para áudio, fullscreen e gamepads.

## Publicar

GitHub Pages: **Deploy from a branch → main → / (root)**. `.nojekyll` mantém a publicação estática. Não inclua credenciais no repositório. Para um ranking global autenticado, matchmaking ou garantia de conexão em redes restritivas, será necessário adicionar os serviços correspondentes; esta versão funciona sem eles.

Enduro e Activision pertencem a seus respectivos titulares. Projeto independente, sem afiliação com os criadores do original. Pista, gráficos, física e sons foram reconstruídos; não é emulação nem cópia exata da ROM.
