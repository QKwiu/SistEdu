#!/usr/bin/env bash
# =============================================================================
# Kiwara Tech — Backup Integrity Verification Script
# =============================================================================
# Descarrega o backup mais recente de S3, decifra e verifica sem restaurar.
# Execute este script semanalmente para garantir que os backups são recuperáveis.
#
# Uso: ./verify.sh [--type daily|weekly|monthly] [--key S3_KEY_ESPECÍFICO]
# =============================================================================
set -euo pipefail

BACKUP_TYPE="${1:-daily}"
SPECIFIC_KEY="${SPECIFIC_KEY:-}"
VERIFY_DIR=$(mktemp -d /tmp/pgverify.XXXXXX)
REPORT_FILE="${VERIFY_DIR}/report.txt"

log() { echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $*" | tee -a "${REPORT_FILE}"; }
cleanup() { rm -rf "${VERIFY_DIR}"; }
trap cleanup EXIT

required_vars=(BACKUP_S3_BUCKET BACKUP_S3_PREFIX BACKUP_ENCRYPTION_KEY
               AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_DEFAULT_REGION)
for var in "${required_vars[@]}"; do
  [[ -z "${!var:-}" ]] && { echo "ERROR: Variável '${var}' não definida."; exit 1; }
done

log "=== Verificação de Integridade de Backup ==="

# ── Descobrir o backup mais recente ──────────────────────────────────────────
if [[ -n "${SPECIFIC_KEY}" ]]; then
  S3_KEY="${SPECIFIC_KEY}"
else
  log "A procurar backup ${BACKUP_TYPE} mais recente..."
  S3_KEY=$(aws s3 ls "s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX}/${BACKUP_TYPE}/" \
    --recursive \
    | sort -r \
    | grep ".pgc.enc" \
    | head -1 \
    | awk '{print $4}')

  if [[ -z "${S3_KEY}" ]]; then
    log "ERROR: Nenhum backup '${BACKUP_TYPE}' encontrado em S3."
    exit 1
  fi
fi

log "Backup a verificar: s3://${BACKUP_S3_BUCKET}/${S3_KEY}"

# ── Download ──────────────────────────────────────────────────────────────────
ENCRYPTED_FILE="${VERIFY_DIR}/backup.pgc.enc"
DECRYPTED_FILE="${VERIFY_DIR}/backup.pgc"

log "[1/3] A descarregar..."
aws s3 cp "s3://${BACKUP_S3_BUCKET}/${S3_KEY}" "${ENCRYPTED_FILE}"
S3_SIZE=$(stat -c%s "${ENCRYPTED_FILE}")
log "[1/3] Download OK. Tamanho: $(du -sh "${ENCRYPTED_FILE}" | cut -f1)"

# ── Decifragem ────────────────────────────────────────────────────────────────
log "[2/3] A decifrar..."
openssl enc -aes-256-cbc \
  -pbkdf2 -iter 100000 \
  -d \
  -in "${ENCRYPTED_FILE}" \
  -out "${DECRYPTED_FILE}" \
  -pass "pass:${BACKUP_ENCRYPTION_KEY}" \
  2>/dev/null

if [[ ! -s "${DECRYPTED_FILE}" ]]; then
  log "ERROR: Decifragem falhou — chave errada ou ficheiro corrompido."
  exit 1
fi
log "[2/3] Decifragem OK. Tamanho dump: $(du -sh "${DECRYPTED_FILE}" | cut -f1)"

# ── Validação estrutural do dump ──────────────────────────────────────────────
log "[3/3] A validar estrutura do dump..."
if ! pg_restore --list "${DECRYPTED_FILE}" > "${VERIFY_DIR}/object_list.txt" 2>&1; then
  log "ERROR: pg_restore --list falhou. O dump pode estar corrompido."
  exit 1
fi

TABLES=$(grep "TABLE DATA" "${VERIFY_DIR}/object_list.txt" | wc -l)
SEQUENCES=$(grep "SEQUENCE" "${VERIFY_DIR}/object_list.txt" | wc -l)
INDEXES=$(grep "INDEX" "${VERIFY_DIR}/object_list.txt" | wc -l)
FUNCTIONS=$(grep "FUNCTION" "${VERIFY_DIR}/object_list.txt" | wc -l)
TOTAL=$(wc -l < "${VERIFY_DIR}/object_list.txt")

log "[3/3] Estrutura válida:"
log "   Tabelas:   ${TABLES}"
log "   Sequências:${SEQUENCES}"
log "   Índices:   ${INDEXES}"
log "   Funções:   ${FUNCTIONS}"
log "   Total obj: ${TOTAL}"

# ── Relatório final ───────────────────────────────────────────────────────────
log ""
log "=============================="
log " RESULTADO: ✅ BACKUP VÁLIDO  "
log "=============================="
log " S3 Key:     ${S3_KEY}"
log " Tamanho:    $(du -sh "${ENCRYPTED_FILE}" | cut -f1) (cifrado)"
log " Objectos:   ${TOTAL}"
log "=============================="

# Notificação de resultado
if [[ -n "${BACKUP_NOTIFY_URL:-}" ]]; then
  curl -s -X POST "${BACKUP_NOTIFY_URL}" \
    -H "Content-Type: application/json" \
    -d "{\"text\":\"🔍 *Verificação de Backup OK* [${BACKUP_TYPE}]\nObjectos: ${TOTAL} | Tamanho: $(du -sh "${ENCRYPTED_FILE}" | cut -f1)\"}" \
    || true
fi

exit 0
