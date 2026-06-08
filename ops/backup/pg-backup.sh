#!/usr/bin/env bash
# =============================================================================
# Kiwara Tech — PostgreSQL Incremental Backup Script
# =============================================================================
# Uso:  ./pg-backup.sh [daily|weekly|monthly]
#
# Variáveis de ambiente obrigatórias:
#   PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE
#   BACKUP_S3_BUCKET       — ex: kiwara-backups-prod
#   BACKUP_S3_PREFIX       — ex: kiwara/db  (sem trailing slash)
#   BACKUP_ENCRYPTION_KEY  — passphrase longa e aleatória (min 32 chars)
#   AWS_ACCESS_KEY_ID      — credencial IAM com permissão s3:PutObject
#   AWS_SECRET_ACCESS_KEY
#   AWS_DEFAULT_REGION     — ex: af-south-1 (Africa — Cape Town)
#
# Variáveis opcionais:
#   BACKUP_NOTIFY_URL      — webhook (Slack/Teams/Discord) para alertas
#   BACKUP_LOG_FILE        — caminho do log local (default: /var/log/pg-backup.log)
# =============================================================================
set -euo pipefail

# ── Configuração ──────────────────────────────────────────────────────────────
BACKUP_TYPE="${1:-daily}"
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
DATE_STR=$(date -u +"%Y-%m-%d")
BACKUP_DIR=$(mktemp -d /tmp/pgbackup.XXXXXX)
LOG_FILE="${BACKUP_LOG_FILE:-/var/log/pg-backup.log}"
PG_DUMP_BIN="${PG_DUMP_BIN:-pg_dump}"

# Ficheiro de saída
DUMP_FILE="${BACKUP_DIR}/dump_${TIMESTAMP}.pgc"
ENCRYPTED_FILE="${DUMP_FILE}.enc"
S3_KEY="${BACKUP_S3_PREFIX}/${BACKUP_TYPE}/${DATE_STR}/backup_${TIMESTAMP}.pgc.enc"

# ── Funções utilitárias ───────────────────────────────────────────────────────
log() { echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $*" | tee -a "${LOG_FILE}"; }
err() { log "ERROR: $*" >&2; }

notify_failure() {
  local msg="$1"
  log "FALHA NO BACKUP: ${msg}"
  if [[ -n "${BACKUP_NOTIFY_URL:-}" ]]; then
    curl -s -X POST "${BACKUP_NOTIFY_URL}" \
      -H "Content-Type: application/json" \
      -d "{\"text\":\"🚨 *Kiwara Backup FALHOU* [${BACKUP_TYPE}]\n${msg}\nServidor: $(hostname)\nHora: ${TIMESTAMP}\"}" \
      || true
  fi
}

cleanup() {
  log "A limpar ficheiros temporários..."
  rm -rf "${BACKUP_DIR}"
}
trap 'cleanup' EXIT
trap 'notify_failure "Script interrompido por sinal."; cleanup; exit 1' INT TERM

# ── Validação de dependências ─────────────────────────────────────────────────
for cmd in pg_dump openssl aws gzip; do
  if ! command -v "${cmd}" &>/dev/null; then
    err "Comando '${cmd}' não encontrado. Execute setup.sh primeiro."
    exit 1
  fi
done

# ── Validação de variáveis ────────────────────────────────────────────────────
required_vars=(PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE
               BACKUP_S3_BUCKET BACKUP_S3_PREFIX
               BACKUP_ENCRYPTION_KEY
               AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_DEFAULT_REGION)
for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    notify_failure "Variável de ambiente '${var}' não definida."
    exit 1
  fi
done

if [[ ${#BACKUP_ENCRYPTION_KEY} -lt 32 ]]; then
  notify_failure "BACKUP_ENCRYPTION_KEY demasiado curta (mín. 32 caracteres)."
  exit 1
fi

log "=== Início do backup ${BACKUP_TYPE} ==="
log "Base de dados: ${PGDATABASE}@${PGHOST}:${PGPORT}"
log "Destino S3: s3://${BACKUP_S3_BUCKET}/${S3_KEY}"

# ── 1. pg_dump (formato custom = comprimido + selectivo no restore) ───────────
log "[1/4] A executar pg_dump..."
START_DUMP=$(date +%s)

PGPASSWORD="${PGPASSWORD}" "${PG_DUMP_BIN}" \
  --host="${PGHOST}" \
  --port="${PGPORT}" \
  --username="${PGUSER}" \
  --dbname="${PGDATABASE}" \
  --format=custom \
  --compress=9 \
  --no-password \
  --verbose \
  --file="${DUMP_FILE}" \
  2>>"${LOG_FILE}"

DUMP_SIZE=$(du -sh "${DUMP_FILE}" | cut -f1)
END_DUMP=$(date +%s)
log "[1/4] pg_dump concluído em $((END_DUMP - START_DUMP))s. Tamanho: ${DUMP_SIZE}"

# ── 2. Cifra AES-256-CBC com PBKDF2 ──────────────────────────────────────────
log "[2/4] A cifrar dump (AES-256-CBC + PBKDF2)..."
openssl enc -aes-256-cbc \
  -pbkdf2 -iter 100000 \
  -salt \
  -in "${DUMP_FILE}" \
  -out "${ENCRYPTED_FILE}" \
  -pass "pass:${BACKUP_ENCRYPTION_KEY}"

# Apaga ficheiro não-cifrado imediatamente
rm -f "${DUMP_FILE}"
ENC_SIZE=$(du -sh "${ENCRYPTED_FILE}" | cut -f1)
log "[2/4] Cifra concluída. Tamanho cifrado: ${ENC_SIZE}"

# ── 3. Upload para S3 ─────────────────────────────────────────────────────────
log "[3/4] A fazer upload para S3..."
START_UPLOAD=$(date +%s)

aws s3 cp "${ENCRYPTED_FILE}" "s3://${BACKUP_S3_BUCKET}/${S3_KEY}" \
  --storage-class STANDARD_IA \
  --metadata "backup_type=${BACKUP_TYPE},db=${PGDATABASE},timestamp=${TIMESTAMP},hostname=$(hostname)" \
  --expected-size "$(stat -c%s "${ENCRYPTED_FILE}")" \
  2>>"${LOG_FILE}"

END_UPLOAD=$(date +%s)
log "[3/4] Upload concluído em $((END_UPLOAD - START_UPLOAD))s."

# ── 4. Verificação de integridade (head-object) ───────────────────────────────
log "[4/4] A verificar objecto no S3..."
S3_SIZE=$(aws s3api head-object \
  --bucket "${BACKUP_S3_BUCKET}" \
  --key "${S3_KEY}" \
  --query ContentLength \
  --output text 2>>"${LOG_FILE}")
LOCAL_SIZE=$(stat -c%s "${ENCRYPTED_FILE}")

if [[ "${S3_SIZE}" != "${LOCAL_SIZE}" ]]; then
  notify_failure "Tamanho S3 (${S3_SIZE}) ≠ local (${LOCAL_SIZE}). Upload corrompido!"
  exit 1
fi
log "[4/4] Integridade verificada. S3: ${S3_SIZE} bytes = local: ${LOCAL_SIZE} bytes."

# ── Resumo ─────────────────────────────────────────────────────────────────────
TOTAL_TIME=$(( END_UPLOAD - START_DUMP ))
log "=== Backup ${BACKUP_TYPE} concluído com sucesso ==="
log "  S3 Key:   s3://${BACKUP_S3_BUCKET}/${S3_KEY}"
log "  Duração:  ${TOTAL_TIME}s"
log "  Tamanho:  ${ENC_SIZE} (cifrado)"

# Notificação de sucesso (opcional)
if [[ -n "${BACKUP_NOTIFY_URL:-}" ]]; then
  curl -s -X POST "${BACKUP_NOTIFY_URL}" \
    -H "Content-Type: application/json" \
    -d "{\"text\":\"✅ *Kiwara Backup OK* [${BACKUP_TYPE}] — ${ENC_SIZE} — ${TOTAL_TIME}s\"}" \
    || true
fi

exit 0
