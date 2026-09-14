package github

import (
	"net/http"
	"time"

	"github.com/spencerjireh/githelp/backend/internal/auth"
	"github.com/spencerjireh/githelp/backend/internal/db"
)

// Client talks to GitHub on behalf of the signed-in user.
//
// It has exactly one job: fetch the raw work items for the brief in a single
// GraphQL request. The REST notification-polling path it used to carry was
// removed along with the inbox it fed.
type Client struct {
	authMgr    *auth.Manager
	db         *db.DB
	httpClient *http.Client
	baseURL    string
	graphqlURL string
}

func NewClient(authMgr *auth.Manager, database *db.DB) *Client {
	return &Client{
		authMgr: authMgr,
		db:      database,
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
		baseURL:    "https://api.github.com",
		graphqlURL: "https://api.github.com/graphql",
	}
}
