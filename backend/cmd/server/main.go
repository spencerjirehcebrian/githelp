package main

import (
	"context"
	"embed"
	"flag"
	"io/fs"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"syscall"
	"time"

	"github.com/spencerjireh/githelp/backend/internal/api"
	"github.com/spencerjireh/githelp/backend/internal/auth"
	"github.com/spencerjireh/githelp/backend/internal/db"
	"github.com/spencerjireh/githelp/backend/internal/github"
)

// Embed static frontend assets built into the binary
//
//go:embed all:dist
var embeddedFS embed.FS

func main() {
	portFlag := flag.Int("port", 0, "HTTP port to listen on (default 8080 or PORT env)")
	hostFlag := flag.String("host", "", "Host interface to bind to (default 127.0.0.1 or HOST env)")
	dbFlag := flag.String("db", "", "Path to SQLite database file")
	devFlag := flag.Bool("dev", false, "Run in development mode (no embedded frontend)")
	flag.Parse()

	host := "127.0.0.1"
	if *hostFlag != "" {
		host = *hostFlag
	} else if envHost := os.Getenv("HOST"); envHost != "" {
		host = envHost
	}

	port := 8080
	if *portFlag > 0 {
		port = *portFlag
	} else if envPort := os.Getenv("PORT"); envPort != "" {
		if p, err := strconv.Atoi(envPort); err == nil && p > 0 {
			port = p
		}
	}

	dbPath := *dbFlag
	if dbPath == "" {
		if envDB := os.Getenv("DB_PATH"); envDB != "" {
			dbPath = envDB
		} else {
			home, err := os.UserHomeDir()
			if err != nil {
				dbPath = "githelp.db"
			} else {
				appDir := filepath.Join(home, ".githelp")
				_ = os.MkdirAll(appDir, 0755)
				dbPath = filepath.Join(appDir, "githelp.db")
			}
		}
	}

	log.Printf("[GitHelp] Starting server on http://%s:%d (database: %s)", host, port, dbPath)

	database, err := db.Open(dbPath)
	if err != nil {
		log.Fatalf("[GitHelp] Failed to open database: %v", err)
	}
	defer database.Close()

	authMgr := auth.NewManager(database)
	client := github.NewClient(authMgr, database)

	var staticFS fs.FS
	if !*devFlag {
		sub, err := fs.Sub(embeddedFS, "dist")
		if err == nil {
			staticFS = sub
		}
	}

	// There is no background poller. The brief is generated when the client
	// asks for it, so a server that nobody is looking at does no work.
	srv := api.NewServer(api.ServerConfig{
		Host:     host,
		Port:     port,
		DB:       database,
		AuthMgr:  authMgr,
		Client:   client,
		StaticFS: staticFS,
	})

	serverErrChan := make(chan error, 1)
	go func() {
		if err := srv.Start(); err != nil {
			serverErrChan <- err
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)

	select {
	case <-quit:
		log.Println("[GitHelp] Shutting down gracefully...")
	case err := <-serverErrChan:
		log.Fatalf("[GitHelp] Server error: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("[GitHelp] Shutdown error: %v", err)
	}

	log.Println("[GitHelp] Stopped.")
}
