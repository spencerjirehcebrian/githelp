package api

import (
	"context"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/spencerjireh/githelp/backend/internal/auth"
	"github.com/spencerjireh/githelp/backend/internal/db"
	"github.com/spencerjireh/githelp/backend/internal/github"
)

type ServerConfig struct {
	Host        string
	Port        int
	DB          *db.DB
	AuthMgr     *auth.Manager
	Client      *github.Client
	Poller      *github.Poller
	Broadcaster *SSEBroadcaster
	StaticFS    fs.FS
}

type Server struct {
	httpServer *http.Server
	config     ServerConfig
	mux        *http.ServeMux
	handler    *APIHandler
}

func NewServer(cfg ServerConfig) *Server {
	if cfg.Host == "" {
		cfg.Host = "127.0.0.1"
	}
	if cfg.Port == 0 {
		cfg.Port = 8080
	}
	if cfg.Broadcaster == nil {
		cfg.Broadcaster = NewSSEBroadcaster()
	}

	handler := NewAPIHandler(cfg.DB, cfg.AuthMgr, cfg.Client, cfg.Poller, cfg.Broadcaster)
	mux := http.NewServeMux()

	s := &Server{
		config:  cfg,
		mux:     mux,
		handler: handler,
	}

	s.setupRoutes()
	return s
}

func (s *Server) setupRoutes() {
	// API Endpoints
	s.mux.HandleFunc("GET /api/status", s.handler.HandleGetStatus)
	s.mux.HandleFunc("POST /api/auth/pat", s.handler.HandleAuthPAT)
	s.mux.HandleFunc("POST /api/auth/disconnect", s.handler.HandleAuthDisconnect)

	s.mux.HandleFunc("GET /api/notifications", s.handler.HandleGetNotifications)
	s.mux.HandleFunc("POST /api/notifications/sync", s.handler.HandleSyncNotifications)
	s.mux.HandleFunc("PATCH /api/notifications/{id}/state", s.handler.HandleUpdateNotificationState)
	s.mux.HandleFunc("POST /api/notifications/bulk", s.handler.HandleBulkUpdate)
	s.mux.HandleFunc("GET /api/counts", s.handler.HandleGetBucketCounts)
	s.mux.HandleFunc("GET /api/repos", s.handler.HandleGetRepos)

	s.mux.HandleFunc("GET /api/events", s.config.Broadcaster.HandleSSE)
	s.mux.HandleFunc("GET /api/settings", s.handler.HandleGetSettings)
	s.mux.HandleFunc("PUT /api/settings", s.handler.HandleUpdateSettings)

	// Static UI handler
	if s.config.StaticFS != nil {
		fileServer := http.FileServer(http.FS(s.config.StaticFS))
		s.mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
			// Don't intercept /api routes
			if strings.HasPrefix(r.URL.Path, "/api") {
				http.NotFound(w, r)
				return
			}

			// Try to open requested file from FS
			path := strings.TrimPrefix(r.URL.Path, "/")
			if path == "" {
				path = "index.html"
			}

			if f, err := s.config.StaticFS.Open(path); err == nil {
				_ = f.Close()
				fileServer.ServeHTTP(w, r)
				return
			}

			// SPA Fallback to index.html for client-side routing
			r.URL.Path = "/index.html"
			fileServer.ServeHTTP(w, r)
		})
	} else {
		// Dev mode default message if static assets not embedded
		s.mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
			if strings.HasPrefix(r.URL.Path, "/api") {
				http.NotFound(w, r)
				return
			}
			w.Header().Set("Content-Type", "text/html")
			w.Write([]byte(`<!DOCTYPE html><html><head><title>GitHelp Dev Mode</title></head><body style="font-family:sans-serif;padding:40px;background:#0d1117;color:#c9d1d9"><h1>GitHelp Backend Running</h1><p>Frontend dev server running at <a href="http://localhost:5173" style="color:#58a6ff">http://localhost:5173</a></p><p>API available at <a href="/api/status" style="color:#58a6ff">/api/status</a></p></body></html>`))
		})
	}
}

func (s *Server) securityMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Security Headers
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "SAMEORIGIN")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

		// CORS for local development
		origin := r.Header.Get("Origin")
		if origin != "" && (strings.HasPrefix(origin, "http://localhost:") || strings.HasPrefix(origin, "http://127.0.0.1:")) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (s *Server) Start() error {
	addr := fmt.Sprintf("%s:%d", s.config.Host, s.config.Port)
	s.httpServer = &http.Server{
		Addr:         addr,
		Handler:      s.securityMiddleware(s.mux),
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("failed to listen on %s: %w", addr, err)
	}

	return s.httpServer.Serve(listener)
}

func (s *Server) Shutdown(ctx context.Context) error {
	if s.httpServer != nil {
		return s.httpServer.Shutdown(ctx)
	}
	return nil
}

func (s *Server) Handler() http.Handler {
	return s.securityMiddleware(s.mux)
}
