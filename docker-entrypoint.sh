#!/bin/sh
set -e

echo "=================================================================="
echo " InTime Technology - OS & Inventário Platform (Inicializando...)"
echo " Empresa: In Time Technology e Systems LTDA (10.742.889/0001-36)"
echo "=================================================================="

# Garante a estrutura de subpastas nos volumes persistentes montados pelo Portainer
mkdir -p /app/uploads/equipments \
         /app/uploads/os \
         /app/uploads/signatures \
         /app/uploads/attachments \
         /app/uploads/avatars \
         /app/uploads/brand \
         /app/backups

# Ajusta permissões caso o volume tenha sido montado como root pelo Docker host
if [ "$(id -u)" = "0" ]; then
  chown -R nextjs:nodejs /app/uploads /app/backups
fi

echo "[1/2] Sincronizando schema do banco de dados PostgreSQL..."
node ./node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss=false || true

echo "[2/2] Iniciando servidor Next.js Standalone na porta ${PORT:-3000}..."
if [ "$(id -u)" = "0" ]; then
  exec su-exec nextjs:nodejs "$@"
else
  exec "$@"
fi
