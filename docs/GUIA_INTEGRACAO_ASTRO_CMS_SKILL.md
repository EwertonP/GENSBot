# GUIA DE INTEGRAÇÃO OFICIAL: ASTRO ➔ GENSBOT HEADLESS CMS
> **Destinado para:** Skills do Cloud Code, Prompts de Agentes e Desenvolvedores de Front-end Astro da Agência GENSBot.
> **Objetivo:** Padronizar a criação de blogs e páginas de conteúdo em sites Astro de clientes, garantindo que 100% dos artigos herdem o Design System, tokens e conversões configurados no CMS da Cloudflare.

---

## 1. Visão Geral da Arquitetura

O ecossistema opera no modelo **Headless Jamstack na Cloudflare**:

```
┌──────────────────────────────────────────────────────────────┐
│                    GENSBot Headless CMS                      │
│             (Cloudflare Workers + D1 + R2)                   │
│                                                              │
│  - Cadastro do Tenant (Cores, Fontes, WhatsApp, Autor)       │
│  - Gestão de Matérias (Título, Rich Text, SEO, Capa)         │
│  - Webhook DeployHook para reconstrução automática           │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               │ JSON REST API
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                 Site do Cliente em Astro                     │
│               (Cloudflare Pages / Workers)                   │
│                                                              │
│  - src/lib/cms.ts (SDK Conector)                             │
│  - src/pages/blog/index.astro (Vitrine de Matérias)          │
│  - src/pages/blog/[slug].astro (Template da Matéria)         │
│  - src/pages/api/preview.ts (Live Preview Iframe)            │
│  - Herança de Layout e Design System do Site Principal      │
└──────────────────────────────────────────────────────────────┘
```

### Princípio Fundamental:
> **O site Astro é o "molde" visual do cliente.**  
> O redator ou a inteligência artificial no CMS **apenas escreve texto e insere imagens**. Eles nunca configuram cores, fontes ou tamanhos manualmente. É o Astro que "veste" o conteúdo puro com o layout, tipografia e botões do cliente de forma 100% automática.

---

## 2. Estrutura Canônica de Pastas no Astro

Ao inicializar ou atualizar qualquer site de cliente em Astro, certifique-se de que a seguinte estrutura de arquivos esteja presente:

```
seu-site-astro/
├── .env                              <-- Variáveis de conexão com o CMS
├── src/
│   ├── layouts/
│   │   └── Layout.astro              <-- Layout mestre do cliente (com Header/Footer)
│   ├── lib/
│   │   └── cms.ts                    <-- SDK de comunicação tipado com o CMS
│   └── pages/
│       ├── blog/
│       │   ├── index.astro           <-- Vitrine de posts do blog (site.com/blog)
│       │   └── [slug].astro          <-- Matéria individual (site.com/blog/meu-post)
│       └── api/
│           └── preview.ts            <-- Endpoint de Live Preview para o CMS
```

---

## 3. Código Pronto para Uso (Copy & Paste)

### 3.1. Conector Tipado com o CMS (`src/lib/cms.ts`)

Crie este arquivo para encapsular as chamadas da API do CMS:

```ts
/**
 * SDK Conector GENSBot CMS para Astro
 */

export interface TenantTheme {
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: 'paper' | 'white' | 'dark';
  layoutPreset?: 'clinical-clean' | 'editorial-journal' | 'tech-minimal' | 'modern-bold';
  fontHeading?: string;
  fontBody?: string;
}

export interface TenantWhatsApp {
  enabled: boolean;
  phoneNumber?: string;
  position?: 'both' | 'bottom' | 'floating';
  buttonText?: string;
  customMessage?: string;
}

export interface TenantAuthor {
  name?: string;
  role?: string;
  bio?: string;
  avatar?: {
    url?: string;
    alt?: string;
  };
}

export interface TenantData {
  id: string | number;
  name: string;
  slug: string;
  domain?: string;
  theme?: TenantTheme;
  whatsappCta?: TenantWhatsApp;
  defaultAuthor?: TenantAuthor;
}

export interface BlogPost {
  id: string | number;
  title: string;
  slug: string;
  excerpt?: string;
  contentHtml?: string;
  content?: any;
  publishedAt: string;
  readTime?: number;
  featured?: boolean;
  coverImage?: {
    url: string;
    alt?: string;
  };
  category?: {
    name: string;
    slug: string;
  };
}

// Configurações do ambiente
const CMS_URL = import.meta.env.PUBLIC_CMS_URL || 'https://gensbot-cms.ewertonphillipe18.workers.dev';
const TENANT_SLUG = import.meta.env.PUBLIC_TENANT_SLUG || 'prevmed';

/**
 * Busca os tokens de design e dados do cliente/tenant
 */
export async function getTenant(slug = TENANT_SLUG): Promise<TenantData | null> {
  try {
    const res = await fetch(`${CMS_URL}/api/tenants?where[slug][equals]=${slug}`);
    if (!res.ok) return null;
    const json = await res.json();
    return json.docs?.[0] || null;
  } catch (err) {
    console.error('Erro ao buscar tenant no CMS:', err);
    return null;
  }
}

/**
 * Busca todas as matérias publicadas do cliente
 */
export async function getPosts(options: {
  categorySlug?: string;
  limit?: number;
  featuredOnly?: boolean;
} = {}): Promise<BlogPost[]> {
  const limit = options.limit || 30;
  let query = `${CMS_URL}/api/posts?where[tenant.slug][equals]=${TENANT_SLUG}&where[status][equals]=published&limit=${limit}&sort=-publishedAt`;

  if (options.featuredOnly) {
    query += `&where[featured][equals]=true`;
  }

  if (options.categorySlug) {
    query += `&where[category.slug][equals]=${options.categorySlug}`;
  }

  try {
    const res = await fetch(query);
    if (!res.ok) return [];
    const json = await res.json();
    return json.docs || [];
  } catch (err) {
    console.error('Erro ao buscar posts no CMS:', err);
    return [];
  }
}

/**
 * Busca uma matéria específica pelo slug
 */
export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  try {
    const res = await fetch(
      `${CMS_URL}/api/posts?where[tenant.slug][equals]=${TENANT_SLUG}&where[slug][equals]=${slug}`
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.docs?.[0] || null;
  } catch (err) {
    console.error('Erro ao buscar matéria:', err);
    return null;
  }
}
```

---

### 3.2. A Vitrine de Matérias (`src/pages/blog/index.astro`)

Renderiza a lista de artigos respeitando o Layout mestre do cliente:

```astro
---
import Layout from '../../layouts/Layout.astro';
import { getPosts, getTenant } from '../../lib/cms';

const posts = await getPosts();
const tenant = await getTenant();

const primaryColor = tenant?.theme?.primaryColor || '#00DC94';
---

<Layout
  title={`Blog & Artigos | ${tenant?.name || 'Clínica'}`}
  description="Confira nossos artigos mais recentes, orientações de especialistas e novidades."
>
  <main class="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
    <!-- Cabeçalho da Seção de Blog -->
    <header class="max-w-2xl mb-12 sm:mb-16">
      <span
        class="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3"
        style={`background-color: ${primaryColor}15; color: ${primaryColor};`}
      >
        Conteúdos & Saúde
      </span>
      <h1 class="text-3xl sm:text-5xl font-extrabold tracking-tight">
        Blog & Orientações
      </h1>
      <p class="text-sm sm:text-base opacity-75 mt-3 leading-relaxed">
        Artigos educativos produzidos diretamente pela nossa equipe técnica para manter você sempre informado.
      </p>
    </header>

    <!-- Estado Vazio -->
    {posts.length === 0 ? (
      <div class="text-center py-16 p-8 rounded-3xl bg-black/5 border border-black/5">
        <p class="text-sm opacity-60">Nenhuma matéria publicada no momento. Novos artigos em breve!</p>
      </div>
    ) : (
      <!-- Grid de Matérias Responsivo -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {posts.map((post) => (
          <article class="group flex flex-col bg-white rounded-3xl overflow-hidden border border-black/5 shadow-xs hover:shadow-md hover:-translate-y-1 transition-all duration-300">
            {post.coverImage?.url && (
              <a href={`/blog/${post.slug}`} class="aspect-video overflow-hidden bg-black/5 relative">
                <img
                  src={post.coverImage.url}
                  alt={post.coverImage.alt || post.title}
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              </a>
            )}

            <div class="p-6 flex-1 flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between text-[11px] opacity-60 mb-2">
                  <span>{new Date(post.publishedAt).toLocaleDateString('pt-BR')}</span>
                  {post.readTime && <span>{post.readTime} min de leitura</span>}
                </div>

                <a href={`/blog/${post.slug}`} class="block">
                  <h2 class="text-lg font-bold leading-snug group-hover:text-emerald-700 transition-colors">
                    {post.title}
                  </h2>
                </a>

                {post.excerpt && (
                  <p class="text-xs opacity-75 mt-2 line-clamp-3 leading-relaxed">
                    {post.excerpt}
                  </p>
                )}
              </div>

              <div class="pt-4 mt-4 border-t border-black/5 flex items-center justify-between">
                <span class="text-xs font-semibold" style={`color: ${primaryColor}`}>
                  Ler artigo completo →
                </span>
                {post.category?.name && (
                  <span class="text-[10px] px-2 py-0.5 rounded-full bg-black/5 opacity-70 font-medium">
                    {post.category.name}
                  </span>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    )}
  </main>
</Layout>
```

---

### 3.3. A Página da Matéria Individual (`src/pages/blog/[slug].astro`)

Renderiza a matéria aberta com formatação automática de rich text e botão de WhatsApp:

```astro
---
import Layout from '../../layouts/Layout.astro';
import { getPostBySlug, getPosts, getTenant } from '../../lib/cms';

// 1. Gera caminhos estáticos para velocidade instantânea na Cloudflare
export async function getStaticPaths() {
  const posts = await getPosts();
  return posts.map((post) => ({
    params: { slug: post.slug },
  }));
}

const { slug } = Astro.params;
const post = await getPostBySlug(slug as string);
const tenant = await getTenant();

if (!post) {
  return Astro.redirect('/404');
}

const primaryColor = tenant?.theme?.primaryColor || '#00DC94';
const wa = tenant?.whatsappCta;
const waUrl = wa?.phoneNumber
  ? `https://wa.me/${wa.phoneNumber.replace(/\D/g, '')}?text=${encodeURIComponent(wa.customMessage || 'Olá! Li um artigo no blog e gostaria de agendar uma consulta.')}`
  : null;
---

<Layout
  title={`${post.title} | ${tenant?.name || 'Blog'}`}
  description={post.excerpt}
>
  <article class="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
    <!-- Cabeçalho do Artigo -->
    <header class="mb-10">
      <div class="flex items-center gap-2 mb-4">
        <a href="/blog" class="text-xs font-bold hover:underline opacity-60">← Voltar ao Blog</a>
        {post.category?.name && (
          <>
            <span class="opacity-40">•</span>
            <span class="text-xs font-bold uppercase tracking-wider" style={`color: ${primaryColor}`}>
              {post.category.name}
            </span>
          </>
        )}
      </div>

      <h1 class="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
        {post.title}
      </h1>

      <div class="flex items-center gap-3 mt-4 text-xs opacity-60">
        <span>Publicado em {new Date(post.publishedAt).toLocaleDateString('pt-BR')}</span>
        {post.readTime && <span>• {post.readTime} min de leitura</span>}
      </div>

      <!-- Imagem de Capa -->
      {post.coverImage?.url && (
        <div class="mt-8 rounded-3xl overflow-hidden aspect-video bg-black/5 shadow-md">
          <img
            src={post.coverImage.url}
            alt={post.coverImage.alt || post.title}
            class="w-full h-full object-cover"
          />
        </div>
      )}
    </header>

    <!-- Resumo / Lead do Post -->
    {post.excerpt && (
      <div
        class="text-base sm:text-lg font-medium leading-relaxed opacity-85 mb-8 border-l-4 pl-4"
        style={`border-color: ${primaryColor}`}
      >
        {post.excerpt}
      </div>
    )}

    <!-- Corpo do Artigo Renderizado (Tailwind Prose herda os estilos) -->
    <div class="prose prose-lg max-w-none text-[#192313] dark:text-zinc-100">
      {post.contentHtml ? (
        <div set:html={post.contentHtml} />
      ) : (
        <p>{post.excerpt}</p>
      )}
    </div>

    <!-- Bloco de Conversão Automático (WhatsApp da Clínica) -->
    {wa?.enabled && waUrl && (
      <div class="my-12 p-6 sm:p-8 rounded-3xl bg-black/5 border border-black/5 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <span class="text-[11px] font-bold uppercase tracking-wider opacity-60 block mb-1">
            Atendimento Direto
          </span>
          <h3 class="text-lg font-bold">Ficou com alguma dúvida sobre o assunto?</h3>
          <p class="text-xs sm:text-sm opacity-70 mt-1 max-w-md">
            Converse diretamente com nosso time de especialistas para tirar dúvidas ou agendar uma avaliação.
          </p>
        </div>

        <a
          href={waUrl}
          target="_blank"
          rel="noreferrer"
          class="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-xs sm:text-sm font-bold text-white shadow-md hover:scale-105 active:scale-95 transition-all shrink-0"
          style={`background-color: ${primaryColor}`}
        >
          <span>{wa.buttonText || 'Falar no WhatsApp'}</span>
        </a>
      </div>
    )}

    <!-- Assinatura do Especialista / Autor Padrão -->
    {tenant?.defaultAuthor?.name && (
      <div class="my-8 p-6 rounded-3xl bg-black/5 border border-black/5 flex items-start gap-4">
        {tenant.defaultAuthor.avatar?.url ? (
          <img
            src={tenant.defaultAuthor.avatar.url}
            alt={tenant.defaultAuthor.name}
            class="w-14 h-14 rounded-2xl object-cover shrink-0 border border-black/10"
          />
        ) : (
          <div class="w-14 h-14 rounded-2xl bg-black/10 flex items-center justify-center text-lg font-bold shrink-0">
            {tenant.defaultAuthor.name.charAt(0)}
          </div>
        )}

        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <h4 class="text-sm font-bold">{tenant.defaultAuthor.name}</h4>
            {tenant.defaultAuthor.role && (
              <span class="text-[11px] font-semibold opacity-70 px-2 py-0.5 rounded-md bg-black/5">
                {tenant.defaultAuthor.role}
              </span>
            )}
          </div>
          {tenant.defaultAuthor.bio && (
            <p class="text-xs opacity-75 mt-1.5 leading-relaxed">
              {tenant.defaultAuthor.bio}
            </p>
          )}
        </div>
      </div>
    )}
  </article>
</Layout>
```

---

### 3.4. Endpoint de Live Preview (`src/pages/api/preview.ts`)

Permite que o redator digite no CMS e o iframe mostre o site Astro real do cliente em tempo real:

```ts
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request, redirect }) => {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');

  if (!slug) {
    return new Response('Slug ausente para preview', { status: 400 });
  }

  // Redireciona internamente para a rota do blog com preview ativado
  return redirect(`/blog/${slug}?preview=true`, 307);
};
```

---

## 4. Variáveis de Ambiente no Astro (`.env`)

No repositório do site Astro e no painel do Cloudflare Pages / Workers:

```env
PUBLIC_CMS_URL=https://gensbot-cms.ewertonphillipe18.workers.dev
PUBLIC_TENANT_SLUG=slug-do-cliente-no-cms
```

---

## 5. Como Configurar a Atualização Instantânea (Deploy Hook)

1. No painel da **Cloudflare Pages / Workers** do cliente, vá em:
   `Settings > Builds & Deployments > Deploy Hooks > Add Deploy Hook`.
2. Nomeie como `GENSBot CMS Trigger` (branch `main`).
3. Copie a URL gerada (ex: `https://api.cloudflare.com/client/v4/pages/scripts/build-hook/...`).
4. Cole essa URL no CMS em:
   `Clientes / Sites (Tenants) > [Cliente] > Campo "Deploy Hook da Cloudflare Pages"`.
5. **Pronto!** Sempre que uma matéria for publicada ou editada no CMS, o webhook é chamado e a Cloudflare recompila o blog em segundos automaticamente.

---

## 6. INSTRUÇÕES PARA A SKILL DO CLOUD CODE (Prompt Template)

Copie e cole este bloco dentro das instruções da sua **Skill no Cloud Code**:

```markdown
### REGRA DE CRIAÇÃO DE BLOG & ARTIGOS (GENSBOT CMS):
1. Todo site de cliente desenvolvido em Astro DEVE conter a funcionalidade de blog integrada ao GENSBot CMS.
2. Crie sempre os seguintes arquivos:
   - `src/lib/cms.ts`: SDK de comunicação tipado.
   - `src/pages/blog/index.astro`: Vitrine de matérias consumindo `getPosts()`.
   - `src/pages/blog/[slug].astro`: Página individual de artigo com `getStaticPaths()`.
   - `src/pages/api/preview.ts`: Endpoint de Live Preview.
3. Não crie posts estáticos locais; todos os conteúdos devem ser consumidos de `${PUBLIC_CMS_URL}/api/posts?where[tenant.slug][equals]=${PUBLIC_TENANT_SLUG}`.
4. Mantenha o mesmo `Layout.astro` do site do cliente para que o blog tenha exatamente o mesmo cabeçalho, rodapé e cores institucionais.
5. Inclua o bloco de conversão de WhatsApp e o cartão de autor no final de cada matéria, respeitando os dados vindos do Tenant no CMS.
```
