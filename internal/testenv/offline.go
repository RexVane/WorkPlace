package testenv

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
)

// proxyVars are the variables that name a proxy: Go reads HTTPS_PROXY and
// HTTP_PROXY, curl and magpie (netproxy) ALL_PROXY too.
var proxyVars = []string{"HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy", "ALL_PROXY", "all_proxy"}

// Offline keeps the package's tests off the network: http.DefaultTransport
// (and so http.DefaultClient, and every transport cloned from it after the
// call) dials this computer only — localhost, a name under .localhost, a
// loopback or unspecified address — and refuses anything else before it is
// looked up, saying so on stderr once per address. A test that wants a
// vendor serves it on loopback and points the request there (an
// httptest.Server, a Transport rewriting the host). Without it the tests
// of internal/gateway and internal/provider asked the real models.dev (its
// catalog, fetched as each plugin host started), api.github.com,
// chatgpt.com and Devin's server.codeium.com with made-up accounts, and a
// plan key with a vendor's real base URL would have its windows read for
// routing (#1016). A package calls it from its TestMain, before m.Run.
//
// A proxy on this computer (Clash, a VPN's) is dialled as loopback and
// carries the request out, so the guard on dialing alone let the tests
// reach the vendors through it. The *_PROXY variables are dropped — they
// would give the proxy to magpie's own transports, which choose it
// themselves (netproxy), and to the programs the tests start — and
// DefaultTransport refuses to send a request for another computer through
// any proxy. The system's proxy is netproxy's to leave out: a package whose
// tests reach it sets netproxy.SystemProxy as well.
func Offline() {
	t, ok := http.DefaultTransport.(*http.Transport)
	if !ok {
		return
	}
	for _, k := range proxyVars {
		os.Unsetenv(k)
	}
	var mu sync.Mutex
	said := map[string]bool{}
	refuse := func(addr string) error {
		mu.Lock()
		if !said[addr] {
			said[addr] = true
			fmt.Fprintf(os.Stderr, "testenv: a test asked %s, refused: tests stay off the network\n", addr)
		}
		mu.Unlock()
		return fmt.Errorf("testenv: %s is not this computer; tests stay off the network", addr)
	}
	dial := t.DialContext
	if dial == nil {
		dial = (&net.Dialer{}).DialContext
	}
	t.DialContext = func(ctx context.Context, network, addr string) (net.Conn, error) {
		if local(addr) {
			return dial(ctx, network, addr)
		}
		return nil, refuse(addr)
	}
	if proxy := t.Proxy; proxy != nil {
		t.Proxy = func(req *http.Request) (*url.URL, error) {
			p, err := proxy(req)
			if p != nil && !local(req.URL.Host) {
				return nil, refuse(req.URL.Host)
			}
			return p, err
		}
	}
}

// local says addr, a host:port, is this computer, without looking it up.
func local(addr string) bool {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		host = addr
	}
	host = strings.ToLower(strings.TrimSuffix(host, "."))
	if host == "localhost" || strings.HasSuffix(host, ".localhost") {
		return true
	}
	ip := net.ParseIP(strings.Trim(host, "[]"))
	return ip != nil && (ip.IsLoopback() || ip.IsUnspecified())
}
