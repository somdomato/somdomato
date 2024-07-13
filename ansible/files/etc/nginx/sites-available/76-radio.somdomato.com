server {
    listen 80;
    listen [::]:80;
    server_name radio.somdomato.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 5m;
   
    ssl_certificate         /etc/letsencrypt/live/somdomato.com/fullchain.pem;
    ssl_certificate_key     /etc/letsencrypt/live/somdomato.com/privkey.pem;

    server_name radio.somdomato.com;
    
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Server $host;
    proxy_set_header X-Real-IP $remote_addr;
    
    location / {
        proxy_intercept_errors on;
        proxy_pass http://localhost:8000;
    }
}
