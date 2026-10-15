package gui

import (
	"context"
	"errors"
	"net/http"
	"os"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/yetone/magpie/internal/gateway"
	"github.com/yetone/magpie/internal/proc"
)

// The Gateway page's button (leslie_luo on Discord): with an older magpie
// keeping the gateway's port, it quits that one and this one serves the
// gateway at once; otherwise it restarts the gateway this one serves, or
// starts it when none does. The page said only "quit that magpie", and the
// user couldn't find which one it was. Only a process whose program is a
// magpie (proc.IsMagpie, by the pid listening on the port and its path) is
// ever ended; anything else is said, never touched.

// gatewayFixJSON is how a take-over or a restart went: what stood in the
// way by a reason the page says in its language, and the process it was.
type gatewayFixJSON struct {
	OK bool `json:"ok"`
	// Reason: "not-magpie" (the port is another program's), "container"
	// (a container's or a VM's: the magpie answering runs in it, which
	// its own tools stop — docker stop, OrbStack's window), "unseen" (no
	// process of this user's listens: another user's, an administrator's),
	// "denied" (a magpie this user may not end), "stuck" (it didn't end),
	// "respawned" (something started a magpie on the port again at once:
	// a LaunchAgent, a systemd unit, a scheduled task), "taken" (the
	// gateway couldn't listen: another program has the port), "reserved"
	// (nothing has the port: the system keeps it out of reach — Windows'
	// excluded ranges for Hyper-V, WSL and Docker — so only another port
	// helps), "other"
	// (a magpie not older than this one serves; quit it there), "error"
	Reason  string `json:"reason,omitempty"`
	PID     int    `json:"pid,omitempty"`
	Path    string `json:"path,omitempty"`
	Port    string `json:"port,omitempty"`
	Version string `json:"version,omitempty"`
	Error   string `json:"error,omitempty"` // the system's own words
}

func gatewayFixRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/gateway/take-over", func(rw http.ResponseWriter, r *http.Request) {
		writeJSON(rw, takeOverGateway())
	})
	mux.HandleFunc("POST /api/gateway/restart", func(rw http.ResponseWriter, r *http.Request) {
		writeJSON(rw, restartGateway())
	})
}

// How long a magpie asked to quit is given before it is ended at once,
// that again, and the gateway here to answer; vars for the tests.
var (
	quitWait  = 5 * time.Second
	killWait  = 3 * time.Second
	startWait = 5 * time.Second
)

// takeOverGateway quits the magpie serving the gateway, when there is one,
// and serves it here.
func takeOverGateway() gatewayFixJSON {
	gatewayMu.Lock()
	defer gatewayMu.Unlock()
	if served.Load() != nil {
		return gatewayFixJSON{OK: true}
	}
	if o := gateway.ServedBy(); o.Running {
		if out := quitMagpieOnPort(o.Version); !out.OK {
			return out
		}
	}
	return startHere()
}

// restartGateway stops the gateway this process serves and starts it
// again; with none served here and none answering, it starts it. A magpie
// serving it elsewhere is left alone: that is the take-over's to quit.
func restartGateway() gatewayFixJSON {
	gatewayMu.Lock()
	defer gatewayMu.Unlock()
	if gw := served.Load(); gw != nil {
		if servedRun.stop != nil {
			servedRun.stop()
			<-servedRun.done
		}
		served.CompareAndSwap(gw, nil)
	} else if o := gateway.ServedBy(); o.Running {
		return gatewayFixJSON{Reason: "other", Version: o.Version, Port: gateway.Port()}
	}
	return startHere()
}

// startHere serves the gateway here and waits until it answers, or says
// what has the port.
func startHere() gatewayFixJSON {
	gw := serveGatewayLocked()
	for deadline := time.Now().Add(startWait); gw != nil && served.Load() == gw; time.Sleep(50 * time.Millisecond) {
		if gateway.Running() {
			return gatewayFixJSON{OK: true}
		}
		if time.Now().After(deadline) {
			break
		}
	}
	// it didn't take the port: who has it
	out := gatewayFixJSON{Reason: "taken", Port: gateway.Port()}
	if o := gateway.ServedBy(); o.Running {
		out.Version = o.Version
	}
	port, _ := strconv.Atoi(out.Port)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if pids, err := proc.ListeningOn(ctx, port); err == nil {
		for _, pid := range pids {
			if pid == os.Getpid() {
				continue
			}
			out.PID = pid
			out.Path, _ = proc.Executable(pid)
			if proc.IsMagpie(out.Path) {
				// a magpie took it back as soon as the other quit
				out.Reason = "respawned"
			} else if proc.IsForwarder(out.Path) {
				out.Reason = "container"
			}
			break
		}
	}
	if out.PID == 0 {
		// Nothing of this user's holds the port, so it isn't a program's to
		// quit and "in use by another program" would name one that isn't
		// there. Windows keeps ranges of ports out of every program's reach
		// for Hyper-V, WSL and Docker (netsh interface ipv4 show
		// excludedportrange protocol=tcp): a bind inside one fails as a
		// permission failure, and only another port helps.
		out.Error = gateway.LastListenError()
		out.Reason = noHolderReason(out.Error)
	}
	return out
}

// noHolderReason is the reason to give when the gateway couldn't take its port
// and nothing of this user's holds it: "reserved" when the system is keeping
// it (only another port helps), "taken" otherwise.
func noHolderReason(errText string) string {
	if reservedSays(errText) {
		return "reserved"
	}
	return "taken"
}

// reservedSays reports whether a failure to take a port is the system keeping
// it rather than a program holding it: Windows refuses an excluded port with
// WSAEACCES, "An attempt was made to access a socket in a way forbidden by its
// access permissions", and Unix refuses a privileged or reserved one with
// EACCES, "permission denied".
func reservedSays(errText string) bool {
	s := strings.ToLower(errText)
	return strings.Contains(s, "permission") || strings.Contains(s, "forbidden") || strings.Contains(s, "access denied")
}

// quitMagpieOnPort ends the magpie (of version, as it says) listening on
// the gateway's port, once its program is checked to be magpie's, and
// waits until the port is let go.
func quitMagpieOnPort(version string) gatewayFixJSON {
	port := gateway.Port()
	n, _ := strconv.Atoi(port)
	out := gatewayFixJSON{Port: port, Version: version}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	pids, err := proc.ListeningOn(ctx, n)
	if err != nil {
		out.Reason, out.Error = "error", err.Error()
		return out
	}
	pids = slices.DeleteFunc(pids, func(p int) bool { return p == os.Getpid() })
	if len(pids) == 0 {
		out.Reason = "unseen"
		return out
	}
	for _, pid := range pids {
		path, err := proc.Executable(pid)
		out.PID, out.Path = pid, path
		if err != nil {
			// a process this user can't look into isn't one it can end
			out.Reason, out.Error = "unseen", err.Error()
			return out
		}
		if !proc.IsMagpie(path) {
			out.Reason = "not-magpie"
			if proc.IsForwarder(path) {
				out.Reason = "container"
			}
			return out
		}
	}
	end := func(f func(int) error) *gatewayFixJSON {
		for _, pid := range pids {
			if err := f(pid); err != nil {
				out.PID = pid
				out.Path, _ = proc.Executable(pid)
				if errors.Is(err, proc.ErrDenied) {
					out.Reason = "denied"
				} else {
					out.Reason, out.Error = "error", err.Error()
				}
				return &out
			}
		}
		return nil
	}
	if bad := end(proc.Terminate); bad != nil {
		return *bad
	}
	if letGo(ctx, n, pids, quitWait) {
		return gatewayFixJSON{OK: true}
	}
	if bad := end(proc.Kill); bad != nil {
		return *bad
	}
	if letGo(ctx, n, pids, killWait) {
		return gatewayFixJSON{OK: true}
	}
	out.Reason = "stuck"
	return out
}

// letGo waits until none of pids listens on port.
func letGo(ctx context.Context, port int, pids []int, wait time.Duration) bool {
	for deadline := time.Now().Add(wait); ; time.Sleep(100 * time.Millisecond) {
		now, err := proc.ListeningOn(ctx, port)
		if err == nil && !slices.ContainsFunc(now, func(p int) bool { return slices.Contains(pids, p) }) {
			return true
		}
		if time.Now().After(deadline) {
			return false
		}
	}
}
