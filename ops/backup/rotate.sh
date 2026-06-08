#!/usr/bin/env bash
# =============================================================================
# Kiwara Tech — S3 Backup Rotation / Retention Cleanup
# =============================================================================
# Remove backups mais antigos que o período de retenção definido.
# Chamado automaticamente pelo pg-backup.sh ou pelo cron.
#
# Retenção padrão:
#   daily  — 7 dias
#   weekly — 28 dias
#   monthly— 90 dias
# =============================================================================
set -euo pipefail

DAILY_KEEP_DAYS="${BACKUP_RETAIN_DAILY:-7}"
WEEKLY_KEEP_DAYS="${BACKUP_RETAIN_WEEKLY:-28}"
MONTHLY_KEEP_DAYS="${BACKUP_RETAIN_MONTHLY:-90}"

log() { echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [rotate] $*"; }

required_vars=(BACKUP_S3_BUCKET BACKUP_S3_PREFIX AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_DEFAULT_REGION)
for var in "${required_vars[@]}"; do
  [[ -z "${!var:-}" ]] && { echo "ERROR: '${var}' não definida."; exit 1; }
done

rotate_prefix() {
  local prefix="$1"
  local keep_days="$2"
  local cutoff
  cutoff=$(date -u -d "${keep_days} days ago" +"%Y-%m-%d" 2>/dev/null \
    || date -u -v-"${keep_days}"d +"%Y-%m-%d")  # macOS compatível

  log "A rodar '${prefix}' — mantendo ${keep_days} dias (corte: ${cutoff})..."

  local deleted=0
  while IFS= read -r line; do
    local key date_part
    key=$(echo "${line}" | awk '{print $4}')
    [[ -z "${key}" ]] && continue
    # Extrai a data da pasta (formato kiwara/db/daily/YYYY-MM-DD/...)
    date_part=$(echo "${key}" | grep -oP '\d{4}-\d{2}-\d{2}' | head -1 || true)
    [[ -z "${date_part}" ]] && continue

    if [[ "${date_part}" < "${cutoff}" ]]; then
      log "  A eliminar: ${key} (${date_part} < ${cutoff})"
      aws s3 rm "s3://${BACKUP_S3_BUCKET}/${key}" --quiet
      ((deleted++))
    fi
  done < <(aws s3 ls "s3://${BACKUP_S3_BUCKET}/${prefix}/" --recursive | grep ".pgc.enc")

  log "  ${deleted} backup(s) eliminado(s) em '${prefix}'."
}

log "=== Rotação de Backups S3 ==="
rotate_prefix "${BACKUP_S3_PREFIX}/daily"   "${DAILY_KEEP_DAYS}"
rotate_prefix "${BACKUP_S3_PREFIX}/weekly"  "${WEEKLY_KEEP_DAYS}"
rotate_prefix "${BACKUP_S3_PREFIX}/monthly" "${MONTHLY_KEEP_DAYS}"

# Resumo do estado actual
log ""
log "Estado actual do bucket:"
for t in daily weekly monthly; do
  COUNT=$(aws s3 ls "s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX}/${t}/" --recursive 2>/dev/null | grep -c ".pgc.enc" || echo 0)
  log "  ${t}: ${COUNT} backup(s)"
done

log "=== Rotação concluída ==="
