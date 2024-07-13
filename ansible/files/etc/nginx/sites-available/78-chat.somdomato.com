server {
    listen 80;
    listen [::]:80;
    server_name chat.somdomato.com;
    return 301 https://chat.somdomato.com$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;

    ssl_certificate         /etc/letsencrypt/live/chat.somdomato.com/fullchain.pem;
    ssl_certificate_key     /etc/letsencrypt/live/chat.somdomato.com/privkey.pem;

    server_name chat.somdomato.com;
    #proxy_intercept_errors on;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

    location / {
        index index.html;
        root /usr/share/gamja/dist;
    }

    location /socket {
	proxy_pass http://127.0.0.1:7778/webirc/websocket;
	proxy_read_timeout 600s;
	proxy_http_version 1.1;
	proxy_set_header Upgrade $http_upgrade;
	proxy_set_header Connection "Upgrade";
	#proxy_set_header Host $host;
	proxy_set_header X-Forwarded-For $remote_addr;
	proxy_set_header X-Forwarded-Proto $scheme;
}

	location /webirc {
		proxy_pass http://127.0.0.1:8067;
		proxy_read_timeout 600s;
		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection "Upgrade";
		proxy_set_header X-Forwarded-For $remote_addr;
		proxy_set_header X-Forwarded-Proto $scheme;
	}

    #location /socket {
#	proxy_pass http://127.0.0.1:7779/webirc/websocket;
#	proxy_read_timeout 600s;
#	proxy_http_version 1.1;
#	proxy_set_header Upgrade $http_upgrade;
#	proxy_set_header Connection "Upgrade";
#	proxy_set_header X-Forwarded-For $remote_addr;
#	proxy_set_header X-Forwarded-Proto $scheme;
#    }

    location /webirc/websocket/ {
        proxy_read_timeout 15m;
        # Forward incoming requests to local webircgateway socket
        proxy_pass http://127.0.0.1:7779/webirc/websocket/;

        # Set http version and headers
        proxy_http_version 1.1;
        
        # Add X-Forwarded-* headers
        proxy_set_header X-Forwarded-Host   $host;
        proxy_set_header X-Forwarded-Proto  $scheme;
        proxy_set_header X-Forwarded-For    $remote_addr;

        # Allow upgrades to websockets
        proxy_set_header Upgrade     $http_upgrade;
        proxy_set_header Connection  "upgrade";
    }
        

    location /webirc/kiwiirc {
        proxy_read_timeout 15m;
        # Forward incoming requests to local webircgateway socket
        proxy_pass http://127.0.0.1:7779/webirc/kiwiirc;

        # Set http version and headers
        proxy_http_version 1.1;
    
        # Add X-Forwarded-* headers
        proxy_set_header X-Forwarded-Host   $host;
        proxy_set_header X-Forwarded-Proto  $scheme;
        proxy_set_header X-Forwarded-For    $remote_addr;

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
        proxy_set_header X-Forwarded-For    $remote_addr;

        # Allow upgrades to websockets
        proxy_set_header Upgrade     $http_upgrade;
        proxy_set_header Connection  "upgrade";
        client_max_body_size         0;
    }

    location ~ /\.ht { deny all; }
}

