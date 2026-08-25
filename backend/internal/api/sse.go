package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"
)

type SSEClient struct {
	id     string
	sendCh chan []byte
}

type SSEBroadcaster struct {
	clients map[string]*SSEClient
	mu      sync.RWMutex
}

func NewSSEBroadcaster() *SSEBroadcaster {
	b := &SSEBroadcaster{
		clients: make(map[string]*SSEClient),
	}
	go b.heartbeatLoop()
	return b
}

func (b *SSEBroadcaster) AddClient(id string) *SSEClient {
	b.mu.Lock()
	defer b.mu.Unlock()

	client := &SSEClient{
		id:     id,
		sendCh: make(chan []byte, 32),
	}
	b.clients[id] = client
	return client
}

func (b *SSEBroadcaster) RemoveClient(id string) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if client, ok := b.clients[id]; ok {
		close(client.sendCh)
		delete(b.clients, id)
	}
}

func (b *SSEBroadcaster) Broadcast(event string, data interface{}) {
	payload, err := json.Marshal(data)
	if err != nil {
		log.Printf("[SSE] failed to marshal event data: %v", err)
		return
	}

	msg := fmt.Sprintf("event: %s\ndata: %s\n\n", event, string(payload))
	b.mu.RLock()
	defer b.mu.RUnlock()

	for _, client := range b.clients {
		select {
		case client.sendCh <- []byte(msg):
		default:
			// Buffer full, skip to avoid blocking
		}
	}
}

func (b *SSEBroadcaster) heartbeatLoop() {
	ticker := time.NewTicker(20 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		b.mu.RLock()
		for _, client := range b.clients {
			select {
			case client.sendCh <- []byte(": heartbeat\n\n"):
			default:
			}
		}
		b.mu.RUnlock()
	}
}

func (b *SSEBroadcaster) HandleSSE(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	clientID := fmt.Sprintf("%d-%s", time.Now().UnixNano(), r.RemoteAddr)
	client := b.AddClient(clientID)
	defer b.RemoveClient(clientID)

	// Send initial connected event
	fmt.Fprintf(w, "event: connected\ndata: {\"status\":\"ok\"}\n\n")
	flusher.Flush()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-client.sendCh:
			if !ok {
				return
			}
			w.Write(msg)
			flusher.Flush()
		}
	}
}
