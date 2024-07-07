server {
    listen 80;
    listen [::]:80;
    server_name irc.somdomato.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;

    ssl_certificate         /etc/letsencrypt/live/somdomato.com/fullchain.pem;
    ssl_certificate_key     /etc/letsencrypt/live/somdomato.com/privkey.pem;

    server_name irc.somdomato.com;
    #proxy_intercept_errors on;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

    location / {
        proxy_read_timeout 15m;
        # Forward incoming requests to local webircgateway socket
        proxy_pass http://127.0.0.1:7779;

        # Set http version and headers
        proxy_http_version 1.1;

        # Add X-Forwarded-* headers
        proxy_set_header X-Forwarded-Host   $host;
        proxy_set_header X-Forwarded-Proto  $scheme;
        #proxy_set_header X-Forwarded-For    $remote_addr;

        # Allow upgrades to websockets
        proxy_set_header Upgrade     $http_upgrade;
        proxy_set_header Connection  "upgrade";
    }
    
    location /socket {
        proxy_read_timeout 15m;
        # Forward incoming requests to local webircgateway socket
        proxy_pass http://127.0.0.1:7779/webirc/websocket;

        # Set http version and headers
        proxy_http_version 1.1;
        
        # Add X-Forwarded-* headers
        proxy_set_header X-Forwarded-Host   $host;
        proxy_set_header X-Forwarded-Proto  $scheme;
        #proxy_set_header X-Forwarded-For    $remote_addr;

        # Allow upgrades to websockets
        proxy_set_header Upgrade     $http_upgrade;
        proxy_set_header Connection  "upgrade";
    }
    
    location /files/ {
        # Forward incoming requests to local fileupload instance
        proxy_pass http://127.0.0.1:8088/files/;

        # Disable request and response buffering
        proxy_request_buffering  off;
        proxy_buffering          off;
        proxy_http_version       1.1;

        # Add X-Forwarded-* headers
        proxy_set_header X-Forwarded-Host   $host;
        proxy_set_header X-Forwarded-Proto  $scheme;
        #proxy_set_header X-Forwarded-For    $remote_addr;

        # Allow upgrades to websockets
        proxy_set_header Upgrade     $http_upgrade;
        proxy_set_header Connection  "upgrade";
        client_max_body_size         0;
    }

    location ~ /\.ht { deny all; }
}

