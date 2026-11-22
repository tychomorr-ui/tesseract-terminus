#!/usr/bin/env bash
# Run on the sovereign Ubuntu host after copying this release's source files.
set -Eeuo pipefail
trap 'echo "Deployment stopped. Existing certificates and status signer were not changed. Check the failing command before retrying." >&2' ERR
[[ $(id -u) == 0 ]] || { echo "Run as root." >&2; exit 1; }
APP=/opt/tesseract-terminus
OPERATOR_ID=${1:-}
[[ $OPERATOR_ID =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]] || { echo "Usage: bash scripts/deploy-pam-local.sh YOUR_OPERATOR_UUID" >&2; exit 1; }
[[ -f $APP/src/utils/pam-chat.functions.ts && -f $APP/.env ]] || { echo "Updated source and existing .env required in $APP." >&2; exit 1; }
export PATH=/root/.bun/bin:/usr/local/bin:/usr/bin:/bin:$PATH
command -v bun >/dev/null
command -v ollama >/dev/null
command -v node >/dev/null
[[ $(node -p 'Number(process.versions.node.split(".")[0])') -ge 22 ]] || { echo "Install Node 22 or later before deploying." >&2; exit 1; }
cd "$APP"

# Keep Ollama private. Do not expose /api/chat through Nginx.
install -d -m 0755 /etc/systemd/system/ollama.service.d
cat >/etc/systemd/system/ollama.service.d/terminus-local.conf <<'EOF'
[Service]
Environment="OLLAMA_HOST=127.0.0.1:11434"
Environment="OLLAMA_NUM_PARALLEL=1"
Environment="OLLAMA_MAX_QUEUE=4"
EOF
systemctl daemon-reload
systemctl enable --now ollama
systemctl restart ollama
for i in {1..30}; do curl -fsS http://127.0.0.1:11434/api/version >/dev/null && break; sleep 1; done
curl -fsS http://127.0.0.1:11434/api/version >/dev/null
ollama pull llama3.1:8b
install -d -m 0700 /etc/terminus
bun -e 'import { PAM_SYSTEM_PROMPT } from "./src/lib/pam-chat.ts"; console.log("FROM llama3.1:8b\nPARAMETER temperature 0\nPARAMETER seed 42\nPARAMETER num_ctx 8192\nSYSTEM \"\"\"\n" + PAM_SYSTEM_PROMPT + "\n\"\"\"");' >/etc/terminus/Modelfile.pam
ollama create pam-core -f /etc/terminus/Modelfile.pam
ollama show pam-core

# Write only existing public backend configuration plus local operator controls.
# Do not print .env, tokens, or any credential values.
python3 - "$OPERATOR_ID" <<'PY'
import json, os, sys
values = {}
for path in ['/opt/tesseract-terminus/.env', '/opt/tesseract-terminus/.env.local']:
    if not os.path.isfile(path): continue
    for line in open(path):
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line: continue
        key, value = line.removeprefix('export ').split('=', 1)
        values[key.strip()] = value.strip().strip('"\'')
url = values.get('SUPABASE_URL') or values.get('VITE_SUPABASE_URL')
key = values.get('SUPABASE_PUBLISHABLE_KEY') or values.get('VITE_SUPABASE_PUBLISHABLE_KEY')
if not url or not key: raise SystemExit('Existing public backend URL/key missing; preserve and restore your original .env first.')
env = {'SUPABASE_URL': url, 'SUPABASE_PUBLISHABLE_KEY': key,
       'PAM_OLLAMA_ENABLED': '1', 'PAM_OPERATOR_IDS': sys.argv[1],
       'NODE_ENV': 'production', 'HOST': '127.0.0.1', 'PORT': '8080',
       'NITRO_HOST': '127.0.0.1', 'NITRO_PORT': '8080'}
path = '/etc/terminus/pam.env'
fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
with os.fdopen(fd, 'w') as f:
    for k, v in env.items(): f.write(k + '=' + json.dumps(v) + '\n')
os.chmod(path, 0o600)
PY

bun install --frozen-lockfile
bunx vitest run --config vitest.config.ts
# Build the production Node target; do not serve the public site with Vite dev.
NITRO_PRESET=node bun run build
ENTRY="$APP/.output/server/index.mjs"
[[ -f $ENTRY ]] || ENTRY="$APP/dist/server/index.mjs"
[[ -f $ENTRY ]] || { echo "No Node production entry found; existing console service was left running." >&2; exit 1; }

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
[[ ! -f /etc/systemd/system/tesseract-console.service ]] || cp -a /etc/systemd/system/tesseract-console.service "/etc/terminus/tesseract-console.service.$STAMP.bak"
[[ ! -d /etc/systemd/system/tesseract-console.service.d ]] || { echo "Existing console overrides found; review them before replacing the service." >&2; exit 1; }
NODE=$(command -v node)
cat >/etc/systemd/system/tesseract-console.service <<EOF
[Unit]
Description=TERMINUS production console and operator-only local PAM
After=network-online.target ollama.service
Wants=network-online.target
[Service]
Type=simple
WorkingDirectory=$APP
EnvironmentFile=/etc/terminus/pam.env
ExecStart=$NODE $ENTRY
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
UMask=0077
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable tesseract-console
systemctl restart tesseract-console
for i in {1..30}; do curl -fsS http://127.0.0.1:8080/pam >/dev/null && break; sleep 1; done
curl -fsS -o /dev/null -w 'Local PAM page: HTTP %{http_code}\n' http://127.0.0.1:8080/pam
nginx -t
curl -fsS -o /dev/null -w 'HTTPS PAM page: HTTP %{http_code}\n' https://terminus.nexinus.net/pam
curl -fsS -o /dev/null -w 'HTTPS reflection page: HTTP %{http_code}\n' https://terminus.nexinus.net/reflective-intel
curl -fsS -o /dev/null -w 'HTTPS status transport only: HTTP %{http_code}\n' https://terminus.nexinus.net/status
echo 'Deployment completed. Sign in with the configured operator account, send a PAM request, and check the unsigned reflection. HTTP 200 alone does not verify chat or fleet health.'