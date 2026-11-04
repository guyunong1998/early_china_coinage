# Same Apache as an Ubuntu server (apache2 package, Debian layout), serving
# scripts/apache/coin-app.conf.template with a self-signed certificate for
# localhost in place of the Let's Encrypt one production gets.
FROM ubuntu:24.04
RUN apt-get update \
 && apt-get install -y --no-install-recommends apache2 gettext-base openssl \
 && rm -rf /var/lib/apt/lists/* \
 && a2enmod ssl proxy proxy_http headers rewrite \
 && a2dissite 000-default \
 && openssl req -x509 -nodes -days 365 -newkey rsa:2048 -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost" \
      -keyout /etc/ssl/private/localhost.key -out /etc/ssl/certs/localhost.crt
COPY scripts/apache/coin-app.conf.template /etc/apache2/coin-app.conf.template
ENV SERVER_NAME=localhost \
    APP_UPSTREAM=app:3000 \
    SSL_CERT=/etc/ssl/certs/localhost.crt \
    SSL_KEY=/etc/ssl/private/localhost.key
CMD envsubst '${SERVER_NAME} ${APP_UPSTREAM} ${SSL_CERT} ${SSL_KEY}' < /etc/apache2/coin-app.conf.template > /etc/apache2/sites-enabled/coin-app.conf \
 && exec apache2ctl -D FOREGROUND
