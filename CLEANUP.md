# Limpeza do Projeto - Som do Mato

## 🗑️ Arquivos Removidos

### Scripts Desnecessários (8 arquivos)
- ❌ `add-genre-column.sh` - Script de migration one-time
- ❌ `check-timeslots.sh` - Script de debug específico
- ❌ `diagnose-api.sh` - Script de debug específico
- ❌ `docker.sh` - Redundante com dev.sh
- ❌ `perms.sh` - Script one-time de permissões
- ❌ `reset.sh` - Script de reset/debug
- ❌ `sync.sh` - Redundante com sync-music.sh
- ❌ `test-filter-logic.sh` - Script de teste específico

### Arquivos de Configuração (2 arquivos)
- ❌ `.env.local` - Substituído por `.env`
- ❌ `.env.local.example` - Substituído por `.env.example`

### Backups e Arquivos Antigos (6 arquivos)
- ❌ `src/proxy.old.ts`
- ❌ `src/components/Carousel.old.tsx`
- ❌ `src/components/Player.old2.tsx`
- ❌ `src/components/Player.old3.tsx`
- ❌ `src/components/Player.old4.tsx`
- ❌ `src/components/Player.old5.tsx`

**Total: 16 arquivos removidos**

---

## ✅ Arquivos Mantidos

### Scripts Essenciais (7 arquivos)
- ✅ `check-ports.sh` - Verificação de portas disponíveis
- ✅ `deploy-radio.sh` - Deploy do sistema de rádio
- ✅ `deploy.sh` - Deploy geral
- ✅ `dev.sh` - Inicialização do ambiente de desenvolvimento
- ✅ `sync-cdn.sh` - Sincronização com CDN
- ✅ `sync-music.sh` - Sincronização de músicas (shell)
- ✅ `sync-music.ts` - Sincronização de músicas (TypeScript)

### Arquivos de Configuração (3 arquivos)
- ✅ `.env` - **NOVO** - Configuração de desenvolvimento (não versionado)
- ✅ `.env.example` - **NOVO** - Template de exemplo
- ✅ `.env.production` - Configuração de produção (versionado sem senhas)

---

## 📝 Mudanças na Estrutura

### Antes
```
.env                    # Config antiga (desatualizada)
.env.local              # Config de desenvolvimento
.env.local.example      # Template
.env.production         # Config de produção
```

### Depois
```
.env                    # Config de desenvolvimento (não versionado)
.env.example            # Template de exemplo
.env.production         # Config de produção (versionado)
```

---

## 🔧 Arquivos Atualizados

### Documentação
- ✅ `README.md` - Referencias de `.env.local` → `.env`
- ✅ `QUICKSTART.md` - Instruções atualizadas
- ✅ `CHANGELOG.md` - Log atualizado
- ✅ `docs/DESENVOLVIMENTO.md` - Guia atualizado
- ✅ `docs/PORTAS.md` - Configurações atualizadas
- ✅ `docs/ADMIN.md` - Instruções atualizadas
- ✅ `docker/README.md` - Setup atualizado

### GitIgnore
- ✅ `.gitignore` - Adicionado `.env` (se não estava)

---

## 🚀 Como Usar Agora

### Setup Inicial

```bash
# 1. Clonar projeto
git clone [repo]
cd somdomato

# 2. Instalar dependências
pnpm install

# 3. Configurar ambiente (opcional - .env já existe)
# Se quiser resetar: cp .env.example .env
nano .env  # Ajustar MUSIC_PATH

# 4. Iniciar ambiente Docker
./scripts/dev.sh

# 5. Iniciar Next.js
pnpm dev
```

### Configurações

**Desenvolvimento** (`.env`):
```env
NEXT_PUBLIC_RADIO_SOURCE=http://localhost:8080
LIQUIDSOAP_CONTROL_URL=http://localhost:8081
MUSIC_PATH=/home/lucas/music/sdm
ADMIN_PASSWORD=senha123
```

**Produção** (`.env.production`):
```env
NEXT_PUBLIC_RADIO_SOURCE=https://radio.somdomato.com
LIQUIDSOAP_CONTROL_URL=http://localhost:8080
MUSIC_PATH=/var/music/sdm
ADMIN_PASSWORD=
```

---

## 📊 Estatísticas

| Item | Antes | Depois | Redução |
|------|-------|--------|---------|
| **Scripts** | 15 | 7 | -53% |
| **Arquivos .env** | 4 | 3 | -25% |
| **Backups .old** | 6 | 0 | -100% |
| **Total** | 25 | 10 | **-60%** |

---

## ⚠️ Notas Importantes

1. **`.env` não é versionado** - Cada desenvolvedor tem suas configurações locais
2. **`.env.production` é versionado** - Mas sem senhas (ADMIN_PASSWORD vazio)
3. **`.env.example` é versionado** - Template para novos desenvolvedores
4. **Scripts mantidos são essenciais** - Não remover!
5. **Documentação atualizada** - Todas as referências corrigidas

---

## 🔜 Próximos Passos

- [ ] Verificar se CI/CD precisa de ajustes
- [ ] Confirmar que deploy funciona com nova estrutura
- [ ] Atualizar README.md do repositório remoto
- [ ] Comunicar mudanças ao time (se aplicável)

---

## ✅ Checklist de Verificação

```bash
# 1. Verificar estrutura
ls -la .env*
# Deve mostrar: .env, .env.example, .env.production

# 2. Verificar scripts
ls scripts/
# Deve ter 7 scripts essenciais

# 3. Verificar .gitignore
grep "^\.env$" .gitignore
# Deve retornar: .env

# 4. Testar ambiente
./scripts/dev.sh
# Deve iniciar sem erros

# 5. Testar Next.js
pnpm dev
# Deve rodar normalmente
```

---

**Limpeza concluída com sucesso! 🎉**
