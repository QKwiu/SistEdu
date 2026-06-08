#!/usr/bin/env bash
# =============================================================================
# Kiwara Tech — Backup Infrastructure Setup
# =============================================================================
# Execute UMA VEZ no servidor/VPS de produção para configurar:
#   - AWS CLI
#   - Bucket S3 com versionamento + lifecycle
#   - Cron jobs (diário às 02:00, semanal domingos 01:00, mensal 1º 00:30)
#   - Rotação de logs
#
# Uso: sudo ./setup.sh
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_USER="${BACKUP_USER:-kiwara-backup}"
INSTALL_DIR="/opt/kiwara/backup"
LOG_DIR="/var/log/kiwara"
ENV_FILE="/etc/kiwara/backup.env"

log()  { echo "[SETUP] $*"; }
err()  { echo "[SETUP ERROR] $*" >&2; }
step() { echo ""; echo "══════════════════════════════════"; echo " $*"; echo "══════════════════════════════════"; }

# ── Verificação de root ───────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  err "Execute como root: sudo ./setup.sh"
  exit 1
fi

step "1/7 — Instalar dependências (aws-cli, postgresql-client)"

# Detectar distro
if command -v apt-get &>/dev/null; then
  apt-get update -qq
  apt-get install -y -qq awscli postgresql-client openssl curl jq
elif command -v yum &>/dev/null; then
  yum install -y -q aws-cli postgresql openssl curl jq
elif command -v brew &>/dev/null; then
  brew install awscli postgresql openssl curl jq 2>/dev/null || true
else
  log "AVISO: Gestor de pacotes não reconhecido. Instale manualmente: awscli, postgresql-client, openssl"
fi

log "✅ Dependências instaladas."

step "2/7 — Criar utilizador e directorias de backup"

id "${BACKUP_USER}" &>/dev/null || useradd --system --no-create-home --shell /sbin/nologin "${BACKUP_USER}"

mkdir -p "${INSTALL_DIR}" "${LOG_DIR}" "/etc/kiwara"
chmod 750 "${INSTALL_DIR}" "/etc/kiwara"
chmod 755 "${LOG_DIR}"
chown "${BACKUP_USER}:${BACKUP_USER}" "${INSTALL_DIR}" "${LOG_DIR}"

# Copiar scripts
cp "${SCRIPT_DIR}"/{pg-backup.sh,restore.sh,verify.sh,rotate.sh} "${INSTALL_DIR}/"
chmod 750 "${INSTALL_DIR}"/*.sh
chown "${BACKUP_USER}:${BACKUP_USER}" "${INSTALL_DIR}"/*.sh

log "✅ Directorias e scripts instalados em ${INSTALL_DIR}."

step "3/7 — Configurar ficheiro de variáveis de ambiente"

if [[ -f "${ENV_FILE}" ]]; then
  log "Ficheiro ${ENV_FILE} já existe. A ignorar (edite manualmente se necessário)."
else
  cat > "${ENV_FILE}" << 'EOF'
# Kiwara Backup — Variáveis de Ambiente
# Edite este ficheiro e reinicie os serviços de backup.

# Base de dados PostgreSQL
PGHOST=localhost
PGPORT=5432
PGUSER=kiwara_app
PGPASSWORD=SUBSTITUA_PELA_PASSWORD
PGDATABASE=kiwara_production

# AWS S3
AWS_ACCESS_KEY_ID=SUBSTITUA_PELA_KEY
AWS_SECRET_ACCESS_KEY=SUBSTITUA_PELA_SECRET
AWS_DEFAULT_REGION=af-south-1
BACKUP_S3_BUCKET=kiwara-backups-prod
BACKUP_S3_PREFIX=kiwara/db

# Cifra — gere com: openssl rand -base64 48
BACKUP_ENCRYPTION_KEY=SUBSTITUA_POR_PASSPHRASE_DE_PELO_MENOS_48_CHARS

# Notificações (webhook Slack/Teams/Discord — opcional)
BACKUP_NOTIFY_URL=

# Log
BACKUP_LOG_FILE=/var/log/kiwara/pg-backup.log
EOF
  chmod 600 "${ENV_FILE}"
  chown "${BACKUP_USER}:${BACKUP_USER}" "${ENV_FILE}"
  log "✅ Ficheiro de env criado: ${ENV_FILE}"
  log "⚠️  IMPORTANTE: Edite ${ENV_FILE} com as credenciais reais antes de continuar."
fi

step "4/7 — Criar bucket S3 e configurar lifecycle"

log "Para criar o bucket S3 automaticamente, execute os comandos abaixo como o utilizador AWS:"
echo ""
cat << 'CMDS'
# Substitua BUCKET e REGION
BUCKET="kiwara-backups-prod"
REGION="af-south-1"

# Criar bucket
aws s3api create-bucket \
  --bucket "${BUCKET}" \
  --region "${REGION}" \
  --create-bucket-configuration LocationConstraint="${REGION}"

# Activar versionamento (protecção contra eliminação acidental)
aws s3api put-bucket-versioning \
  --bucket "${BUCKET}" \
  --versioning-configuration Status=Enabled

# Bloquear acesso público
aws s3api put-public-access-block \
  --bucket "${BUCKET}" \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Lifecycle: 7 diários, 4 semanais, 3 mensais
aws s3api put-bucket-lifecycle-configuration \
  --bucket "${BUCKET}" \
  --lifecycle-configuration '{
    "Rules": [
      {
        "ID": "daily-retention-7-days",
        "Status": "Enabled",
        "Filter": {"Prefix": "kiwara/db/daily/"},
        "Expiration": {"Days": 7}
      },
      {
        "ID": "weekly-retention-28-days",
        "Status": "Enabled",
        "Filter": {"Prefix": "kiwara/db/weekly/"},
        "Expiration": {"Days": 28}
      },
      {
        "ID": "monthly-retention-90-days",
        "Status": "Enabled",
        "Filter": {"Prefix": "kiwara/db/monthly/"},
        "Expiration": {"Days": 90}
      },
      {
        "ID": "transition-to-glacier",
        "Status": "Enabled",
        "Filter": {"Prefix": "kiwara/db/"},
        "Transitions": [
          {"Days": 3, "StorageClass": "STANDARD_IA"},
          {"Days": 30, "StorageClass": "GLACIER"}
        ]
      }
    ]
  }'

# Encriptação server-side obrigatória
aws s3api put-bucket-encryption \
  --bucket "${BUCKET}" \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"},
      "BucketKeyEnabled": true
    }]
  }'

echo "✅ Bucket ${BUCKET} configurado com sucesso."
CMDS

step "5/7 — Configurar cron jobs"

CRON_FILE="/etc/cron.d/kiwara-backup"
cat > "${CRON_FILE}" << EOF
# Kiwara Tech — Backup Automático PostgreSQL
# Diário  às 02:00 UTC
0 2 * * *   ${BACKUP_USER}  set -a && . ${ENV_FILE} && ${INSTALL_DIR}/pg-backup.sh daily  >> ${LOG_DIR}/pg-backup.log 2>&1
# Semanal às 01:00 UTC (domingo)
0 1 * * 0   ${BACKUP_USER}  set -a && . ${ENV_FILE} && ${INSTALL_DIR}/pg-backup.sh weekly >> ${LOG_DIR}/pg-backup.log 2>&1
# Mensal  às 00:30 UTC (dia 1)
30 0 1 * *  ${BACKUP_USER}  set -a && . ${ENV_FILE} && ${INSTALL_DIR}/pg-backup.sh monthly >> ${LOG_DIR}/pg-backup.log 2>&1
# Verificação de integridade — quinzenal (dia 15, às 03:00 UTC)
0 3 15 * *  ${BACKUP_USER}  set -a && . ${ENV_FILE} && ${INSTALL_DIR}/verify.sh >> ${LOG_DIR}/verify.log 2>&1
EOF

chmod 644 "${CRON_FILE}"
log "✅ Cron configurado em ${CRON_FILE}."

step "6/7 — Configurar rotação de logs (logrotate)"

cat > "/etc/logrotate.d/kiwara-backup" << EOF
${LOG_DIR}/pg-backup.log ${LOG_DIR}/verify.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 640 ${BACKUP_USER} ${BACKUP_USER}
}
EOF
log "✅ Logrotate configurado."

step "7/7 — Teste de conectividade (dry-run)"

log "A testar conexão à base de dados..."
log "Execute manualmente após configurar ${ENV_FILE}:"
echo ""
echo "  set -a && . ${ENV_FILE}"
echo "  PGPASSWORD=\$PGPASSWORD pg_dump --host=\$PGHOST --username=\$PGUSER --dbname=\$PGDATABASE --schema-only --no-password | head -5"
echo "  aws s3 ls s3://\$BACKUP_S3_BUCKET/ --region \$AWS_DEFAULT_REGION"
echo ""

log "✅ Setup concluído!"
log ""
log "PRÓXIMOS PASSOS:"
log "  1. Edite ${ENV_FILE} com credenciais reais"
log "  2. Execute os comandos S3 da secção 4"
log "  3. Teste manualmente: ${INSTALL_DIR}/pg-backup.sh daily"
log "  4. Verifique o log: tail -f ${LOG_DIR}/pg-backup.log"
