package gateway

import (
	"errors"
	"strings"
	"testing"
)

// LastListenError is what the Gateway page reads to say why it couldn't serve
// the gateway when nothing of the user's holds the port — Windows' excluded
// ranges for Hyper-V, WSL and Docker fail a bind as a permission failure, and
// the page used to blame a program that wasn't there. It must hold the
// failure, and let go of it once the port is taken.
func TestLastListenErrorHoldsAndLetsGo(t *testing.T) {
	t.Cleanup(func() { noteListenErr(nil) })
	noteListenErr(nil)
	if got := LastListenError(); got != "" {
		t.Fatalf("before anything: %q", got)
	}
	noteListenErr(errors.New("listen tcp 127.0.0.1:3425: bind: An attempt was made to access a socket in a way forbidden by its access permissions."))
	got := LastListenError()
	if !strings.Contains(got, "forbidden by its access permissions") {
		t.Fatalf("after a failure: %q", got)
	}
	noteListenErr(nil)
	if got := LastListenError(); got != "" {
		t.Fatalf("after taking the port: %q", got)
	}
}
