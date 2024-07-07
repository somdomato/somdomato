server {
    listen 80;
    listen [::]:80;
    server_name *.somdomato.com somdomato.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;

    ssl_certificate         /etc/letsencrypt/live/somdomato.com/fullchain.pem;
    ssl_certificate_key     /etc/letsencrypt/live/somdomato.com/privkey.pem;

    server_name www.somdomato.com;
    return 301 https://somdomato.com$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;

    ssl_certificate         /etc/letsencrypt/live/somdomato.com/fullchain.pem;
    ssl_certificate_key     /etc/letsencrypt/live/somdomato.com/privkey.pem;

    server_name somdomato.com *.somdomato.com;

    root /var/www/somdomato/frontend/dist;

    location / {
        try_files $uri $uri/ /index.html =500;
    }
}