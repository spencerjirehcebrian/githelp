package github

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/spencerjireh/githelp/backend/internal/db"
)

type EventBroadcaster interface {
	Broadcast(event string, data interface{})
}

type Poller struct {
	client      *Client
	db          *db.DB
	broadcaster EventBroadcaster
	triggerChan chan struct{}
	ctx         context.Context
	cancel      context.CancelFunc
	wg          sync.WaitGroup
	mu          sync.Mutex
	isSyncing   bool
}

func NewPoller(client *Client, database *db.DB, broadcaster EventBroadcaster) *Poller {
	ctx, cancel := context.WithCancel(context.Background())
	return &Poller{
		client:      client,
		db:          database,
		broadcaster: broadcaster,
		triggerChan: make(chan struct{}, 1),
		ctx:         ctx,
		cancel:      cancel,
	}
}

// Start launches the background polling and snooze monitor loop.
func (p *Poller) Start() {
	p.wg.Add(1)
	go p.run()
}

// Stop shuts down the poller gracefully.
func (p *Poller) Stop() {
	p.cancel()
	p.wg.Wait()
}

// TriggerSync signals an immediate background sync.
func (p *Poller) TriggerSync() {
	select {
	case p.triggerChan <- struct{}{}:
	default:
	}
}

func (p *Poller) run() {
	defer p.wg.Done()

	// Initial sync on start
	p.doSync()

	snoozeTicker := time.NewTicker(30 * time.Second)
	defer snoozeTicker.Stop()

	for {
		interval := 60 * time.Second
		if settings, err := p.db.GetSettings(); err == nil && settings.PollIntervalSec >= 15 {
			interval = time.Duration(settings.PollIntervalSec) * time.Second
		}
		pollTicker := time.NewTicker(interval)

		select {
		case <-p.ctx.Done():
			pollTicker.Stop()
			return

		case <-p.triggerChan:
			pollTicker.Stop()
			p.doSync()

		case <-pollTicker.C:
			pollTicker.Stop()
			p.doSync()

		case <-snoozeTicker.C:
			reactivated, err := p.db.ReactivateSnoozedNotifications()
			if err == nil && len(reactivated) > 0 {
				if p.broadcaster != nil {
					p.broadcaster.Broadcast("snooze_expired", map[string]interface{}{
						"reactivated_ids": reactivated,
					})
				}
			}
		}
	}
}

func (p *Poller) doSync() {
	p.mu.Lock()
	if p.isSyncing {
		p.mu.Unlock()
		return
	}
	p.isSyncing = true
	p.mu.Unlock()

	defer func() {
		p.mu.Lock()
		p.isSyncing = false
		p.mu.Unlock()
	}()

	if p.broadcaster != nil {
		p.broadcaster.Broadcast("sync_started", map[string]interface{}{
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	}

	count, err := p.client.Sync(p.ctx)
	if err != nil {
		log.Printf("[Poller] Sync error: %v", err)
		if p.broadcaster != nil {
			p.broadcaster.Broadcast("sync_failed", map[string]interface{}{
				"error":     err.Error(),
				"timestamp": time.Now().UTC().Format(time.RFC3339),
			})
		}
		return
	}

	counts, _ := p.db.GetBucketCounts()
	if p.broadcaster != nil {
		p.broadcaster.Broadcast("sync_completed", map[string]interface{}{
			"synced_count":  count,
			"bucket_counts": counts,
			"timestamp":     time.Now().UTC().Format(time.RFC3339),
		})
	}
}
