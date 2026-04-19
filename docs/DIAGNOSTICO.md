# Diagnóstico de Problemas - Somdomato Radio

Data: 2026-04-03

## Problemas Identificados

### 1. ✅ CORRIGIDO: Bloco "Top 10" mostra "Nenhum pedido ainda"

**Causa**: Em `/api/admin/play/route.ts`, o evento Socket `song:changed` não incluía os campos `wasRequested` e `playedOnMountpoint`.

**Sintoma**:
- Top 10 permanencia vazio mesmo com múltiplos pedidos
- Funcionava apenas quando Liquidsoap reproduzia (via `/api/music/started`)

**Solução Aplicada**:
- Adicionado `wasRequested: false` e `playedOnMountpoint` ao evento em `/api/admin/play/route.ts:102-110`

### 2. ✅ CORRIGIDO: Bloco "Últimas" filtra por gênero incorretamente

**Causa**: Mesmo problema - o evento não incluía `playedOnMountpoint`, então o frontend usava apenas `genre` como fallback.

**Sintoma**:
- "Últimas" mostrava "Nenhuma música tocada ainda neste gênero" quando havia histórico em outros gêneros
- Frontend filtrava incorretamente o histórico

**Solução Aplicada**:
- Adicionado `playedOnMountpoint: selectedSong.genre || "geral"` ao evento

### 3. ✅ MELHORADO: Erro ao renomear arquivo ENOENT

**Causa**: Arquivo pode ter sido deletado entre a leitura do DB e a tentativa de renomear.

**Sintoma**:
```
⨯ Error: Erro ao renomear arquivo: ENOENT: no such file or directory
rename '/var/music/sdm/A Galera Do Chapéu - Fernando & Sorocaba...'
```

**Solução Aplicada**:
- Adicionada verificação `fs.access()` antes de `fs.rename()` em `/src/actions/admin.ts:200-210`
- Melhorado logging com informações de caminho para diagnóstico

### 4. ⚠️ PENDENTE: Capas não aparecem ("isn't a valid image received null")

**Causa Provável**:
- Arquivo de capa não existe em `/public/covers/` quando Next.js tenta validar
- Permissões de arquivo insuficientes
- Arquivo corrompido ou inválido

**Sintoma**:
```
Apr 03 04:52:21 tyche pnpm[131212]: ⨯ The requested resource isn't a valid image
for /covers/bruno-e-marrone.jpg received null
```

**Investigação necessária**:
1. Verificar existência de arquivos em `/public/covers/`
```bash
ls -lah /var/www/somdomato/public/covers/
```

2. Verificar se diretório tem permissões corretas:
```bash
ls -ld /var/www/somdomato/public/covers/
```

3. Comparar com sistema local via Docker:
```bash
docker exec somdomato-nextjs ls -lah /app/public/covers/
```

**Possíveis Soluções**:
- Regenerar capas: `pnpm run sync-music` no servidor
- Verificar integridade dos arquivos
- Garantir permissões 755 para diretório e 644 para arquivos

### 5. ⚠️ PENDENTE: Proxy.ts bloqueando API (se houver)

**Análise**: O arquivo `proxy.ts` está CORRETO:
- Matcher `["/admin/:path*", "/api/admin/:path*"]` protege apenas rotas admin
- Rotas públicas como `/api/music`, `/api/requests`, `/api/songs/next` NÃO são bloqueadas
- Liquidsoap consegue chamar `/api/music` normalmente

**Conclusão**: Isso NÃO está bloqueando as APIs públicas.

## Arquivos Modificados

- ✅ `/src/app/api/admin/play/route.ts` - Adicionado `wasRequested` e `playedOnMountpoint` ao evento Socket
- ✅ `/src/actions/admin.ts` - Melhorado tratamento de erro ao renomear arquivo
- ✅ `/README.md` - Documentado que Next.js 16+ usa `proxy.ts` em vez de `middleware.ts`
- ✅ `/memory/MEMORY.md` - Criado arquivo de memória para próximas interações

## Próximas Ações Recomendadas

### Imediato
1. Fazer deploy das mudanças corrigidas
2. Testar blocos "Top 10" e "Últimas" no servidor
3. Verificar logs de erro ao renomear arquivo

### Investigação
1. Analisar problema de capas no servidor
2. Verificar sincronização de histórico entre múltiplas instâncias
3. Validar integridade de arquivo de covers após sync

## Referências

- **Proxy**: `src/proxy.ts:31-54` (função `proxy`)
- **Socket Events**: `src/app/api/music/started/route.ts:49-60`
- **Admin Play**: `src/app/api/admin/play/route.ts:88-110`
- **Last Block**: `src/components/blocks/Last.tsx:20-105`
- **Top Block**: `src/components/blocks/Top.tsx:17-67`
