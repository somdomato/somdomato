# Troubleshooting: Failed to find Server Action

## Erro

```
Error: Failed to find Server Action "x". This request might be from an older or newer deployment.
```

## Causa

Este erro ocorre quando o Next.js não consegue encontrar uma Server Action devido a:

1. **Falta da chave de criptografia** (`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`)
2. **Mudança na chave** entre builds diferentes
3. **Cache do browser** tentando usar bundle antigo

## Solução

### 1. Verificar se a chave existe

```bash
# No servidor de produção
cd /var/www/somdomato
grep NEXT_SERVER_ACTIONS_ENCRYPTION_KEY .env
```

Se não retornar nada, a chave não existe.

### 2. Gerar a chave (se não existir)

```bash
# Opção A: Automático (recomendado)
./scripts/generate-encryption-key.sh --update-env

# Opção B: Manual
openssl rand -hex 32
# Copie o resultado e adicione ao .env:
# NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=<resultado>
```

### 3. Garantir consistência entre .env e .env.production

```bash
# Verificar ambos os arquivos
grep NEXT_SERVER_ACTIONS_ENCRYPTION_KEY .env
grep NEXT_SERVER_ACTIONS_ENCRYPTION_KEY .env.production

# Se forem diferentes ou se .env.production não tiver, sincronizar:
KEY=$(grep NEXT_SERVER_ACTIONS_ENCRYPTION_KEY .env | cut -d '=' -f2)
echo "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$KEY" >> .env.production
```

### 4. Rebuild da aplicação

```bash
cd /var/www/somdomato
./scripts/deploy.sh
```

### 5. Limpar cache do navegador

No navegador do usuário:
- Chrome/Edge: `Ctrl+Shift+Delete` → "Imagens e arquivos em cache"
- Firefox: `Ctrl+Shift+Delete` → "Cache"
- Safari: `Cmd+Option+E`

Ou forçar reload: `Ctrl+Shift+R` (ou `Cmd+Shift+R` no Mac)

## Prevenção

### Deploy Automático (GitHub Actions)

O script `deploy.sh` já está configurado para:
- ✅ Gerar a chave automaticamente se não existir
- ✅ Sincronizar entre .env e .env.production
- ✅ Manter a mesma chave entre deploys

### Deploy Manual

Sempre use o script de deploy:
```bash
./scripts/deploy.sh
```

**Não** faça `pnpm build` diretamente sem antes garantir que a chave existe.

## Validação

Após o deploy, teste fazendo um pedido de música:

1. Acesse o site em uma janela anônima
2. Abra o modal de pedidos
3. Pesquie e peça uma música
4. Se funcionar sem erro, está OK ✓

## Detalhes Técnicos

### O que é a chave?

A `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` é usada pelo Next.js 15+ para:
- Criptografar os IDs das Server Actions
- Validar que o request veio do deployment correto
- Prevenir ataques de replay

### Formato

- **Tamanho**: 64 caracteres hexadecimais (32 bytes)
- **Exemplo**: `1a78f44fe14dc38a99f34fc58b3bea0825730de746ad64f538e057615ff470e4`

### Segurança

⚠️ **Não compartilhe esta chave publicamente**
- Não commite no Git
- Não inclua em logs ou error reports
- Use variáveis de ambiente

### Referências

- [Next.js Server Actions Documentation](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [Error Message Documentation](https://nextjs.org/docs/messages/failed-to-find-server-action)
