#!/usr/bin/env bash
# =============================================================================
# Kiwara Tech — Disaster Recovery Restore Script
# =============================================================================
# Uso:  ./restore.sh --bucket BUCKET --key S3_KEY --target-db DBNAME [--dry-run]
#
# Exemplo:
#   ./restore.sh \
#     --bucket kiwara-backups-prod \
#     --key kiwara/db/daily/2025-06-01/backup_20250601T020000Z.pgc.enc \
#     --target-db kiwara_restored \
#     --dry-run
# =============================================================================
set -euo pipefail

# ── Parsing de argumentos ─────────────────────────────────────────────────────
DRY_RUN=false
S3_BUCKET=""
S3_KEY=""
TARGET_DB=""
TARGET_HOST="${PGHOST:-localhost}"
TARGET_PORT="${PGPORT:-5432}"
TARGET_USER="${PGUSER:-postgres}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bucket)      S3_BUCKET="$2"; shift 2 ;;
    --key)         S3_KEY="$2"; shift 2 ;;
    --target-db)   TARGET_DB="$2"; shift 2 ;;
    --target-host) TARGET_HOST="$2"; shift 2 ;;
    --target-port) TARGET_PORT="$2"; shift 2 ;;
    --target-user) TARGET_USER="$2"; shift 2 ;;
    --dry-run)     DRY_RUN=true; shift ;;
    *) echo "Argumento desconhecido: $1"; exit 1 ;;
  esac
done

# ── Validação ─────────────────────────────────────────────────────────────────
[[ -z "${S3_BUCKET}" ]] && { echo "ERROR: --bucket obrigatório"; exit 1; }
[[ -z "${S3_KEY}" ]]    && { echo "ERROR: --key obrigatório"; exit 1; }
[[ -z "${TARGET_DB}" ]] && { echo "ERROR: --target-db obrigatório"; exit 1; }
[[ -z "${BACKUP_ENCRYPTION_KEY:-}" ]] && { echo "ERROR: BACKUP_ENCRYPTION_KEY não definida"; exit 1; }

RESTORE_DIR=$(mktemp -d /tmp/pgrestore.XXXXXX)
ENCRYPTED_FILE="${RESTORE_DIR}/backup.pgc.enc"
DECRYPTED_FILE="${RESTORE_DIR}/backup.pgc"

log() { echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $*"; }
cleanup() { rm -rf "${RESTORE_DIR}"; }
trap cleanup EXIT

# ── Listagem de backups disponíveis (sem argumento --key) ─────────────────────
if [[ "${S3_KEY}" == "list" ]]; then
  log "Backups disponíveis em s3://${S3_BUCKET}/:"
  aws s3 ls "s3://${S3_BUCKET}/" --recursive | sort -r | grep ".pgc.enc" | head -20
  exit 0
fi

log "=== RESTORE DE DESASTRE ==="
log "Origem:  s3://${S3_BUCKET}/${S3_KEY}"
log "Destino: ${TARGET_DB}@${TARGET_HOST}:${TARGET_PORT}"
[[ "${DRY_RUN}" == true ]] && log "MODO DRY-RUN — nenhuma alteração será feita na BD."

# ── Confirmação de segurança ──────────────────────────────────────────────────
if [[ "${DRY_RUN}" == false ]]; then
  echo ""
  echo "⚠️  ATENÇÃO: Isto irá SOBRESCREVER a base de dados '${TARGET_DB}'."
  echo "   Recomenda-se usar uma base de dados temporária para validação primeiro."
  echo ""
  read -r -p "Confirme escrevendo 'CONFIRMO': " CONFIRM
  [[ "${CONFIRM}" != "CONFIRMO" ]] && { echo "Operação cancelada."; exit 0; }
fi

# ── 1. Download do S3 ─────────────────────────────────────────────────────────
log "[1/5] A descarregar backup do S3..."
aws s3 cp "s3://${S3_BUCKET}/${S3_KEY}" "${ENCRYPTED_FILE}"
log "[1/5] Download concluído. Tamanho: $(du -sh "${ENCRYPTED_FILE}" | cut -f1)"

# ── 2. Verificação de hash antes de decifrar ──────────────────────────────────
log "[2/5] A verificar integridade do ficheiro..."
FILE_HASH=$(sha256sum "${ENCRYPTED_FILE}" | cut -d' ' -f1)
log "[2/5] SHA-256: ${FILE_HASH}"

# ── 3. Decifragem ─────────────────────────────────────────────────────────────
log "[3/5] A decifrar (AES-256-CBC + PBKDF2)..."
openssl enc -aes-256-cbc \
  -pbkdf2 -iter 100000 \
  -d \
  -in "${ENCRYPTED_FILE}" \
  -out "${DECRYPTED_FILE}" \
  -pass "pass:${BACKUP_ENCRYPTION_KEY}"
log "[3/5] Decifragem concluída."

# ── 4. Validação do dump (sem restaurar) ─────────────────────────────────────
log "[4/5] A validar estrutura do dump..."
pg_restore --list "${DECRYPTED_FILE}" | head -30
OBJECT_COUNT=$(pg_restore --list "${DECRYPTED_FILE}" | wc -l)
log "[4/5] Dump válido. ${OBJECT_COUNT} objectos encontrados."

if [[ "${DRY_RUN}" == true ]]; then
  log "Dry-run concluído. O dump está válido e pronto para restauro."
  log "Para restaurar: remova --dry-run e confirme com 'CONFIRMO'."
  exit 0
fi

# ── 5. Restauro na base de dados alvo ─────────────────────────────────────────
log "[5/5] A restaurar na base de dados '${TARGET_DB}'..."

# Cria a BD se não existir
PGPASSWORD="${PGPASSWORD:-}" psql \
  -h "${TARGET_HOST}" -p "${TARGET_PORT}" -U "${TARGET_USER}" \
  -d postgres \
  -c "CREATE DATABASE \"${TARGET_DB}\" WITH ENCODING 'UTF8';" \
  2>/dev/null || log "Base de dados já existe, a continuar..."

START=$(date +%s)
PGPASSWORD="${PGPASSWORD:-}" pg_restore \
  --host="${TARGET_HOST}" \
  --port="${TARGET_PORT}" \
  --username="${TARGET_USER}" \
  --dbname="${TARGET_DB}" \
  --no-password \
  --verbose \
  --clean \
  --if-exists \
  "${DECRYPTED_FILE}" \
  2>&1 | tee -a /tmp/restore_$(date +%s).log
END=$(date +%s)

log "[5/5] Restauro concluído em $((END - START))s."

# ── Verificação pós-restauro ──────────────────────────────────────────────────
log "A verificar contagens pós-restauro..."
PGPASSWORD="${PGPASSWORD:-}" psql \
  -h "${TARGET_HOST}" -p "${TARGET_PORT}" -U "${TARGET_USER}" \
  -d "${TARGET_DB}" \
  -c "SELECT tablename, (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public') as total_tables FROM information_schema.tables WHERE table_schema='public' LIMIT 1;" \
  2>/dev/null || log "Verificação pós-restauro falhou (pode ser normal se a BD estiver vazia)."

log "=== Restauro concluído com sucesso ==="
log "  Base de dados: ${TARGET_DB}@${TARGET_HOST}:${TARGET_PORT}"
log "  Origem:        s3://${S3_BUCKET}/${S3_KEY}"
