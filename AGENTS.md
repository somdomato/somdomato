# Configuração de ambiente

O projeto possui somente dois arquivos de ambiente na raiz:

- `.env`: valores reais, ignorado pelo Git. É a única fonte de configuração
  para desenvolvimento, Podman e provisionamento Ansible.
- `.env.example`: esquema público completo, sem segredos, usado para criar
  uma nova configuração.

Não crie `podman/.env`, `.env.production` ou outros arquivos `.env*`.

## Regras de segurança e manutenção

- Nunca leia, imprima, registre em logs ou versione valores de `.env`.
- Preserve todas as chaves ao editar `.env.example`; cada chave é consumida
  pelo Make/Podman, pela aplicação Go ou pelo Ansible.
- Antes de alterar arquivos de ambiente, compare as chaves com seus usos em
  `api/config`, `podman/compose.yml`, `scripts/dev-env.sh` e
  `ansible/playbook.yml`.
- Mantenha `.env` com permissão `600` e use valores próprios de cada ambiente.
- O Ansible lê `../.env` a partir de `ansible/playbook.yml`; não use Ansible
  Vault nesse arquivo, pois o Make/Podman precisa lê-lo em texto.
