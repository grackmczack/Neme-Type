#!/usr/bin/env bash
# Deployt das Spiel samt PHP-API und Statistik auf den Strato-Webspace (Apache + PHP-FPM) per rsync über SSH.
#
# Nötige Umgebungsvariablen (nichts davon gehört ins Repository):
#   DEPLOY_USER   SSH-Benutzer des Webspace
#   DEPLOY_KEY    Pfad zum privaten SSH-Schlüssel
# Optional:
#   DEPLOY_HOST   (Standard: 85.215.236.203)
#   DEPLOY_DOMAIN (Standard: nemesis316-gegen-die-intergalaktischen-killer-kiffer.de)
#   ANALYTICS_PASSWORD  setzt/ändert das Passwort für /analytics (Benutzer: admin); wird nur per Pipe übertragen
set -euo pipefail
cd "$(dirname "$0")/.."

: "${DEPLOY_USER:?DEPLOY_USER fehlt}" "${DEPLOY_KEY:?DEPLOY_KEY fehlt}"
HOST="${DEPLOY_HOST:-85.215.236.203}"
DOMAIN="${DEPLOY_DOMAIN:-nemesis316-gegen-die-intergalaktischen-killer-kiffer.de}"
VHOST="/var/www/vhosts/${DOMAIN}"
SSH_OPTS=(-o BatchMode=yes -o IdentitiesOnly=yes -i "$DEPLOY_KEY")
remote() { ssh "${SSH_OPTS[@]}" "${DEPLOY_USER}@${HOST}" "$@"; }

echo "→ Spiel (Laufzeitdateien aus Git, ohne ignorierte Dateien)"
git ls-files --cached --others --exclude-standard -- index.html styles.css app.js analytics.js game.js content.js sprites.js enemies.js weapons.js bosses.js intro.js render.js audio.js favicon.svg assets \
  | rsync -aR --files-from=- -e "ssh ${SSH_OPTS[*]}" ./ "${DEPLOY_USER}@${HOST}:${VHOST}/httpdocs/"

echo "→ Apache-Konfiguration, API und Statistik"
remote "mkdir -p '${VHOST}/httpdocs/api' '${VHOST}/httpdocs/analytics' '${VHOST}/neme'"
rsync -a -e "ssh ${SSH_OPTS[*]}" deploy/web/.htaccess deploy/web/robots.txt "${DEPLOY_USER}@${HOST}:${VHOST}/httpdocs/"
rsync -a -e "ssh ${SSH_OPTS[*]}" deploy/web/api/ "${DEPLOY_USER}@${HOST}:${VHOST}/httpdocs/api/"
rsync -a -e "ssh ${SSH_OPTS[*]}" deploy/web/analytics/ "${DEPLOY_USER}@${HOST}:${VHOST}/httpdocs/analytics/"
rsync -a -e "ssh ${SSH_OPTS[*]}" deploy/web/neme/lib.php "${DEPLOY_USER}@${HOST}:${VHOST}/neme/"
remote "sed -i 's#__VHOST__#${VHOST}#g' '${VHOST}/httpdocs/analytics/.htaccess' && chmod 700 '${VHOST}/neme' && mkdir -p -m 700 '${VHOST}/neme/data'"

if [ -n "${ANALYTICS_PASSWORD:-}" ]; then
  echo "→ Passwort für /analytics setzen (Benutzer: admin)"
  printf '%s' "$ANALYTICS_PASSWORD" | remote "php -r '\$p = stream_get_contents(STDIN); file_put_contents(\"${VHOST}/.neme-htpasswd\", \"admin:\" . password_hash(\$p, PASSWORD_BCRYPT) . \"\n\"); chmod(\"${VHOST}/.neme-htpasswd\", 0644);' && rm -f '${VHOST}/neme/.htpasswd'"
elif ! remote "test -s '${VHOST}/.neme-htpasswd'"; then
  echo "! Noch kein Passwort gesetzt: /analytics bleibt gesperrt. ANALYTICS_PASSWORD setzen und erneut deployen."
fi

echo "→ Rauchtest"
CHECK="https://www.${DOMAIN}"
code() { curl -sk -o /dev/null -w '%{http_code}' --resolve "www.${DOMAIN}:443:${HOST}" "$@"; }
echo "  Startseite:   $(code "$CHECK/")"
echo "  API scores:   $(code "$CHECK/api/scores")"
echo "  Analytics:    $(code "$CHECK/analytics/") (401 = geschützt, wie gewollt)"
echo "Fertig."
