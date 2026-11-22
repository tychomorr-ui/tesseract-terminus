# PAM · local sovereign deployment

The web chat is on **/pam** and **/reflective-intel**. It calls **pam-core**, recreated from **llama3.1:8b**, only through an authenticated operator-only server function. Ollama stays on `127.0.0.1:11434`. Responses are unsigned AI reflections, not deterministic proofs; temperature 0 and a fixed seed improve repeatability but do not guarantee identical results. Chat cannot append to the Truth Ledger, change Digital Ore, Truth Substrate, probes, or fleet trust.

## 1. Transfer this release

Download `pam-local-deploy.zip` from the accompanying chat attachment. On **your computer**, in its download folder:

```bash
scp pam-local-deploy.zip root@95.111.216.247:/root/
```

This bundle carries the exact changed source files, so deployment does not depend on an unverified GitHub sync. It contains no credentials, repository metadata or dependencies. It does **not** replace your `.env`, Nginx configuration, certificates or ARCHANGEL signer.

## 2. Run on root@sovereign

```bash
set -euo pipefail
apt-get update
apt-get install -y unzip ca-certificates curl python3
command -v node >/dev/null && node --version
# Only if Node is missing or older than 22:
# curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource-setup.sh
# bash /tmp/nodesource-setup.sh
# apt-get install -y nodejs

STAGE=$(mktemp -d /tmp/pam-release.XXXXXX)
unzip /root/pam-local-deploy.zip -d "$STAGE"
test -f /opt/tesseract-terminus/.env
test -f "$STAGE/src/utils/pam-chat.functions.ts"
BACKUP="/root/pam-source-backup-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -m 700 "$BACKUP"
for file in src/routes/pam.tsx src/routes/reflective-intel.tsx; do
  mkdir -p "$BACKUP/$(dirname "$file")"
  cp -a "/opt/tesseract-terminus/$file" "$BACKUP/$file"
done
cp -a "$STAGE/src/." /opt/tesseract-terminus/src/
cp "$STAGE/scripts/deploy-pam-local.sh" /opt/tesseract-terminus/scripts/
cd /opt/tesseract-terminus
bash scripts/deploy-pam-local.sh feee343c-40ba-4d4c-aa31-382168290a7c
```

The operator ID above identifies the existing operator account verified during this release's preview check. If you use a different account, sign in on `/pam`, copy the displayed **Operator ID**, and supply that UUID instead. Identity is validated by the server, never by the browser's displayed ID. No password or token belongs in this command.

The script requires existing Bun and Ollama installations. It pins Ollama to loopback, rebuilds pam-core, runs the dedicated Vitest suite, builds the **Node production** console, backs up the original systemd unit, and restarts `tesseract-console` on **127.0.0.1:8080**. It leaves your working Nginx HTTPS and `/status` proxy untouched. Node 22+ is required. Read any failing step before retrying; an existing systemd override requires review, not silent replacement.

## 3. Finish through the site

Open **https://terminus.nexinus.net/pam**, sign in as the approved operator, and send:

> Reflect on the recorded local ledger. Name missing evidence without inventing fleet health. Give one read-only next move.

Confirm a response displays **[reflection]**, **[lane]**, **[truths]**, **[explanation · unsigned]**, and **[next]**. If no truths exist, expect **unledgered**, not invented authority. Repeat on **https://terminus.nexinus.net/reflective-intel**. Your ledger counts must remain unchanged. A valid runtime result, not an HTTP 200 page response, completes the chat check.

The Lovable-hosted preview cannot reach Ollama on your separate sovereign machine. It remains disabled unless explicitly configured on that host; there is no fallback to a cloud model and no public Ollama proxy.

## 4. Read-only diagnostics

```bash
systemctl is-active ollama tesseract-console nginx terminus-status
ss -ltnp | grep -E ':(8080|11434|443|8443)\b'
curl -fsS http://127.0.0.1:11434/api/version
ollama list
curl -fsS http://127.0.0.1:11434/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"model":"pam-core","stream":false,"format":"json","options":{"temperature":0,"seed":42,"num_predict":512},"messages":[{"role":"user","content":"No ledger supplied. Return an unledgered reflection and exactly one read-only next move as JSON."}]}'
curl -fsS -o /dev/null -w 'PAM HTTPS %{http_code}\n' https://terminus.nexinus.net/pam
curl -fsS -o /dev/null -w 'Reflective Intel HTTPS %{http_code}\n' https://terminus.nexinus.net/reflective-intel
nginx -t
systemctl list-timers --all | grep -i certbot
journalctl -u tesseract-console -u ollama -n 60 --no-pager
```

Ollama and the console must listen only on loopback. Do not open 11434 or add an unauthenticated Nginx proxy to it. Inspect logs locally; do not paste passwords, tokens or environment files into chat. Listing a renewal timer does not itself prove renewal will succeed; `certbot renew --dry-run` exercises renewal and may contact the certificate authority.

## Verification boundary

Local rule tests and authenticated disabled-host UI can be checked in this workspace. Actual inference, certificate renewal and the full authenticated sovereign-host chat can only be completed on your server. Endpoint declarations and HTTP reachability do not prove fleet health. This deployment does not resolve the separate missing Quantus contract or signed fleet artifact bindings.