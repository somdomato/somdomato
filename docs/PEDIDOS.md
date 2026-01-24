# Sistema de Pedidos de Músicas

## Visão Geral

Sistema completo para usuários pedirem músicas na rádio, com proteções contra repetições e interface elegante e responsiva.

## Acesso

Acesse a página de pedidos em: `http://localhost:3000/pedidos`

## Funcionalidades

### Para Usuários

1. **Página de Entrada**
   - Botão destacado para abrir o catálogo de músicas
   - Design atraente e intuitivo

2. **Modal de Busca**
   - Busca em tempo real por:
     - Artista
     - Título da música
     - Nome do arquivo
   - Tabela paginada com resultados
   - Visualização de capa da música
   - Botão de pedido para cada música

3. **Proteções Automáticas**
   - Música não pode estar nas últimas 100 tocadas
   - Música não pode já estar na fila de pedidos
   - Artista não pode ter tocado nas últimas 10 músicas
   - Feedback claro quando música não pode ser pedida

### Design

✅ **Responsivo**: Adapta-se perfeitamente a mobile, tablet e desktop
✅ **Elegante**: Design moderno com gradientes e sombras
✅ **Cores do Site**: Usa a paleta de cores da rádio (#df8f2d, #2c2525, #394634)
✅ **Feedback Visual**: Toasts informativos e estados de loading
✅ **Acessível**: Ícones intuitivos e labels claros

## Estrutura Técnica

### Arquivos Criados

- [src/app/pedidos/actions.ts](../src/app/pedidos/actions.ts) - Server actions para busca e pedidos
- [src/app/pedidos/page.tsx](../src/app/pedidos/page.tsx) - Página de entrada
- [src/components/RequestModal.tsx](../src/components/RequestModal.tsx) - Modal de busca e pedidos

### Server Actions

#### `searchSongs({ query, page, limit })`
- Busca músicas por artista, título ou arquivo
- Retorna resultados paginados
- Suporta busca em tempo real

#### `requestSong(songId)`
- Adiciona música à fila
- Valida usando sistema de proteções existente
- Incrementa contador de pedidos da música
- Retorna feedback de sucesso/erro

### Proteções

O sistema usa o módulo existente `src/lib/protections.ts`:

- `checkMusicRepetition()`: Valida se música pode ser pedida
- Verifica histórico, pedidos pendentes e artistas recentes
- Mensagens de erro personalizadas para cada tipo de restrição

### Integração

O sistema se integra perfeitamente com:
- ✅ Sistema de reprodução existente
- ✅ Fila de pedidos do admin
- ✅ Sistema de proteções
- ✅ Banco de dados Drizzle
- ✅ Revalidação automática do Next.js

## Fluxo de Uso

1. Usuário acessa `/pedidos`
2. Clica em "Abrir Catálogo de Músicas"
3. Modal abre com lista de músicas
4. Usuário busca música desejada
5. Clica em "Pedir"
6. Sistema valida proteções
7. Se OK: Música vai para a fila
8. Se não: Mostra mensagem explicativa
9. Toast confirma sucesso/erro

## Recursos Mobile

- Tabela adaptativa que esconde coluna "Música" em telas pequenas
- Botões e textos ajustam tamanho para mobile
- Modal responsivo com scroll adequado
- Input de busca otimizado para telas pequenas
- Paginação compacta e funcional

## Tecnologias

- Next.js 16 Server Actions
- React Hooks
- Drizzle ORM
- Lucide React (ícones)
- Sonner (toasts)
- TailwindCSS (responsividade)

## Segurança

- ✅ Validação server-side de todos os pedidos
- ✅ Proteções contra spam e repetição
- ✅ Sanitização de queries de busca
- ✅ Rate limiting implícito (proteções de repetição)
