# Kiwara Tech — Plano de Disaster Recovery (DR)
**Versão:** 1.0 | **Classificação:** Confidencial | **Revisão:** Anual

---

## 1. Objectivos

| Métrica | Objectivo | Descrição |
|---------|-----------|-----------|
| **RPO** (Recovery Point Objective) | **≤ 24 horas** | Perda máxima de dados aceitável |
| **RTO** (Recovery Time Objective) | **≤ 4 horas** | Tempo máximo para restauro total |
| **MTTR** (Mean Time to Recovery) | **≤ 2 horas** | Tempo médio de recuperação |

---

## 2. Arquitectura de Backup

```
PostgreSQL (Produção)
        │
        ▼ pg_dump --format=custom --compress=9
   Dump Binário (.pgc)
        │
        ▼ AES-256-GCM + PBKDF2 (100k iterações)
   Ficheiro Cifrado (.pgc.enc)
        │
        ▼ AWS S3 (STANDARD_IA → GLACIER após 30 dias)
   s3://kiwara-backups-prod/kiwara/db/{daily|weekly|monthly}/
```

### Calendário de Backups
| Tipo    | Frequência        | Hora (UTC) | Retenção |
|---------|-------------------|-----------|----------|
| Daily   | Todos os dias     | 02:00     | 7 dias   |
| Weekly  | Domingo           | 01:00     | 28 dias  |
| Monthly | Dia 1 do mês      | 00:30     | 90 dias  |
| Manual  | Por solicitação   | —         | 90 dias  |

---

## 3. Cenários de Disaster

### Cenário A — Corrupção de dados (parcial)
**Sintomas:** Queries a falhar, dados inconsistentes, índices corrompidos  
**Severidade:** Alta  
**Procedimento:**
1. Identificar o ponto temporal da corrupção (logs, `pg_stat_activity`)
2. Escolher o backup mais recente **anterior** à corrupção
3. Restaurar para base de dados de staging com `restore.sh --dry-run`
4. Verificar integridade dos dados no staging
5. Planear janela de manutenção (comunicar utilizadores)
6. Executar restauro em produção

### Cenário B — Falha catastrófica do servidor
**Sintomas:** Servidor inacessível, dados perdidos  
**Severidade:** Crítica  
**Procedimento:**
1. Provisionar novo servidor (mín. 2 vCPU, 4 GB RAM, 50 GB SSD)
2. Instalar PostgreSQL 16, Node.js 20
3. Restaurar a partir do backup S3 mais recente
4. Actualizar DNS / variáveis de ambiente
5. Executar testes de aceitação
6. Reactivar cron de backups

### Cenário C — Compromisso de segurança (invasão)
**Sintomas:** Acesso não autorizado, dados potencialmente exfiltrados  
**Severidade:** Crítica + Regulatória  
**Procedimento:**
1. **Isolar imediatamente** — desligar o servidor afectado da rede
2. Preservar evidence (snapshots, logs de acesso)
3. Notificar responsável de segurança e entidade reguladora (INACOM Angola, se aplicável)
4. Provisionar servidor **NOVO** em infra separada
5. Restaurar a partir de backup **anterior ao compromisso**
6. Rodar **TODAS** as credenciais: BD, S3, API keys, JWT secrets, etc.
7. Auditar o que foi acedido (logs CloudTrail, pg_audit)
8. Post-mortem em 48h

### Cenário D — Eliminação acidental de dados
**Sintomas:** `DELETE` / `DROP TABLE` sem `WHERE`, truncamento por erro  
**Severidade:** Média  
**Procedimento:**
1. Verificar se o S3 tem versioning activo (permite recuperar backups eliminados)
2. Estimar janela de perda: `SELECT MAX(updated_at) FROM tabela_afectada`
3. Restaurar para staging a tabela específica com `pg_restore -t nome_tabela`
4. Reinserção cirúrgica em produção

---

## 4. Procedimento de Restauro Passo-a-Passo

### Pré-requisitos
```bash
# Variáveis necessárias
export BACKUP_ENCRYPTION_KEY="..."    # Da vault/LastPass/Bitwarden
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_DEFAULT_REGION="af-south-1"
export BACKUP_S3_BUCKET="kiwara-backups-prod"
```

### Passo 1 — Listar backups disponíveis
```bash
aws s3 ls s3://kiwara-backups-prod/kiwara/db/ --recursive | sort -r | head -20
```

### Passo 2 — Teste em staging (SEMPRE primeiro)
```bash
./restore.sh \
  --bucket kiwara-backups-prod \
  --key kiwara/db/daily/2025-06-01/backup_20250601T020000Z.pgc.enc \
  --target-db kiwara_staging \
  --dry-run
```

### Passo 3 — Verificar integridade
```bash
./verify.sh
# Confirmar: tabelas, índices, sequências, funções listados correctamente
```

### Passo 4 — Restauro em produção
```bash
# ATENÇÃO: isto sobrescreve a BD de produção!
./restore.sh \
  --bucket kiwara-backups-prod \
  --key kiwara/db/daily/2025-06-01/backup_20250601T020000Z.pgc.enc \
  --target-db kiwara_production \
  --target-host prod-db-server
# Confirmar com: CONFIRMO
```

### Passo 5 — Verificação pós-restauro
```bash
# Verificar número de registos principais
psql -d kiwara_production -c "
  SELECT 'schools'   AS tabela, COUNT(*) FROM schools    UNION ALL
  SELECT 'students'  AS tabela, COUNT(*) FROM students   UNION ALL
  SELECT 'propinas'  AS tabela, COUNT(*) FROM propinas   UNION ALL
  SELECT 'guardians' AS tabela, COUNT(*) FROM guardians;
"

# Verificar timestamp do registo mais recente
psql -d kiwara_production -c "
  SELECT MAX(created_at) as ultimo_registo FROM propinas;
"
```

---

## 5. Testes de DR (Obrigatórios)

| Frequência | Teste | Critério de Aprovação |
|-----------|-------|-----------------------|
| **Quinzenal** | `verify.sh` — validação estrutural | Todos os objectos presentes |
| **Mensal** | Restauro completo em staging | RTO < 4h, 0 erros |
| **Trimestral** | Simulação de cenário B (falha total) | Equipa consegue recuperar sem documentação |
| **Anual** | Rotação da chave de cifra | Backups antigos e novos recuperáveis |

### Como fazer o teste mensal
```bash
# 1. Criar BD de teste
createdb kiwara_dr_test_$(date +%Y%m)

# 2. Restaurar
./restore.sh \
  --bucket kiwara-backups-prod \
  --key $(aws s3 ls s3://kiwara-backups-prod/kiwara/db/daily/ --recursive | sort -r | head -1 | awk '{print $4}') \
  --target-db kiwara_dr_test_$(date +%Y%m)

# 3. Validar
psql -d kiwara_dr_test_$(date +%Y%m) -c "SELECT COUNT(*) FROM schools;"

# 4. Limpar
dropdb kiwara_dr_test_$(date +%Y%m)
```

---

## 6. Inventário de Credenciais (Onde estão guardadas)

> ⚠️ **NUNCA guarde credenciais neste ficheiro.** Este é apenas um índice de onde encontrá-las.

| Credencial | Localização |
|-----------|-------------|
| `BACKUP_ENCRYPTION_KEY` | Vault de passwords da empresa (ex: Bitwarden Teams) |
| `AWS_ACCESS_KEY_ID/SECRET` | Vault → secção "AWS Backup IAM" |
| `PGPASSWORD` produção | Vault → secção "PostgreSQL Production" |
| Chave GPG (backup alternativo) | Smartcard do responsável de infra |

### Política de rotação de credenciais
- `BACKUP_ENCRYPTION_KEY` — rotação **anual** (manter versão antiga por 90 dias para backups existentes)
- Credenciais AWS IAM — rotação **semestral**
- Password PostgreSQL — rotação **trimestral**

---

## 7. Contacts de Emergência

| Papel | Contacto | Disponibilidade |
|-------|---------|----------------|
| Responsável de Infra | [PREENCHER] | 24/7 |
| DBA Principal | [PREENCHER] | Horário laboral + on-call |
| AWS Support | [PREENCHER — plano Business mín.] | 24/7 |
| Responsável de Segurança | [PREENCHER] | 24/7 |

---

## 8. Checklist de Recuperação

```
INCIDENTE: ___________________________   DATA: ____________   HORA: _______

[ ] 1. Incidente declarado e equipa notificada
[ ] 2. Severidade avaliada (A/B/C/D)
[ ] 3. Servidor afectado isolado (se cenário C)
[ ] 4. Evidence preservada
[ ] 5. Backup escolhido e verificado em staging
[ ] 6. Janela de manutenção comunicada aos utilizadores
[ ] 7. Restauro executado em produção
[ ] 8. Verificação pós-restauro concluída
[ ] 9. Monitoring voltou ao verde
[ ] 10. Post-mortem agendado (< 48h)
[ ] 11. Relatório de incidente enviado às partes interessadas
[ ] 12. Credenciais rotadas (se cenário C)

Responsável: ___________________  Assinatura: ___________________
```

---

## 9. Política de Retenção S3 (IAM Mínimo)

O utilizador IAM de backup deve ter apenas estas permissões:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "KiwaraBackupWrite",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:ListBucket", "s3:HeadObject"],
      "Resource": [
        "arn:aws:s3:::kiwara-backups-prod",
        "arn:aws:s3:::kiwara-backups-prod/kiwara/db/*"
      ]
    }
  ]
}
```

**Princípio do mínimo privilégio:** O utilizador de backup **NÃO** deve ter `s3:DeleteObject` — a rotação é gerida pelo S3 Lifecycle, não pelo script.

---

*Última revisão: Junho 2025 | Próxima revisão obrigatória: Junho 2026*
