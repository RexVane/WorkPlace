package agent

import (
	"bytes"
	"sort"
	"strings"

	"github.com/yetone/magpie/internal/edit"
)

// Repoint moves the agents magpie has wired onto a gateway address that has
// moved. magpie writes its own address into every agent it connects (a
// provider block, a base URL, a launch command), and a magpie moved to
// another port — Windows keeping the old one out of reach, a port the user
// changed in Settings — leaves each of them calling an address that answers
// nothing. Until this, the wiring was silently stale: the agents failed
// until each was connected again by hand.
//
// Only the address is rewritten, byte for byte, and only in the config file
// magpie itself edits (Agent.Path). Anything else in those files — the
// user's own providers, comments, spacing, line endings — is as it was. The
// paths that changed come back for the log, and so do the ones that couldn't
// be written: a repoint that quietly did nothing would leave those agents
// calling an address that answers nothing, which is the whole thing this
// exists to avoid.
func Repoint(from, to string) (moved []string, trouble map[string]error) {
	if from == "" || to == "" || from == to {
		return nil, nil
	}
	for _, a := range All() {
		// an agent whose config isn't a file of this machine's — a remote
		// magpie's, a URL — has no address of ours written in it to move
		if a.Path == "" || strings.Contains(a.Path, "://") {
			continue
		}
		changed, err := RepointFile(a.Path, from, to)
		switch {
		case err != nil:
			if trouble == nil {
				trouble = map[string]error{}
			}
			trouble[a.Path] = err
		case changed:
			moved = append(moved, a.Path)
		}
	}
	sort.Strings(moved)
	return moved, trouble
}

// RepointFile is Repoint for one file: whether it held the old address and
// was written with the new one.
func RepointFile(path, from, to string) (bool, error) {
	b, err := edit.Read(path)
	if err != nil {
		return false, err
	}
	if !bytes.Contains(b, []byte(from)) {
		return false, nil
	}
	out := bytes.ReplaceAll(b, []byte(from), []byte(to))
	if err := edit.WriteAtomic(path, out); err != nil {
		return false, err
	}
	return true, nil
}
