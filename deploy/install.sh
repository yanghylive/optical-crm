#!/usr/bin/env bash
# ============================================================
# 配镜 CRM · 与万象平台同机部署安装器
#
#   sudo bash install.sh --mode a --platform-dir /opt/kaypalai/docker
#   sudo bash install.sh --mode b --platform-dir /opt/kaypalai/docker
#   sudo bash install.sh --mode a --platform-dir ... --dry-run
#
# 设计原则：**不修改平台任何现有文件**
#   - 新增 docker-compose.override.yml（compose 自动合并）
#   - 新增 nginx-optical.conf（= 平台 nginx.conf + 一行 include）
#   - 新增 conf.d/optical.conf（CRM 的 server 块）
#   回滚只需删掉这三个新增文件再 docker compose up -d nginx
#
# 任何一步失败都会自动回滚已创建的文件。
# ============================================================
set -euo pipefail

MODE="a"
PLATFORM_DIR=""
DRY_RUN=0
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CREATED=()

say()  { printf '\033[1;36m[install]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[fail]\033[0m %s\n' "$*" >&2; exit 1; }

rollback() {
  local code=$?
  if [ $code -ne 0 ] && [ ${#CREATED[@]} -gt 0 ]; then
    warn "安装失败，回滚本次新增的文件："
    for f in "${CREATED[@]}"; do
      [ -e "$f" ] && { rm -rf "$f"; echo "  removed $f"; }
    done
  fi
}
trap rollback EXIT

while [ $# -gt 0 ]; do
  case "$1" in
    --mode)         MODE="${2:-}"; shift 2 ;;
    --platform-dir) PLATFORM_DIR="${2:-}"; shift 2 ;;
    --dry-run)      DRY_RUN=1; shift ;;
    -h|--help)      sed -n '2,20p' "$0"; exit 0 ;;
    *) die "未知参数：$1" ;;
  esac
done

[ "$MODE" = "a" ] || [ "$MODE" = "b" ] || die "--mode 只能是 a（8443 复用证书）或 b（子域名 443）"
[ -n "$PLATFORM_DIR" ] || die "必须指定 --platform-dir，即平台 docker-compose.yml 所在目录"
[ -f "$PLATFORM_DIR/docker-compose.yml" ] || die "在 $PLATFORM_DIR 找不到 docker-compose.yml"
[ -f "$PLATFORM_DIR/nginx.conf" ] || die "在 $PLATFORM_DIR 找不到 nginx.conf"

command -v docker >/dev/null || die "服务器上没有 docker"
docker compose version >/dev/null 2>&1 || die "需要 docker compose v2（docker compose 命令）"

OVERRIDE="$PLATFORM_DIR/docker-compose.override.yml"
NGINX_COPY="$PLATFORM_DIR/nginx-optical.conf"
CONFD="$PLATFORM_DIR/conf.d"
OURCONF="$CONFD/optical.conf"

# 幂等保护：绝不覆盖已存在的文件
for f in "$OVERRIDE" "$NGINX_COPY" "$OURCONF"; do
  [ -e "$f" ] && die "已存在 $f —— 为避免覆盖你的改动，安装中止。请先确认它是不是上次安装留下的。"
done

say "平台目录：$PLATFORM_DIR"
say "模式：$MODE  （a = https://api.kaypalai.com:8443 ，b = https://optical.kaypalai.com）"

# ---------- 1. 探测平台 docker 网络 ----------
say "探测平台 docker 网络..."
NET="$(docker network ls --format '{{.Name}}' | grep -Ei 'kaypal|wanxiang' | head -n1 || true)"
if [ -z "$NET" ]; then
  warn "没探测到 kaypal/wanxiang 网络，列出全部网络供你判断："
  docker network ls
  die "请在 deploy/.env 里手工设 OPTICAL_NETWORK=<平台网络名> 后重跑"
fi
say "平台网络：$NET"

# ---------- 2. 准备 .env 与数据目录 ----------
cd "$SCRIPT_DIR"
if [ ! -f .env ]; then
  [ $DRY_RUN -eq 1 ] || { printf 'OPTICAL_NETWORK=%s\nHOST_PORT=3100\n' "$NET" > .env; CREATED+=("$SCRIPT_DIR/.env"); }
  say "已写 deploy/.env（OPTICAL_NETWORK=$NET）"
else
  grep -q '^OPTICAL_NETWORK=' .env || die "deploy/.env 已存在但缺 OPTICAL_NETWORK，请手工补上"
  say "沿用已有 deploy/.env"
fi
[ $DRY_RUN -eq 1 ] || { mkdir -p "$SCRIPT_DIR/data"; chown 1000:1000 "$SCRIPT_DIR/data"; chmod 755 "$SCRIPT_DIR/data"; }

# ---------- 3. 生成 nginx 配置（不动平台原文件） ----------
say "生成 nginx-optical.conf（平台 nginx.conf + 一行 include）"
if [ $DRY_RUN -eq 0 ]; then
  # 在 http{} 的最后一个 } 之前插入 include
  python3 - "$PLATFORM_DIR/nginx.conf" "$NGINX_COPY" <<'PY'
import sys, re
src, dst = sys.argv[1], sys.argv[2]
t = open(src, encoding='utf-8').read()
if 'conf.d/*.conf' in t:
    out = t
else:
    i = t.rstrip().rfind('}')
    if i < 0:
        sys.exit('nginx.conf 结构异常，找不到 http 块结尾')
    out = t[:i] + '\n    include /etc/nginx/conf.d/*.conf;\n' + t[i:]
open(dst, 'w', encoding='utf-8').write(out)
PY
  CREATED+=("$NGINX_COPY")
  mkdir -p "$CONFD"; CREATED+=("$CONFD")
  if [ "$MODE" = "a" ]; then
    cp "$SCRIPT_DIR/nginx/optical-8443.conf" "$OURCONF"
  else
    cp "$SCRIPT_DIR/nginx/optical-subdomain.conf" "$OURCONF"
  fi
  CREATED+=("$OURCONF")
fi

# ---------- 4. 生成 compose override（只加端口与挂载） ----------
say "生成 docker-compose.override.yml"
if [ $DRY_RUN -eq 0 ]; then
  {
    echo "# 由 optical-crm/deploy/install.sh 生成 —— 只追加，不改平台原文件"
    echo "# 回滚：删除本文件 + nginx-optical.conf + conf.d/ 后 docker compose up -d nginx"
    echo "services:"
    echo "  nginx:"
    if [ "$MODE" = "a" ]; then
      echo "    ports:"
      echo "      - \"8443:8443\""
    fi
    echo "    volumes:"
    echo "      - ./conf.d:/etc/nginx/conf.d:ro"
    echo "      - ./nginx-optical.conf:/etc/nginx/nginx.conf:ro"
    if [ "$MODE" = "b" ]; then
      echo "      - ./ssl/optical:/etc/nginx/ssl/optical:ro"
    fi
  } > "$OVERRIDE"
  CREATED+=("$OVERRIDE")
fi

if [ $DRY_RUN -eq 1 ]; then
  say "dry-run 结束：以上文件都没有真正写入。"
  exit 0
fi

# ---------- 5. 起 CRM 容器（必须先于 nginx，否则解析不到 optical） ----------
say "构建并启动 optical-crm ..."
docker compose up -d --build

# 容器以 node(uid 1000) 运行；Linux 上 bind mount 目录若属 root 会写不进 db.json
# 实测踩坑：容器会陷入 Restarting 循环，日志报 EACCES /app/data/db.json
say "校正数据目录属主为 uid 1000 ..."
chown -R 1000:1000 "$SCRIPT_DIR/data"
docker compose restart optical

say "等待健康检查..."
for i in $(seq 1 30); do
  if docker exec optical-crm node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    say "CRM 健康检查通过"
    break
  fi
  [ "$i" = "30" ] && { docker compose logs --tail=50 optical; die "CRM 30 次探活均失败"; }
  sleep 2
done

# ---------- 6. 校验并重载 nginx ----------
say "重建 nginx 容器以套用 override..."
cd "$PLATFORM_DIR"
docker compose up -d nginx

NGINX_CID="$(docker compose ps -q nginx)"
[ -n "$NGINX_CID" ] || die "找不到 nginx 容器"

# nginx < 1.25.1 不认识独立的 http2 指令，必须写成 listen ... http2
# 实测踩坑：nginx 1.20.1 上报 unknown directive "http2"，nginx -t 直接失败
NGV="$(docker exec "$NGINX_CID" nginx -v 2>&1 | sed -n 's#.*/##p')"
say "nginx 版本：$NGV"
if [ -n "$NGV" ] && [ "$(printf '%s\n1.25.1\n' "$NGV" | sort -V | head -n1)" = "$NGV" ] && [ "$NGV" != "1.25.1" ]; then
  warn "nginx < 1.25.1，改用旧版 http2 写法"
  sed -i -e 's/^\(\s*\)listen \(.*\) ssl;$/\1listen \2 ssl http2;/' \
         -e '/^\s*http2 on;\s*$/d' "$OURCONF"
fi

if ! docker exec "$NGINX_CID" nginx -t; then
  die "nginx 配置校验失败，请检查 $OURCONF"
fi
docker exec "$NGINX_CID" nginx -s reload
say "nginx 已重载"

# ---------- 7. 验证 ----------
say "验证反代链路..."
if [ "$MODE" = "a" ]; then
  URL="https://api.kaypalai.com:8443/api/health"
else
  URL="https://optical.kaypalai.com/api/health"
fi
sleep 2
if curl -fsS --max-time 15 "$URL" >/dev/null 2>&1; then
  say "✅ $URL 可访问"
else
  warn "外部访问 $URL 失败。常见原因："
  warn "  a) 云安全组 / 服务器防火墙没放行端口（模式 a 是 8443）"
  warn "  b) 模式 b：DNS A 记录还没生效，或证书没放到 docker/ssl/optical/"
  warn "本机链路自检："
  curl -fsS --max-time 10 "http://127.0.0.1:3100/api/health" && say "  宿主机 → CRM 正常（说明只差公网入口）"
fi

say "完成。首次登录密码 admin123，登录后请立即修改。"
say "回滚：rm $OVERRIDE $NGINX_COPY && rm -rf $CONFD && cd $PLATFORM_DIR && docker compose up -d nginx"
