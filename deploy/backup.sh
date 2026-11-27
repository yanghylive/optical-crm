#!/usr/bin/env bash
# 配镜 CRM · 每日备份（放 cron）
#   crontab -e
#   30 23 * * * /opt/optical-crm/deploy/backup.sh >> /var/log/optical-backup.log 2>&1
#
# 保留最近 30 天，超期自动删除。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA="$SCRIPT_DIR/data/db.json"
DEST="$SCRIPT_DIR/backups"
KEEP_DAYS="${KEEP_DAYS:-30}"

[ -f "$DATA" ] || { echo "找不到 $DATA"; exit 1; }
mkdir -p "$DEST"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$DEST/db-$STAMP.json"

# 用 tar 保证拷贝瞬间的一致性；db.json 是原子写，直接 cp 也安全
cp "$DATA" "$OUT"
gzip -f "$OUT"

# 校验 gzip 完整性，坏档立即报错
gzip -t "$OUT.gz"

echo "[$(date '+%F %T')] 备份完成 $OUT.gz ($(stat -c%s "$OUT.gz") bytes)"

find "$DEST" -name 'db-*.json.gz' -type f -mtime "+$KEEP_DAYS" -print -delete | sed 's/^/  过期清理: /'
