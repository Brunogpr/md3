# MOLDEA.es — site e loja online

*Creamos ideas en 3D.* Site em Astro (renderizado no servidor) com catálogo, loja com Stripe Checkout,
painel para o cliente cadastrar produtos e pedidos de orçamento por WhatsApp.

| Peça | Tecnologia |
| --- | --- |
| Site e painel | Astro 7 + TypeScript (páginas renderizadas no servidor) |
| Base de dados | libSQL/SQLite com Drizzle ORM — ficheiro local em desenvolvimento, **Turso** em produção |
| Fotografias | **Netlify Blobs** em produção (pasta `data/uploads` em desenvolvimento), otimizadas para WebP |
| Pagamentos | **Stripe Checkout** (página de pagamento da Stripe; os dados do cartão nunca passam pelo site) |
| Alojamento | **Netlify** (plano gratuito, permite uso comercial); domínio no DNS da HostGator |
| Testes | Vitest (unidade, com SQLite temporário) e Playwright (navegador, com pagamentos simulados) |

## Correr localmente

Requisitos: Node.js 22.18+ (testado com Node 24).

```bash
npm install
npm run setup                     # cria data/moldea.db, aplica migrações e o produto inicial
npm run admin:create -- voce@email.com "palavra-passe-forte"   # utilizador do painel
npm run dev                       # http://localhost:4321  ·  painel: http://localhost:4321/admin
```

Para testar compras sem chaves da Stripe: `PAYMENTS_FAKE=true npm run dev` (simula um pagamento
aprovado; recusado em produção). Com chaves de teste da Stripe, copie `.env.example` para `.env`.

| Comando | O que faz |
| --- | --- |
| `npm run dev` / `build` / `preview` | Desenvolvimento, build, pré-visualização do build |
| `npm run check` · `lint` · `test` · `test:e2e` | Tipos · ESLint · testes de unidade · testes no navegador (Edge) |
| `npm run verify` | Tudo acima em sequência |
| `npm run db:generate` | Cria uma migração depois de alterar `src/server/db/schema.ts` |
| `npm run db:migrate` | Aplica migrações à base de `DATABASE_URL` |
| `npm run db:seed` | Cria o produto inicial (só se não houver produtos) |
| `npm run admin:create -- email "senha"` | Cria um utilizador do painel ou redefine a palavra-passe (termina as sessões dele) |
| `npm run assets` | Regenera logo, camadas do banner, ícones e imagem social a partir de `assets-originais/` |

Os testes no navegador usam uma base própria (`data/e2e.db`, recriada a cada execução) e compilam para
`dist-e2e/`.

## Painel de administração (`/admin`)

- **Produtos:** nome, resumo e descrição (PT, ES e EN), categorias, preço com IVA, stock, publicado/oculto,
  "Mostrar na página inicial" (máximo 4), ordem e várias fotografias (a primeira é a principal; cada uma tem descrição para leitores de
  ecrã e Google). Preço vazio = "Preço sob consulta" (sem compra online, só orçamento).
- **Encomendas:** criadas quando o cliente vai pagar; passam a "Paga — por enviar" quando a Stripe confirma.
  O stock é descontado automaticamente uma única vez. Estados: enviada, concluída, cancelada. Reembolsos
  fazem-se no painel da Stripe.
- **Configurações:** ativar a loja, portes (fixos e grátis a partir de um valor), países de envio e os
  endereços dos documentos legais.

Segurança: palavras-passe com scrypt; sessão em cookie `HttpOnly`/`Secure`/`SameSite=Lax` (na base só fica o
hash do token); bloqueio de 15 min após 5 tentativas falhadas; formulários protegidos contra pedidos de outra
origem; painel com `noindex` e sem cache; uploads validados (imagem real, até 8 MB, metadados removidos).

### Quando aparece o carrinho

O botão "Adicionar ao carrinho" e o carrinho só aparecem quando **as três condições** se verificam:

1. Stripe configurado (`STRIPE_SECRET_KEY`);
2. Aviso legal, Política de privacidade e Condições de venda preenchidos nas Configurações
   (obrigatórios em Espanha: LSSI-CE, RGPD e direito de desistência de 14 dias);
3. "Loja ativa" ligado nas Configurações.

Até lá, os produtos aparecem com preço (se tiverem) e com pedido de orçamento.

## Publicar na Netlify

O `netlify.toml` já define o build (`npm run db:migrate && npm run build`, Node 24). As fotografias vão
para o Netlify Blobs automaticamente (sem configuração).

1. **Base de dados (Turso, grátis):** em [turso.tech](https://turso.tech) crie uma base de dados e copie o
   *Database URL* (`libsql://…`) e um *token* (Create token).
2. **Site:** em [app.netlify.com](https://app.netlify.com) → *Add new site → Import an existing project* →
   GitHub → escolher este repositório. Não é preciso mudar as opções de build.
3. **Variáveis** (*Site configuration → Environment variables*):
   - `DATABASE_URL` e `DATABASE_AUTH_TOKEN` (Turso);
   - `STRIPE_SECRET_KEY` (comece por `sk_test_…`);
   - `STRIPE_WEBHOOK_SECRET` (passo 5).

   Depois: *Deploys → Trigger deploy*. As migrações da base de dados correm em cada deploy.
4. **Primeiro acesso ao painel:** no seu computador, crie um `.env` com `DATABASE_URL` e
   `DATABASE_AUTH_TOKEN` de produção e execute `npm run db:seed` (opcional: produto inicial) e
   `npm run admin:create -- email@cliente.com "palavra-passe"`.
5. **Webhook da Stripe:** em [dashboard.stripe.com](https://dashboard.stripe.com) → *Developers → Webhooks →
   Add endpoint*: URL `https://SEU-DOMINIO/api/stripe/webhook`, eventos `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` e
   `checkout.session.expired`. Copie o *Signing secret* (`whsec_…`) para `STRIPE_WEBHOOK_SECRET` e faça
   novo deploy.
6. **Domínio:** na Netlify, *Domain management → Add a domain* → `m3d.trustec.com.br`. A Netlify indica o
   registo a criar (normalmente `CNAME m3d → <nome-do-site>.netlify.app`). O DNS de `trustec.com.br` está na
   HostGator: no cPanel → *Zone Editor* → apague o registo `A` atual de `m3d` e crie o `CNAME` indicado. O
   HTTPS é emitido automaticamente. O domínio principal `trustec.com.br` não é afetado.
7. **Passar a pagamentos reais:** ative a conta Stripe (dados da empresa, IBAN), troque para `sk_live_…`, crie
   o webhook também em modo *live* e atualize `STRIPE_WEBHOOK_SECRET`.

Segurança: no site publicado, a aplicação recusa uma base de dados em ficheiro e o modo de pagamento simulado
(`PAYMENTS_FAKE`).

## Pedidos de orçamento por WhatsApp

O número está em `src/config/site.ts` (`+34 742 09 50 84`). O formulário valida os dados, monta a mensagem e
abre `https://wa.me/34742095084?text=…`; o pedido só chega quando o visitante o envia no WhatsApp (o site
avisa disso e oferece um botão caso o navegador bloqueie a nova aba). O site não guarda nem envia os dados.

## Páginas

| Página | PT | ES | EN |
| --- | --- | --- | --- |
| Inicial (4 produtos escolhidos no painel) | `/` | `/es/` | `/en/` |
| Todos os produtos (com filtros) | `/produtos/` | `/es/productos/` | `/en/products/` |
| Produto | `/produtos/<slug>/` | `/es/productos/<slug>/` | `/en/products/<slug>/` |

Na página inicial aparecem os produtos marcados com "Mostrar na página inicial" (máx. 4, pela ordem do
catálogo); se nenhum estiver marcado, os 4 primeiros. O primeiro aparece também em "Produto em destaque".

## Banner e o dragão

O banner é composto por camadas recortadas do original `assets-originais/moldea-es-logo-dragao-original.jpg`
(bico, letra M, "MOLDEA.es", slogan); o M é "impresso" camada a camada.

O dragão tem dois modos, escolhidos em `src/config/site.ts` → `bannerDragon`:

- **`animado`**: dragão articulado montado com as peças de `assets-originais/dragao-pecas.png`
  (cabeça, corpo, cauda, mãos e pés, separados por `scripts/prepare-dragon.mjs`; componente
  `src/components/DragonRig.astro`). Anda por cima das letras com passos curtos (um pé de cada vez) e mexe a cabeça;
  braços, cauda e corpo ficam fixos. Olha à volta e salta; clicar nele faz olhar/saltar. Coreografia em `src/scripts/dragon-walk.ts`;
  pré-visualização dos estados em `/admin/dragao`.
- **`imagem`** (atual): o PNG original `assets-originais/dragao.png` atrás do M, com movimentos no lugar (espreitar,
  saltar, respirar). Depois de trocar ficheiros em `assets-originais/`, execute `npm run assets`.

Todas as animações desligam-se quando o sistema pede "reduzir movimento". O site usa só o tema claro.

## Idiomas

Português (por omissão), espanhol e inglês, com seletor no cabeçalho que leva à página equivalente. Textos da
interface em `src/i18n/pt.ts`, `es.ts` e `en.ts` (mesma estrutura, verificada pelos testes). Os produtos têm
campos PT, ES e EN no painel; um campo vazio usa o texto em português. Os textos em espanhol e inglês foram
escritos por mim e devem ser revistos por um falante nativo antes da publicação.

## Verificações depois de publicar

- [ ] `https://m3d.trustec.com.br/` abre com cadeado; banner, logo e fotografias carregam (F12, sem erros).
- [ ] `/admin` pede login; o painel abre com o utilizador criado.
- [ ] Criar um produto com foto e preço; aparece no site.
- [ ] Configurações: preencher documentos legais e ativar a loja; o carrinho aparece.
- [ ] Compra de teste com o cartão `4242 4242 4242 4242` (modo teste): volta à página "Obrigado", a
      encomenda aparece como paga no painel e o stock desce.
- [ ] Na Stripe → Webhooks, o envio do evento mostra `200`.
- [ ] Formulário de orçamento abre o WhatsApp com a mensagem; enviar e confirmar que chega ao número.
- [ ] `robots.txt` e `sitemap.xml` apontam para o domínio certo.
