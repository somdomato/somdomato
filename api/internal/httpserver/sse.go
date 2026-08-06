package httpserver

import "net/http"

func registerSSERoutes(mux *http.ServeMux, app *App) {
	mux.HandleFunc("GET /events", app.Hub.ServeHTTP)
}
