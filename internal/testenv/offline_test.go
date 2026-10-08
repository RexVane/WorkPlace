package testenv

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"sync/atomic"
	"testing"
)

func TestLocal(t *testing.T) {
	for addr, want := range map[string]bool{
		"127.0.0.1:80": true, "[::1]:443": true, "localhost:3425": true, "LOCALHOST.:1": true,
		"magpie.localhost:80": true, "0.0.0.0:80": true, "[::]:80": true, "127.8.0.1:9": true,
		"models.dev:443": false, "api.kimi.com:443": false, "10.0.0.132:22": false,
		"192.168.1.2:80": false, "localhost.example.com:80": false, "decide.test:443": false,
	} {
		if got := local(addr); got != want {
			t.Errorf("local(%q) = %v, want %v", addr, got, want)
		}
	}
}

// Offline lets a loopback server answer through http.DefaultClient and
// refuses a vendor's host without dialing it — nor through a proxy on this
// computer, which is dialled as loopback and carries the request out: the
// one in *_PROXY is dropped, for magpie's own proxy choice and the programs
// the tests start, and one the transport would take is never asked.
func TestOffline(t *testing.T) {
	tr := http.DefaultTransport.(*http.Transport)
	was, wasProxy := tr.DialContext, tr.Proxy
	t.Cleanup(func() { tr.DialContext, tr.Proxy = was, wasProxy })
	var asked atomic.Int32
	proxy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		asked.Add(1)
		w.WriteHeader(http.StatusBadGateway)
	}))
	defer proxy.Close()
	for _, k := range []string{"HTTPS_PROXY", "HTTP_PROXY", "ALL_PROXY", "https_proxy", "http_proxy", "all_proxy"} {
		t.Setenv(k, proxy.URL)
	}
	// as *_PROXY and the system's are taken: never for loopback
	pu, _ := url.Parse(proxy.URL)
	tr.Proxy = func(r *http.Request) (*url.URL, error) {
		if local(r.URL.Host) {
			return nil, nil
		}
		return pu, nil
	}
	Offline()
	for _, k := range []string{"HTTPS_PROXY", "HTTP_PROXY", "ALL_PROXY", "https_proxy", "http_proxy", "all_proxy"} {
		if v, ok := os.LookupEnv(k); ok {
			t.Errorf("%s is still %q", k, v)
		}
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("here")) }))
	defer srv.Close()
	resp, err := http.Get(srv.URL)
	if err != nil {
		t.Fatalf("loopback refused: %v", err)
	}
	resp.Body.Close()
	clone := tr.Clone() // a transport made from it after the call
	for _, c := range []*http.Client{http.DefaultClient, {Transport: clone}} {
		_, err := c.Get("https://models.dev/api.json")
		if err == nil || !strings.Contains(err.Error(), "tests stay off the network") {
			t.Errorf("models.dev: %v", err)
		}
	}
	if n := asked.Load(); n != 0 {
		t.Errorf("the proxy on this computer was asked %d times", n)
	}
}
