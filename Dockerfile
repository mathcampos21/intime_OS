# ============================================================================
# INTIME TECHNOLOGY - DOCKERFILE MULTI-STAGE (NODE 20 ALPINE STANDALONE)
# Projetado para baixo consumo de RAM/CPU em Containers LXC (Proxmox + Portainer)
# ============================================================================

# ----------------------------------------------------------------------------
# ESTÁGIO 1: Dependências (deps)
# ----------------------------------------------------------------------------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl vips-dev
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Instala dependências e gera o Prisma Client para linux-musl-openssl-3.0.x
RUN npm install --legacy-peer-deps && npx prisma generate

# ----------------------------------------------------------------------------
# ESTÁGIO 2: Compilação (builder)
# ----------------------------------------------------------------------------
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Compila o Next.js em modo standalone
RUN npm run build

# ----------------------------------------------------------------------------
# ESTÁGIO 3: Imagem Final de Produção (runner)
# Inclui postgresql16-client (pg_dump / psql) para o Motor de Backup/Restore 1-Clique
# ----------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

# Instala utilitários essenciais:
# - postgresql16-client: permite rodar pg_dump e psql no módulo /configuracoes/backup
# - vips: biblioteca nativa para compressão ultrarrápida de fotos em WebP via Sharp
# - tzdata: fuso horário America/Sao_Paulo para logs LGPD e agendamento Cron
# - curl / su-exec: healthcheck e execução segura sem root
RUN apk add --no-cache \
     libc6-compat \
     openssl \
     postgresql16-client \
     vips \
     tzdata \
     curl \
     su-exec

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV TZ=America/Sao_Paulo
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV UPLOADS_DIR="/app/uploads"
ENV BACKUPS_DIR="/app/backups"

# Cria grupo e usuário não-root para segurança DevSecOps
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Cria os diretórios de volumes persistentes e garante permissões
RUN mkdir -p /app/uploads/equipments \
             /app/uploads/os \
             /app/uploads/signatures \
             /app/uploads/attachments \
             /app/uploads/avatars \
             /app/uploads/brand \
             /app/backups && \
    chown -R nextjs:nodejs /app/uploads /app/backups

# Copia artefatos compilados do Next.js Standalone + Prisma Schema/Migrations
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma

# Script de inicialização (sincroniza schema, garante permissões dos volumes e inicia servidor)
COPY --chown=nextjs:nodejs docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:3000/api/v1/health || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
